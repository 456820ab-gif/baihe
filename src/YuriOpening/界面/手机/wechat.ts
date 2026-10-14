/**
 * wechat.ts
 * 微信四个页面：聊天列表、对话、好友、朋友圈、设置。
 * doc 参数为 hostDoc()（父页面 document），所有 DOM 在同一 document 内创建。
 */

import {
  type AiConfig,
  type ChatMessage,
  buildSystemPrompt,
  generateMoment,
  loadAiConfig,
  saveAiConfig,
  streamChat,
  summarizeConversation,
  testConnection,
} from './ai-client';
import { phoneKey } from './storage';
import { CHARACTERS, type CharacterDef, type CharacterId, relationAtLeast } from '../../characters';
import {
  avatarLQ,
  iconBack,
  iconComment,
  iconDown,
  iconHeart,
  iconMood,
  iconMore,
  iconSearch,
  iconSend,
  iconSettings,
} from './phone-icons';
import { EMOJI_GROUPS, KAOMOJI_GROUPS } from './emoji-data';

// ────────────────────────────────────────────────────────────────────────────
// 类型
// ────────────────────────────────────────────────────────────────────────────

export type CharacterChatData = {
  def: CharacterDef;
  relationship: string;
  closeness: number | string;
  heartbeat: number | string;
  recentEvent: string;
  summaryHistory: string[];
  hasAdded: boolean;
  /** 玩家试过添加但被拒过（本地状态，按存档隔离）；关系到位后自动清除 */
  addRejected: boolean;
  mood: string;
  location: string;
  innerVoice: string;
  currentAction: string;
  outfit: string;
};

export type WechatMoment = { 作者: string; 内容: string; 时间: string; 心情: string; 点赞数: number };

export type WechatData = {
  playerName: string;
  storyDate: string;
  moments: WechatMoment[];
  characters: CharacterChatData[];
};

export type WechatCallbacks = {
  onSyncSummary: (char: CharacterDef, summary: string) => void;
  /** 发消息瞬间读取最新故事时间（主线可能在聊天页打开期间推进） */
  getStoryTime: () => { date: string; time: string };
  onHistoryChange: (char: CharacterDef, history: ChatMessage[]) => void;
  onAddMoment: (moment: WechatMoment) => void;
  onAddFriend: (char: CharacterDef) => void;
  /** 添加被拒：按存档记下，关系不到位前不再放行 */
  onAddRejected: (char: CharacterDef) => void;
  onUnreadClear: () => void;
};

// 聊天消息本地存储（键按存档隔离，见 storage.ts）

// ────────────────────────────────────────────────────────────────────────────
// 工具：在指定 document 下创建元素
// ────────────────────────────────────────────────────────────────────────────

function el<K extends keyof HTMLElementTagNameMap>(
  doc: Document,
  tag: K,
  cls?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const e = doc.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

export function loadChatHistory(key: string): ChatMessage[] {
  try {
    return JSON.parse(localStorage.getItem(key) ?? '[]') as ChatMessage[];
  } catch {
    return [];
  }
}

/** 每个角色的聊天记录键；林清沿用旧键，老存档无缝 */
export function chatHistoryKeyOf(id: CharacterId): string {
  return phoneKey(id === 'linqing' ? 'chat-history:v1' : `chat-history:v1:${id}`);
}

/** 头像：渐变与字由角色注册表配置决定 */
function avatarFor(def: CharacterDef): string {
  return avatarLQ({ key: def.id, stops: def.phone.avatarStops, glyph: def.glyph });
}

/** 玩家自己的头像：名字首字 + 柔和青玉渐变（与两位角色的配色区分） */
function playerAvatar(playerName: string): string {
  const glyph = (playerName.trim() || '你')
    .slice(0, 1)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
  return avatarLQ({ key: 'player', stops: ['#b0c3b6', '#7e968a', '#5f6b72'], glyph });
}

/** 按展示名找角色定义（朋友圈作者名→角色）；找不到时退回林清 */
function defByName(name: string): CharacterDef {
  return CHARACTERS.find(c => c.name === name) ?? CHARACTERS[0];
}

function saveChatHistory(key: string, msgs: ChatMessage[]) {
  try {
    localStorage.setItem(key, JSON.stringify(msgs.slice(-60)));
  } catch { /* 静默 */ }
}

// 聊天时间分割条：「5月16日 19:40」，日期非 YYYY-MM-DD 时原样显示，待设定的部分省略
function formatChatStamp(date?: string, time?: string): string {
  const parts: string[] = [];
  if (date && date !== '待设定') {
    const m = /^\d{4}-(\d{1,2})-(\d{1,2})$/.exec(date.trim());
    parts.push(m ? `${Number(m[1])}月${Number(m[2])}日` : date.trim());
  }
  if (time && time !== '待设定') parts.push(time.trim());
  return parts.join(' ');
}

// 上次生成朋友圈时的卡内日期；空字符串 = 从未生成
function getLastMomentDate(key: string): string {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return '';
    // 旧版本存的是毫秒时间戳，视为无记录
    return /^\d+$/.test(raw) ? '' : raw;
  } catch {
    return '';
  }
}

