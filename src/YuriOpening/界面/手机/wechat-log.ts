/**
 * wechat-log.ts
 * 把当前存档的微信聊天记录（带故事内时间）同步到角色卡绑定世界书的「微信记录」条目。
 * 世界书跨存档共享：换档时会用新存档的记录整体覆盖；没有记录时条目置为禁用。
 */

import type { ChatMessage } from './ai-client';

const LOG_ENTRY_NAME = '微信记录';
// 只在包含这条卡内条目的世界书里写，防止误写到其他角色卡的世界书
const CARD_MARKER_ENTRY = '微信联动';
const MAX_LOG_LINES = 30;

let writeChain: Promise<void> = Promise.resolve();
let lastWritten: string | null = null;

function isUnset(value: string | undefined): boolean {
  return !value || value === '待设定';
}

function stampOf(m: ChatMessage): string {
  const parts = [m.date, m.time].filter(v => !isUnset(v));
  return parts.length > 0 ? `[${parts.join(' ')}] ` : '';
}

export type WechatChat = { name: string; messages: ChatMessage[] };

export function buildWechatLog(chats: WechatChat[], playerName: string): string {
  const blocks: string[] = [];
  for (const chat of chats) {
    const lines = chat.messages
      .filter(m => m.role !== 'system' && m.content.trim())
      .slice(-MAX_LOG_LINES)
      .map(m => `${stampOf(m)}${m.role === 'user' ? playerName : chat.name}：${m.content.trim()}`);
    if (lines.length === 0) continue;
    blocks.push([
      `<wechat_log between="${playerName}" and="${chat.name}">`,
      `以下是${playerName}与${chat.name}在微信上的聊天记录，方括号内为发送时的故事时间（日期 时间）。`,
      ...lines,
      '</wechat_log>',
    ].join('\n'));
  }
  return blocks.join('\n\n');
}

async function writeLog(content: string): Promise<void> {
  if (
    typeof getCharWorldbookNames !== 'function' ||
    typeof getWorldbook !== 'function' ||
    typeof createWorldbookEntries !== 'function' ||
    typeof updateWorldbookWith !== 'function'
  ) {
    return;
  }
  const books = getCharWorldbookNames('current');
  const worldbookName = books.primary ?? books.additional[0];
  if (!worldbookName) return;

  const entries = await getWorldbook(worldbookName);
  if (!entries.some(item => item.name === CARD_MARKER_ENTRY)) return;

  const existing = entries.find(item => item.name === LOG_ENTRY_NAME);
  const enabled = content !== '';
  if (!existing && !enabled) return;
  if (
    existing &&
    existing.content === content &&
    existing.enabled === enabled &&
    existing.position.type === 'at_depth' &&
    existing.position.depth === 1 &&
    existing.position.order === 35
  ) {
    return;
  }

  const entry: TypeFest.PartialDeep<WorldbookEntry> = {
    name: LOG_ENTRY_NAME,
    enabled,
    content,
    probability: 100,
    strategy: {
      type: 'constant',
      keys: [],
      keys_secondary: { logic: 'and_any', keys: [] },
      scan_depth: 'same_as_global',
    },
    position: {
      type: 'at_depth',
      role: 'system',
      depth: 1,
      order: 35,
    },
  };

  if (existing) {
    await updateWorldbookWith(worldbookName, list =>
      list.map(item => (item.name === LOG_ENTRY_NAME ? { ...item, ...entry } : item)),
    );
  } else {
    await createWorldbookEntries(worldbookName, [entry]);
  }
}

/** 串行写入，内容未变时跳过；失败只记日志，不影响手机使用 */
export function syncWechatLogToWorldbook(chats: WechatChat[], playerName: string): Promise<void> {
  const content = buildWechatLog(chats, playerName);
  writeChain = writeChain.then(async () => {
    if (content === lastWritten) return;
    try {
      await writeLog(content);
      lastWritten = content;
    } catch (err) {
      console.warn('[百合花期] 微信记录同步世界书失败', err);
    }
  });
  return writeChain;
}
