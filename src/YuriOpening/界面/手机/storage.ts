/**
 * storage.ts — 手机模块的本地存储键管理
 *
 * AI 配置跨存档共用（在 ai-client.ts）；其余状态按聊天存档隔离，
 * 新开聊天或切换存档时自动切换到对应存档的数据，与卡片变量同样"随档重置"。
 */

const PREFIX = 'YuriOpening:phone';

let chatKey: string | null = null;
let generation = 0;

/** 当前聊天存档的标识（聊天文件名） */
export function getCurrentChatId(): string {
  try {
    const id = SillyTavern.getCurrentChatId();
    if (typeof id === 'string' && id) return id;
  } catch { /* 继续尝试父页面 */ }
  try {
    const st = (window.parent as unknown as { SillyTavern?: { getCurrentChatId?: () => string } }).SillyTavern;
    const id = st?.getCurrentChatId?.();
    if (typeof id === 'string' && id) return id;
  } catch { /* 跨域或接口变化 */ }
  return 'default';
}

/** 当前存档下的存储键 */
export function phoneKey(suffix: string): string {
  if (chatKey === null) chatKey = getCurrentChatId();
  return `${PREFIX}:${chatKey}:${suffix}`;
}

/** 切换存档：使键缓存失效并递增代际，供旧存档的异步回调比对丢弃 */
export function invalidateChatKey() {
  chatKey = null;
  generation += 1;
}

/** 存储代际：回调创建时捕获，写回前比对，避免旧存档操作污染新存档 */
export function getStorageGeneration(): number {
  return generation;
}