function setLastMomentDate(key: string, date: string) {
  try { localStorage.setItem(key, date); } catch { /* 静默 */ }
}

// ────────────────────────────────────────────────────────────────────────────
// 聊天列表页
// ────────────────────────────────────────────────────────────────────────────

export function renderChatList(
  doc: Document,
  data: WechatData,
  onOpenChat: (char: CharacterChatData) => void,
): HTMLElement {
  const wrap = el(doc, 'div', 'wc-page wc-chatlist');
  const added = data.characters.filter(c => c.hasAdded);

  if (added.length === 0) {
    // 未添加时的空态 —— 带花朵装饰
    const empty = el(doc, 'div', 'wc-empty');
    empty.innerHTML = `
      <div class="wc-empty-deco">
        <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="32" cy="32" r="28" fill="var(--ph-petal-soft)"/>
          <path d="M32 18c0-4 3-7 7-7 0 4-3 7-7 7z" fill="var(--ph-accent-light)" opacity=".7"/>
          <path d="M32 18c0-4-3-7-7-7 0 4 3 7 7 7z" fill="var(--ph-accent)" opacity=".6"/>
          <path d="M32 18c4 0 7 3 7 7-4 0-7-3-7-7z" fill="var(--ph-accent-light)" opacity=".5"/>
          <path d="M32 18c-4 0-7 3-7 7 4 0 7-3 7-7z" fill="var(--ph-accent)" opacity=".5"/>
          <circle cx="32" cy="22" r="5" fill="var(--ph-accent)"/>
          <text x="32" y="42" text-anchor="middle" font-size="11" fill="var(--ph-ink-soft)" font-family="sans-serif">还没有联系人</text>
          <text x="32" y="55" text-anchor="middle" font-size="9" fill="var(--ph-ink-faint)" font-family="sans-serif">去通讯录添加好友 ✦</text>
        </svg>
      </div>`;
    wrap.appendChild(empty);
    return wrap;
  }

  for (const char of added) {
    const history = loadChatHistory(chatHistoryKeyOf(char.def.id));
    const lastMsg = history.filter(m => m.role !== 'system').slice(-1)[0];
    const preview = lastMsg
      ? (lastMsg.role === 'user' ? `你：${lastMsg.content}` : lastMsg.content).slice(0, 28)
      : '点击开始聊天 ♡';

    const item = el(doc, 'div', 'wc-chat-item');
    const avatar = el(doc, 'div', 'wc-item-avatar');
    avatar.innerHTML = avatarFor(char.def);
    const info = el(doc, 'div', 'wc-item-info');
    const nameRow = el(doc, 'div', 'wc-item-name-row');
    nameRow.appendChild(el(doc, 'span', 'wc-item-name', char.def.name));
    const previewEl = el(doc, 'span', 'wc-item-preview', preview);
    info.appendChild(nameRow);
    info.appendChild(previewEl);
    item.appendChild(avatar);
    item.appendChild(info);
    item.addEventListener('click', () => onOpenChat(char));
    wrap.appendChild(item);
  }
  return wrap;
}

// ────────────────────────────────────────────────────────────────────────────
// 对话页
// ────────────────────────────────────────────────────────────────────────────

export type ChatPageHandle = {
  el: HTMLElement;
  /** 离开聊天页：中断流式请求，并在后台生成摘要与朋友圈（幂等） */
  beforeLeave: () => void;
  /** 收起手机：保留进行中的回复，仅在后台生成摘要与朋友圈（幂等） */
  beforeHide: () => void;
  /** 仅中断流式请求（换档等场景，不生成摘要） */
  abort: () => void;
};

