/**
 * ai-client.ts
 * 微信独立 AI 接口：从 localStorage 读取用户配置，向 OpenAI-compatible 接口发流式请求。
 * 不走主线 AI，不向上下文暴露聊天记录。
 */

export type AiConfig = {
  baseUrl: string;
  apiKey: string;
  model: string;
  systemPromptPrefix: string;
};

export type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
  /** 发送时的故事内日期/时间（环境.日期 / 环境.时间），仅本地展示与同步世界书用 */
  date?: string;
  time?: string;
};

// 部分兼容接口会拒绝 messages 里的未知字段，发请求前只保留 role/content
function toApiMessages(messages: ChatMessage[]) {
  return messages.map(({ role, content }) => ({ role, content }));
}

const CONFIG_KEY = 'YuriOpening:phone:ai-config:v1';

const DEFAULT_CONFIG: AiConfig = {
  baseUrl: '',
  apiKey: '',
  model: 'gpt-4o-mini',
  systemPromptPrefix: '',
};

export function loadAiConfig(): AiConfig {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (!raw) return { ...DEFAULT_CONFIG };
    return { ...DEFAULT_CONFIG, ...(JSON.parse(raw) as Partial<AiConfig>) };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export function saveAiConfig(config: AiConfig) {
  try {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
  } catch {
    // srcdoc 环境可能不持久化，静默失败
  }
}

/** 构造某角色的微信人设 System Prompt（聊天规范取自角色注册表的 phone.tone） */
export function buildSystemPrompt(
  config: AiConfig,
  char: { name: string; tone: string },
  context: {
    playerName: string;
    relationship: string;
    closeness: number | string;
    heartbeat: number | string;
    recentEvent: string;
    summaryHistory: string[];
    mood: string;
    location: string;
    innerVoice: string;
    currentAction: string;
    outfit: string;
  },
): string {
  const { playerName, relationship, closeness, heartbeat, recentEvent, summaryHistory,
    mood, location, innerVoice, currentAction, outfit } = context;

  const historyBlock =
    summaryHistory.length > 0
      ? `【微信聊天记忆】\n${summaryHistory.map((s, i) => `  ${i + 1}. ${s}`).join('\n')}`
      : '';
  const eventBlock = recentEvent ? `【已知事件】${recentEvent}` : '';

  const statusLines: string[] = [];
  if (location) statusLines.push(`当前地点：${location}`);
  if (currentAction) statusLines.push(`正在：${currentAction}`);
  if (outfit) statusLines.push(`穿着：${outfit}`);
  if (innerVoice) statusLines.push(`内心：${innerVoice}`);
  const statusBlock = statusLines.length > 0 ? `【当前状态】\n${statusLines.map(l => `  ${l}`).join('\n')}` : '';

  const base = `你是${char.name}，正在和${playerName}用微信聊天。

【当前关系】${relationship}，亲近 ${closeness}/100，心动 ${heartbeat}/100，心情 ${mood}
${statusBlock}
${eventBlock}
${historyBlock}

【聊天规范】
${char.tone}`;

  const prefix = config.systemPromptPrefix.trim();
  return prefix ? `${prefix}\n\n---\n\n${base}` : base;
}

/**
 * 流式调用 AI，onToken 每收到一个 token 就回调。
 * 返回完整文本（resolve）或错误信息（reject）。
 */
export async function streamChat(
  config: AiConfig,
  messages: ChatMessage[],
  onToken: (token: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  if (!config.baseUrl.trim()) {
    throw new Error('请先在「设置」页填写接口地址');
  }
  const url = `${config.baseUrl.replace(/\/$/, '')}/chat/completions`;
  const body = {
    model: config.model,
    messages: toApiMessages(messages),
    stream: true,
    // 放宽上限：部分兼容接口（如 Gemini 系）思考 token 会占用预算，过小会把回复截断
    max_tokens: 800,
    temperature: 0.85,
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`HTTP ${response.status}: ${text.slice(0, 200)}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('无法读取响应流');

  const decoder = new TextDecoder();
  let full = '';
  let buffer = '';

  const processLine = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed.startsWith('data:')) return;
    const data = trimmed.slice(5).trim();
    if (!data || data === '[DONE]') return;
    try {
      const parsed = JSON.parse(data) as {
        choices?: Array<{ delta?: { content?: string } }>;
      };
      const token = parsed.choices?.[0]?.delta?.content ?? '';
      if (token) {
        full += token;
        onToken(token);
      }
    } catch {
      // 半包或不完整行，等下一个分包拼齐后再解析
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) processLine(line);
  }
  buffer += decoder.decode();
  if (buffer) processLine(buffer);

  return full;
}

/** 非流式——用于生成摘要、朋友圈等不需要逐字显示的任务 */
export async function singleChat(config: AiConfig, messages: ChatMessage[]): Promise<string> {
  if (!config.baseUrl.trim()) {
    throw new Error('请先在「设置」页填写接口地址');
  }
  const url = `${config.baseUrl.replace(/\/$/, '')}/chat/completions`;
  const body = { model: config.model, messages: toApiMessages(messages), max_tokens: 500, temperature: 0.7 };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`HTTP ${response.status}: ${text.slice(0, 200)}`);
  }

  const json = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return json.choices?.[0]?.message?.content?.trim() ?? '';
}

/**
 * 生成本次对话摘要（≤30字），用于写回 MVU 变量。
 * messages 为本次对话的完整历史（不含 system）。
 */
export async function summarizeConversation(
  config: AiConfig,
  messages: ChatMessage[],
  charName: string,
): Promise<string> {
  if (messages.length === 0) return '';
  const dialog = messages
    .filter(m => m.role !== 'system')
    .map(m => `${m.role === 'user' ? '玩家' : charName}: ${m.content}`)
    .join('\n');

  return singleChat(config, [
    {
      role: 'system',
      content: `用不超过 30 个汉字，概括下面这段微信对话的核心内容，从${charName}视角写，第三人称。只输出摘要文本，不加标点符号以外的任何格式。`,
    },
    { role: 'user', content: dialog },
  ]);
}

/**
 * 生成某角色的朋友圈内容（≤80字）。
 * context 提供角色名、风格提示、当前心情、关系与最近事件。
 */
export async function generateMoment(
  config: AiConfig,
  context: {
    charName: string;
    momentHint: string;
    mood: string;
    relationship: string;
    recentEvent: string;
    storyDate: string;
  },
): Promise<string> {
  const { charName, momentHint, mood, relationship, recentEvent, storyDate } = context;
  const hint = recentEvent && recentEvent !== '' ? `最近发生了：${recentEvent}` : '';
  return singleChat(config, [
    {
      role: 'system',
      content: `你是${charName}，正在发朋友圈。当前心情：${mood}，关系身份：${relationship}。${hint}
${momentHint}
写一条朋友圈文字：80 字以内，语气自然，可以隐晦，可以是一句感慨或片段，不要太甜腻也不要太明显指向某人。只输出朋友圈正文，不加任何前缀或说明。`,
    },
    { role: 'user', content: `今天是 ${storyDate}。` },
  ]);
}

/** 测试连接：发一条 hello，返回成功/失败及响应片段 */
export async function testConnection(config: AiConfig): Promise<{ ok: boolean; message: string }> {
  try {
    const result = await singleChat(config, [
      { role: 'user', content: '你好，回复两个字就好。' },
    ]);
    return { ok: true, message: `连接成功：${result.slice(0, 30)}` };
  } catch (error) {
    return { ok: false, message: String(error).slice(0, 100) };
  }
}