export function renderChatPage(
  doc: Document,
  data: WechatData,
  char: CharacterChatData,
  callbacks: WechatCallbacks,
  onBack: () => void,
): ChatPageHandle {
  const wrap = el(doc, 'div', 'wc-page wc-chatpage');
  // 捕获本页所属存档的键：换档后的迟到写入仍落在原存档
  const historyKey = chatHistoryKeyOf(char.def.id);
  // 朋友圈冷却按角色独立：林清沿用旧键，新角色加后缀
  const momentsKey = phoneKey(char.def.id === 'linqing' ? 'moments-last:v1' : `moments-last:v1:${char.def.id}`);
  const promptInfo = { name: char.def.name, tone: char.def.phone.tone };
  const promptContext = {
    playerName: data.playerName,
    relationship: char.relationship,
    closeness: char.closeness,
    heartbeat: char.heartbeat,
    recentEvent: char.recentEvent,
    summaryHistory: char.summaryHistory,
    mood: char.mood,
    location: char.location,
    innerVoice: char.innerVoice,
    currentAction: char.currentAction,
    outfit: char.outfit,
  };
  const history = loadChatHistory(historyKey);
  let abortCtrl: AbortController | null = null;
  let generating = false;
  let left = false;

  // 顶栏
  const header = el(doc, 'div', 'wc-chat-header');
  const backBtn = el(doc, 'button', 'wc-icon-btn');
  backBtn.innerHTML = iconBack();
  backBtn.setAttribute('aria-label', '返回');

  const abortStream = () => {
    if (abortCtrl) abortCtrl.abort();
  };

  const startSync = () => {
    if (left) return;
    left = true;
    // 摘要和朋友圈在后台异步生成，不阻塞离开；朋友圈不依赖摘要结果
    if (history.filter(m => m.role !== 'system').length > 0) {
      const cfg = loadAiConfig();
      void summarizeConversation(cfg, history, char.def.name).then(summary => {
        if (summary) callbacks.onSyncSummary(char.def, summary);
      }).catch(() => { /* 摘要失败不影响朋友圈 */ }).finally(() => {
        // 朋友圈按卡内日期生成：离开谁的聊天，就轮到谁可以发一条（各角色独立一天一条）
        maybeGenerateMoment(cfg, char, data.storyDate, callbacks, momentsKey);
      });
    }
  };

  const beforeLeave = () => {
    if (left) return;
    abortStream();
    startSync();
  };

  const beforeHide = () => {
    startSync();
  };

  const handleBack = () => {
    beforeLeave();
    onBack();
  };

  backBtn.addEventListener('click', handleBack);
  header.appendChild(backBtn);

  const titleWrap = el(doc, 'div', 'wc-chat-header-title');
  titleWrap.appendChild(el(doc, 'span', 'wc-chat-title', char.def.name));
  const subtitleEl = el(doc, 'span', 'wc-chat-subtitle', `${char.relationship} · ${char.mood}`);
  titleWrap.appendChild(subtitleEl);
  header.appendChild(titleWrap);
  wrap.appendChild(header);

  // 消息区
  const msgArea = el(doc, 'div', 'wc-msg-area');
  wrap.appendChild(msgArea);

  // 同一故事时间连续发的消息只显示一次分割条
  let lastStamp = '';
  function appendStamp(date?: string, time?: string) {
    const stamp = formatChatStamp(date, time);
    if (!stamp || stamp === lastStamp) return;
    lastStamp = stamp;
    msgArea.appendChild(el(doc, 'div', 'wc-time-divider', stamp));
  }

  const commitHistory = () => {
    saveChatHistory(historyKey, history);
    callbacks.onHistoryChange(char.def, history);
  };

  function appendBubble(role: 'user' | 'assistant', text: string, streaming = false) {
    const row = el(doc, 'div', `wc-msg-row wc-msg-${role === 'user' ? 'out' : 'in'}`);
    if (role === 'assistant') {
      const av = el(doc, 'div', 'wc-bubble-avatar');
      av.innerHTML = avatarFor(char.def);
      row.appendChild(av);
    }
    const bubble = el(doc, 'div', `wc-bubble${streaming ? ' is-streaming' : ''}`, text);
    if (!streaming) applyBubbleEmojiStyle(bubble, text);
    row.appendChild(bubble);
    msgArea.appendChild(row);
    msgArea.scrollTop = msgArea.scrollHeight;
    return bubble;
  }

  history.filter(m => m.role !== 'system').forEach(m => {
    appendStamp(m.date, m.time);
    appendBubble(m.role as 'user' | 'assistant', m.content);
  });

  if (history.filter(m => m.role !== 'system').length === 0) {
    const greetHistory: ChatMessage[] = [
      { role: 'system', content: buildSystemPrompt(loadAiConfig(), promptInfo, promptContext) },
      { role: 'user', content: `[系统：玩家刚刚添加了${char.def.name}的微信，${char.def.name}主动发来第一条消息。请用 20 字以内发一条自然的打招呼消息，符合当前关系身份。]` },
    ];
    const greetAt = callbacks.getStoryTime();
    appendStamp(greetAt.date, greetAt.time);
    const bubble = appendBubble('assistant', '…');
    streamChat(loadAiConfig(), greetHistory, token => {
      if (bubble.textContent === '…') bubble.textContent = '';
      bubble.textContent += token;
      msgArea.scrollTop = msgArea.scrollHeight;
    }).then(full => {
      bubble.classList.remove('is-streaming');
      applyBubbleEmojiStyle(bubble, full);
      history.push({ role: 'assistant', content: full, ...greetAt });
      commitHistory();
    }).catch(() => {
      bubble.textContent = '[连接失败，请检查「设置」里的接口配置]';
      bubble.classList.remove('is-streaming');
    });
  }

  // 输入区
  const footer = el(doc, 'div', 'wc-chat-footer');
  const input = el(doc, 'textarea', 'wc-input');
  input.placeholder = '说点什么…';
  input.rows = 1;
  const autosizeInput = () => {
    input.style.height = 'auto';
    input.style.height = `${Math.min(input.scrollHeight, 96)}px`;
  };
  const insertToInput = (text: string) => {
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? start;
    input.value = input.value.slice(0, start) + text + input.value.slice(end);
    const pos = start + text.length;
    try {
      input.selectionStart = pos;
      input.selectionEnd = pos;
    } catch { /* 忽略 */ }
    input.focus();
    autosizeInput();
  };
  const emojiBtn = el(doc, 'button', 'wc-emoji-btn');
  emojiBtn.innerHTML = iconMood();
  emojiBtn.setAttribute('aria-label', '表情');
  const emojiPanel = buildEmojiPanel(doc, insertToInput);
  emojiBtn.addEventListener('click', () => emojiPanel.toggle());
  const sendBtn = el(doc, 'button', 'wc-send-btn');
  sendBtn.innerHTML = iconSend();
  sendBtn.setAttribute('aria-label', '发送');

  const sendMessage = async () => {
    const text = input.value.trim();
    if (!text || generating) return;
    input.value = '';
    input.style.height = '';
    generating = true;
    sendBtn.disabled = true;
    const sentAt = callbacks.getStoryTime();
    history.push({ role: 'user', content: text, ...sentAt });
    commitHistory();
    appendStamp(sentAt.date, sentAt.time);
    appendBubble('user', text);
    const cfg = loadAiConfig();
    const messages: ChatMessage[] = [
      { role: 'system', content: buildSystemPrompt(cfg, promptInfo, promptContext) },
      ...history.slice(-20).filter(m => m.role !== 'system'),
    ];
    const streamingBubble = appendBubble('assistant', '…', true);
    abortCtrl = new AbortController();
    try {
      const full = await streamChat(cfg, messages, token => {
        if (streamingBubble.textContent === '…') streamingBubble.textContent = '';
        streamingBubble.textContent += token;
        msgArea.scrollTop = msgArea.scrollHeight;
      }, abortCtrl.signal);
      streamingBubble.classList.remove('is-streaming');
      applyBubbleEmojiStyle(streamingBubble, full);
      history.push({ role: 'assistant', content: full, ...sentAt });
      commitHistory();
    } catch (err) {
      streamingBubble.textContent = String(err).includes('abort') ? '（已取消）' : `[失败：${String(err).slice(0, 30)}]`;
      streamingBubble.classList.remove('is-streaming');
    } finally {
      generating = false;
      sendBtn.disabled = false;
      abortCtrl = null;
    }
  };

  sendBtn.addEventListener('click', () => void sendMessage());
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void sendMessage(); }
  });
  input.addEventListener('input', autosizeInput);
  footer.appendChild(emojiBtn);
  footer.appendChild(input);
  footer.appendChild(sendBtn);
  wrap.appendChild(emojiPanel.el);
  wrap.appendChild(footer);
  return { el: wrap, beforeLeave, beforeHide, abort: abortStream };
}

// ────────────────────────────────────────────────────────────────────────────
// 表情面板（表情 / 颜文字，点选插入输入框）
// ────────────────────────────────────────────────────────────────────────────

function buildEmojiPanel(doc: Document, onPick: (text: string) => void): { el: HTMLElement; toggle: () => void } {
  const panel = el(doc, 'div', 'wc-emoji-panel');
  let mode: 'emoji' | 'kaomoji' = 'emoji';
  let groupIdx = 0;

  const head = el(doc, 'div', 'wc-emoji-head');
  const modes = el(doc, 'div', 'wc-emoji-modes');
  const emojiTab = el(doc, 'button', 'wc-emoji-mode', '表情');
  const kaoTab = el(doc, 'button', 'wc-emoji-mode', '颜文字');
  modes.appendChild(emojiTab);
  modes.appendChild(kaoTab);
  head.appendChild(modes);
  const doneBtn = el(doc, 'button', 'wc-emoji-done');
  doneBtn.innerHTML = iconDown();
  doneBtn.setAttribute('aria-label', '收起表情面板');
  doneBtn.addEventListener('click', () => panel.classList.remove('is-open'));
  head.appendChild(doneBtn);
  panel.appendChild(head);

  const chips = el(doc, 'div', 'wc-emoji-chips');
  panel.appendChild(chips);
  const grid = el(doc, 'div', 'wc-emoji-grid');
  panel.appendChild(grid);

  const currentGroups = () => (mode === 'emoji' ? EMOJI_GROUPS : KAOMOJI_GROUPS);

  const renderChips = () => {
    chips.innerHTML = '';
    currentGroups().forEach((group, index) => {
      const chip = el(doc, 'button', `wc-emoji-chip${index === groupIdx ? ' is-active' : ''}`, group.name);
      chip.addEventListener('click', () => {
        groupIdx = index;
        renderChips();
        renderGrid();
      });
      chips.appendChild(chip);
    });
  };

  const renderGrid = () => {
    grid.innerHTML = '';
    grid.classList.toggle('is-kaomoji', mode === 'kaomoji');
    const group = currentGroups()[groupIdx];
    group.items.forEach(item => {
      const cell = el(doc, 'button', 'wc-emoji-item', item);
      cell.addEventListener('click', () => onPick(item));
      grid.appendChild(cell);
    });
  };

  const setMode = (next: 'emoji' | 'kaomoji') => {
    if (mode === next) return;
    mode = next;
    groupIdx = 0;
    emojiTab.classList.toggle('is-active', mode === 'emoji');
    kaoTab.classList.toggle('is-active', mode === 'kaomoji');
    renderChips();
    renderGrid();
  };
  emojiTab.addEventListener('click', () => setMode('emoji'));
  kaoTab.addEventListener('click', () => setMode('kaomoji'));
  emojiTab.classList.add('is-active');

  renderChips();
  renderGrid();

  return {
    el: panel,
    toggle: () => panel.classList.toggle('is-open'),
  };
}

// 单独一条表情消息（纯 emoji / 短颜文字）在聊天里放大显示
const EMOJI_ONLY_RE = /^(?:\p{Extended_Pictographic}|\u200d|\uFE0F|\u{1F3FB}|\u{1F3FC}|\u{1F3FD}|\u{1F3FE}|\u{1F3FF}|\s)+$/u;

function isEmojiOnlyMessage(text: string): boolean {
  const t = text.trim();
  if (!t || t.length > 24) return false;
  if (EMOJI_ONLY_RE.test(t)) return true;
  if (/[\u4e00-\u9fff]/.test(t)) return false; // 含汉字的不算
  return /[（(][^（）()]{1,18}[）)]/.test(t); // 含成对括号的颜文字
}

function applyBubbleEmojiStyle(bubble: HTMLElement, text: string) {
  bubble.classList.toggle('is-emoji', isEmojiOnlyMessage(text));
}

function maybeGenerateMoment(
  config: AiConfig,
  char: CharacterChatData,
  storyDate: string,
  callbacks: WechatCallbacks,
  momentsKey: string,
) {
  const lastDate = getLastMomentDate(momentsKey);
  const specialEvent = /告白|约会|争吵|吵架|特别|难忘|第一次/.test(char.recentEvent);
  // 卡内每过一天最多一条；特殊事件允许同一天补发
  if (storyDate === lastDate && !specialEvent) return;
  // 先记日期防并发重复触发；生成失败时回退，避免白白跳过这一天
  setLastMomentDate(momentsKey, storyDate);
  void generateMoment(config, {
    charName: char.def.name,
    momentHint: char.def.phone.momentHint,
    mood: char.mood,
    relationship: char.relationship,
    recentEvent: char.recentEvent,
    storyDate,
  }).then(content => {
    if (!content) {
      setLastMomentDate(momentsKey, lastDate);
      return;
    }
    callbacks.onAddMoment({ 作者: char.def.name, 内容: content, 时间: storyDate, 心情: char.mood, 点赞数: 0 });
  }).catch(() => {
    setLastMomentDate(momentsKey, lastDate);
  });
}

// ────────────────────────────────────────────────────────────────────────────
// 好友页（通讯录）
// ────────────────────────────────────────────────────────────────────────────

export function renderContactsPage(doc: Document, data: WechatData, callbacks: WechatCallbacks): HTMLElement {
  const wrap = el(doc, 'div', 'wc-page wc-contacts');

  // 顶部搜索区域
  const searchWrap = el(doc, 'div', 'wc-search-wrap');
  const searchBar = el(doc, 'div', 'wc-search-bar');
  const searchIcon = el(doc, 'span', 'wc-search-icon');
  searchIcon.innerHTML = iconSearch();
  const searchInput = el(doc, 'input', 'wc-search-input');
  searchInput.placeholder = '搜索微信号 / 昵称';
  searchBar.appendChild(searchIcon);
  searchBar.appendChild(searchInput);
  searchWrap.appendChild(searchBar);
  wrap.appendChild(searchWrap);

  const resultArea = el(doc, 'div', 'wc-search-result');
  wrap.appendChild(resultArea);

  // 已添加好友列表
  const added = data.characters.filter(c => c.hasAdded);
  if (added.length > 0) {
    const section = el(doc, 'div', 'wc-friend-section');
    section.appendChild(el(doc, 'div', 'wc-section-label', '好友'));
    for (const char of added) {
      const item = el(doc, 'div', 'wc-contact-item');
      const avatar = el(doc, 'div', 'wc-item-avatar');
      avatar.innerHTML = avatarFor(char.def);
      const nameCol = el(doc, 'div', 'wc-contact-name-col');
      nameCol.appendChild(el(doc, 'span', 'wc-item-name', char.def.name));
      nameCol.appendChild(el(doc, 'span', 'wc-item-sub', char.def.phone.tagline));
      item.appendChild(avatar);
      item.appendChild(nameCol);
      section.appendChild(item);
    }
    wrap.appendChild(section);
  } else {
    // 空态引导
    const hint = el(doc, 'div', 'wc-contacts-hint');
    hint.innerHTML = `<span class="wc-hint-icon">✦</span><span>搜索「${CHARACTERS.map(c => c.name).join('」「')}」可以尝试添加好友</span>`;
    wrap.appendChild(hint);
  }

  // 搜索逻辑
  searchInput.addEventListener('input', () => {
    const q = searchInput.value.trim();
    resultArea.innerHTML = '';
    if (!q) return;

    const ql = q.toLowerCase();
    const matches = data.characters.filter(char => {
      const def = char.def;
      return def.name.includes(q) || def.phone.keywords.some(k => k.toLowerCase().includes(ql));
    });
    if (matches.length === 0) {
      resultArea.appendChild(el(doc, 'p', 'wc-no-result', '未找到相关用户'));
      return;
    }

    for (const char of matches) {
      const def = char.def;
      const card = el(doc, 'div', 'wc-search-card');

      // 左侧：头像 + 信息
      const cardLeft = el(doc, 'div', 'wc-search-card-left');
      const av = el(doc, 'div', 'wc-item-avatar');
      av.innerHTML = avatarFor(def);
      cardLeft.appendChild(av);
      const info = el(doc, 'div', 'wc-search-info');
      info.appendChild(el(doc, 'span', 'wc-item-name', def.name));
      info.appendChild(el(doc, 'span', 'wc-item-sub', def.phone.tagline));
      cardLeft.appendChild(info);
      card.appendChild(cardLeft);

      // 右侧：状态/按钮
      if (char.hasAdded) {
        const badge = el(doc, 'span', 'wc-badge wc-badge-added', '已添加 ✓');
        card.appendChild(badge);
      } else {
        // 关系不到位也能点申请——她会当真拒绝你，而不是界面上一开始就不让点
        const unlocked = relationAtLeast(char.relationship, def.phone.addGate);
        const rejected = char.addRejected && !unlocked;
        const lockWrap = el(doc, 'div', 'wc-lock-wrap');
        const addBtn = el(doc, 'button', `wc-add-btn${rejected ? ' is-rejected' : ''}`,
          rejected ? '对方拒绝了你的申请' : '添加好友');
        if (rejected) {
          addBtn.disabled = true;
          addBtn.setAttribute('aria-disabled', 'true');
          lockWrap.appendChild(el(doc, 'span', 'wc-lock-sub', '关系还不够近，再走近一点试试'));
        }
        addBtn.addEventListener('click', () => {
          if (addBtn.disabled) return;
          addBtn.disabled = true;
          addBtn.textContent = '申请中…';
          setTimeout(() => {
            if (unlocked) {
              callbacks.onAddFriend(def);
              addBtn.textContent = '已添加 ✓';
              addBtn.className = 'wc-add-btn is-done';
              return;
            }
            // 关系未到位：记录下来，不再重复放行
            callbacks.onAddRejected(def);
            addBtn.textContent = '对方拒绝了你的申请';
            addBtn.className = 'wc-add-btn is-rejected';
            addBtn.setAttribute('aria-disabled', 'true');
            if (!lockWrap.querySelector('.wc-lock-sub')) {
              lockWrap.appendChild(el(doc, 'span', 'wc-lock-sub', '关系还不够近，再走近一点试试'));
            }
          }, 1200);
        });
        lockWrap.appendChild(addBtn);
        card.appendChild(lockWrap);
      }

      resultArea.appendChild(card);
    }
  });

  return wrap;
}

// ────────────────────────────────────────────────────────────────────────────
// 朋友圈页
// ────────────────────────────────────────────────────────────────────────────

export function renderMomentsPage(
  doc: Document,
  data: WechatData,
  callbacks: WechatCallbacks,
): HTMLElement {
  const wrap = el(doc, 'div', 'wc-page wc-moments');

  // 顶部横幅：玩家自己的头像与名字（与真实微信一致；下方动态来自好友）
  const banner = el(doc, 'div', 'wc-moments-banner');
  const bannerCover = el(doc, 'div', 'wc-moments-cover');
  const bannerProfile = el(doc, 'div', 'wc-moments-profile');
  const bannerAvatar = el(doc, 'div', 'wc-moments-avatar');
  bannerAvatar.innerHTML = playerAvatar(data.playerName);
  const bannerNameCol = el(doc, 'div', 'wc-moments-name-col');
  bannerNameCol.appendChild(el(doc, 'span', 'wc-moments-name', data.playerName));
  bannerNameCol.appendChild(el(doc, 'span', 'wc-moments-tagline', ''));
  bannerProfile.appendChild(bannerAvatar);
  bannerProfile.appendChild(bannerNameCol);
  banner.appendChild(bannerCover);
  banner.appendChild(bannerProfile);
  wrap.appendChild(banner);

  const feed = el(doc, 'div', 'wc-feed');

  if (!data.characters.some(c => c.hasAdded)) {
    const hint = el(doc, 'div', 'wc-moments-locked');
    hint.innerHTML = `<span class="wc-lock-flower">✿</span><p>添加好友后可查看朋友圈</p>`;
    feed.appendChild(hint);
  } else if (data.moments.length === 0) {
    const hint = el(doc, 'div', 'wc-moments-locked');
    hint.innerHTML = `<span class="wc-lock-flower">✦</span><p>暂无动态</p>`;
    feed.appendChild(hint);
  } else {
    [...data.moments].reverse().forEach(moment => {
      const authorDef = defByName(moment.作者);
      const card = el(doc, 'div', 'wc-moment-card');
      const left = el(doc, 'div', 'wc-moment-left');
      const av = el(doc, 'div', 'wc-moment-avatar');
      av.innerHTML = avatarFor(authorDef);
      left.appendChild(av);
      card.appendChild(left);

      const right = el(doc, 'div', 'wc-moment-right');
      right.appendChild(el(doc, 'span', 'wc-moment-author', authorDef.name));
      right.appendChild(el(doc, 'p', 'wc-moment-text', moment.内容));

      const meta = el(doc, 'div', 'wc-moment-meta');
      if (moment.心情) meta.appendChild(el(doc, 'span', 'wc-moment-mood', moment.心情));
      meta.appendChild(el(doc, 'span', 'wc-moment-time', moment.时间));
      right.appendChild(meta);

      const actions = el(doc, 'div', 'wc-moment-actions');
      const likeBtn = el(doc, 'button', 'wc-action-btn');
      likeBtn.innerHTML = iconHeart();
      const likeCount = el(doc, 'span', 'wc-like-count', String(moment.点赞数));
      likeBtn.addEventListener('click', () => {
        moment.点赞数 += 1;
        likeCount.textContent = String(moment.点赞数);
        callbacks.onAddMoment({ ...moment, 作者: authorDef.name });
      });
      actions.appendChild(likeBtn);
      actions.appendChild(likeCount);
      const commentBtn = el(doc, 'button', 'wc-action-btn');
      commentBtn.innerHTML = iconComment();
      commentBtn.title = '评论';
      actions.appendChild(commentBtn);
      right.appendChild(actions);
      card.appendChild(right);
      feed.appendChild(card);
    });
  }

  wrap.appendChild(feed);
  return wrap;
}

// ────────────────────────────────────────────────────────────────────────────
// 设置页
// ────────────────────────────────────────────────────────────────────────────

export function renderSettingsPage(doc: Document, describeViewport?: () => string): HTMLElement {
  const wrap = el(doc, 'div', 'wc-page wc-settings-page');
  const config = loadAiConfig();

  wrap.appendChild(sectionTitle('AI 聊天接口'));

  const tipEl = el(doc, 'div', 'wc-config-tip');
  tipEl.innerHTML = '填写任意 OpenAI 兼容接口，支持 Gemini、Claude、DeepSeek、本地部署等。输入后自动保存。';
  wrap.appendChild(tipEl);

  wrap.appendChild(settingRow('接口地址', 'text', config.baseUrl, val => { config.baseUrl = val; saveAiConfig(config); }, 'https://your-api.example.com/v1'));
  wrap.appendChild(settingRow('API Key', 'password', config.apiKey, val => { config.apiKey = val; saveAiConfig(config); }, 'sk-… （无需鉴权可留空）'));
  wrap.appendChild(settingRow('模型', 'text', config.model, val => { config.model = val; saveAiConfig(config); }, 'gpt-4o-mini / gemini-2.0-flash 等'));

  const testRow = el(doc, 'div', 'wc-setting-row');
  const testBtn = el(doc, 'button', 'wc-test-btn', '测试连接');
  const testResult = el(doc, 'span', 'wc-test-result');
  testBtn.addEventListener('click', () => {
    testBtn.disabled = true;
    testBtn.textContent = '连接中…';
    testResult.textContent = '';
    testResult.className = 'wc-test-result';
    testConnection(loadAiConfig()).then(({ ok, message }) => {
      testResult.textContent = message;
      testResult.classList.add(ok ? 'is-ok' : 'is-err');
    }).catch(err => {
      testResult.textContent = String(err).slice(0, 80);
      testResult.classList.add('is-err');
    }).finally(() => {
      testBtn.disabled = false;
      testBtn.textContent = '测试连接';
    });
  });
  testRow.appendChild(testBtn);
  testRow.appendChild(testResult);
  wrap.appendChild(testRow);

  const advToggle = el(doc, 'details', 'wc-advanced');
  const summary = el(doc, 'summary', 'wc-adv-toggle', '高级设置');
  advToggle.appendChild(summary);
  advToggle.appendChild(settingRow('System Prompt 前缀', 'textarea', config.systemPromptPrefix, val => { config.systemPromptPrefix = val; saveAiConfig(config); }, '留空使用角色默认人设'));
  wrap.appendChild(advToggle);

  wrap.appendChild(sectionTitle('关于'));
  const about = el(doc, 'div', 'wc-about');
  about.innerHTML = `<p>聊天记录仅存储在本设备，不会上传。</p><p>API Key 保存在 localStorage。</p>`;
  wrap.appendChild(about);

  if (describeViewport) {
    wrap.appendChild(sectionTitle('键盘诊断'));
    const diag = el(doc, 'div', 'wc-viewport-diag');
    const refresh = () => {
      diag.textContent = describeViewport();
    };
    refresh();
    const timer = setInterval(refresh, 500);
    wrap.addEventListener('wc-dispose', () => clearInterval(timer));
    wrap.appendChild(diag);
  }

  return wrap;

  function sectionTitle(text: string) {
    return el(doc, 'div', 'wc-section-title', text);
  }

  function settingRow(
    label: string,
    type: 'text' | 'password' | 'textarea',
    value: string,
    onChange: (v: string) => void,
    placeholder?: string,
  ) {
    const row = el(doc, 'div', 'wc-setting-row');
    row.appendChild(el(doc, 'label', 'wc-setting-label', label));
    if (type === 'textarea') {
      const ta = el(doc, 'textarea', 'wc-setting-input wc-setting-ta');
      ta.value = value;
      ta.placeholder = placeholder ?? '';
      ta.rows = 3;
      ta.addEventListener('input', () => onChange(ta.value));
      row.appendChild(ta);
    } else {
      const inp = el(doc, 'input', 'wc-setting-input');
      inp.type = type;
      inp.value = value;
      inp.placeholder = placeholder ?? '';
      inp.addEventListener('input', () => onChange(inp.value));
      row.appendChild(inp);
    }
    return row;
  }
}

export { iconSettings, iconMore };
