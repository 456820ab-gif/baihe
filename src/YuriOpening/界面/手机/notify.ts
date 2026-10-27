/**
 * notify.ts — 手机的通知、未读与已读游标
 *
 * 只负责数据：每个聊天的未读数、通知条目、已读游标与去重键。
 * 存储键按存档隔离（storage.ts）；DOM 渲染与 MVU 写回留在 index.ts，
 * 通过 initNotify 的 mirror / onChange 回调对接。
 */

import type { CharacterId } from '../../characters';
import { phoneKey } from './storage';

export type PhoneNotice = {
  id: string;
  charId: CharacterId;
  charName: string;
  preview: string;
  at: number;
  kind: 'message' | 'moment' | 'system';
};

/** 入站消息：对话页写进本地记录的那条（只用到这几个字段） */
export type InboundMessage = {
  role?: string;
  content?: string;
  date?: string;
  time?: string;
};

type NotifyState = {
  /** 每个聊天的未读数 */
  unread: Partial<Record<CharacterId, number>>;
  /** 通知条目，最新在前 */
  notices: PhoneNotice[];
  /** 已读游标：该聊天已读到的通知时间戳 */
  cursor: Partial<Record<CharacterId, number>>;
  /** 去重键环形缓冲（charId|role|date|time|content） */
  seen: string[];
};

const MAX_NOTICES = 40;
const MAX_SEEN = 200;
const MIRROR_DELAY = 400;
const PREVIEW_LEN = 42;

let state: NotifyState = emptyState();
let loadedKey = '';
let mirrorTimer: ReturnType<typeof setTimeout> | null = null;
let mirrorFn: ((total: number) => void) | null = null;
let changeFn: (() => void) | null = null;

function emptyState(): NotifyState {
  return { unread: {}, notices: [], cursor: {}, seen: [] };
}

function storageKey(): string {
  return phoneKey('notify:v1');
}

function normalize(raw: unknown): NotifyState {
  const next = emptyState();
  if (!raw || typeof raw !== 'object') return next;
  const data = raw as Partial<NotifyState>;
  if (data.unread && typeof data.unread === 'object') {
    for (const [id, value] of Object.entries(data.unread)) {
      const n = Number(value);
      if (Number.isFinite(n) && n > 0) next.unread[id as CharacterId] = Math.floor(n);
    }
  }
  if (data.cursor && typeof data.cursor === 'object') {
    for (const [id, value] of Object.entries(data.cursor)) {
      const n = Number(value);
      if (Number.isFinite(n)) next.cursor[id as CharacterId] = n;
    }
  }
  if (Array.isArray(data.notices)) {
    next.notices = data.notices
      .filter(n => n && typeof n === 'object' && typeof n.charId === 'string')
      .slice(0, MAX_NOTICES);
  }
  if (Array.isArray(data.seen)) {
    next.seen = data.seen.filter((k): k is string => typeof k === 'string').slice(-MAX_SEEN);
  }
  return next;
}

/** 读到当前存档的状态；换档（键变化）时自动重读 */
function ensureLoaded(): void {
  const key = storageKey();
  if (key === loadedKey) return;
  loadedKey = key;
  try {
    const raw = localStorage.getItem(key);
    state = raw ? normalize(JSON.parse(raw)) : emptyState();
  } catch {
    state = emptyState();
  }
}

function persist(): void {
  try {
    localStorage.setItem(storageKey(), JSON.stringify(state));
  } catch {
    /* 配额或隐私模式：内存态继续可用 */
  }
}

/** 未读数镜像到 微信._未读数：防抖，避免流式提交期间反复写 MVU */
function scheduleMirror(): void {
  if (!mirrorFn) return;
  if (mirrorTimer !== null) clearTimeout(mirrorTimer);
  mirrorTimer = setTimeout(() => {
    mirrorTimer = null;
    mirrorFn?.(getUnreadTotal());
  }, MIRROR_DELAY);
}

function commit(): void {
  persist();
  changeFn?.();
  scheduleMirror();
}

function dedupeKey(charId: CharacterId, role: string, date: string, time: string, content: string): string {
  return `${charId}|${role}|${date}|${time}|${content}`;
}

function previewOf(content: string): string {
  const flat = content.replace(/\s+/g, ' ').trim();
  return flat.length > PREVIEW_LEN ? `${flat.slice(0, PREVIEW_LEN)}…` : flat;
}

/**
 * 挂载通知层：mirror 接收防抖后的未读总数（写回 MVU），
 * onChange 在未读/通知变化时触发（刷新角标、就地重渲通知中心）。
 */
export function initNotify(opts: {
  mirror?: (total: number) => void;
  onChange?: () => void;
}): void {
  mirrorFn = opts.mirror ?? null;
  changeFn = opts.onChange ?? null;
  resetNotify();
}

/** 换档或重新挂载：丢弃内存态，按当前存档重新读盘并同步一次镜像 */
export function resetNotify(): void {
  state = emptyState();
  loadedKey = '';
  ensureLoaded();
  changeFn?.();
  scheduleMirror();
}

export function destroyNotify(): void {
  if (mirrorTimer !== null) {
    clearTimeout(mirrorTimer);
    mirrorTimer = null;
  }
  mirrorFn = null;
  changeFn = null;
}

export function getUnreadTotal(): number {
  ensureLoaded();
  let total = 0;
  for (const n of Object.values(state.unread)) {
    if (typeof n === 'number' && n > 0) total += n;
  }
  return total;
}

export function getUnreadOf(charId: CharacterId): number {
  ensureLoaded();
  return state.unread[charId] ?? 0;
}

/** 聊天列表用的未读快照 */
export function unreadMap(): Partial<Record<CharacterId, number>> {
  ensureLoaded();
  return { ...state.unread };
}

export function listNotices(): PhoneNotice[] {
  ensureLoaded();
  return [...state.notices];
}

export function cursorOf(charId: CharacterId): number {
  ensureLoaded();
  return state.cursor[charId] ?? 0;
}

/**
 * 入站消息记一条通知。
 * unread=false 表示玩家正看着这条聊天：条目仍留档，但直接算已读、不计未读。
 * 返回 null 表示重复（同角色 + 角色位 + 日期 + 时间 + 内容已有记录）。
 */
export function pushInbound(
  charId: CharacterId,
  charName: string,
  message: InboundMessage,
  opts: { unread?: boolean; at?: number } = {},
): PhoneNotice | null {
  ensureLoaded();
  const content = (message.content ?? '').trim();
  if (!content) return null;
  const key = dedupeKey(charId, message.role ?? '', message.date ?? '', message.time ?? '', content);
  if (state.seen.includes(key)) return null;

  const at = opts.at ?? Date.now();
  const notice: PhoneNotice = {
    id: `${charId}-${at}-${state.seen.length}`,
    charId,
    charName,
    preview: previewOf(content),
    at,
    kind: 'message',
  };
  state.seen = [...state.seen, key].slice(-MAX_SEEN);
  state.notices = [notice, ...state.notices].slice(0, MAX_NOTICES);

  if (opts.unread === false) {
    state.cursor = { ...state.cursor, [charId]: Math.max(cursorOf(charId), at) };
  } else {
    state.unread = { ...state.unread, [charId]: getUnreadOf(charId) + 1 };
  }
  commit();
  return notice;
}

/** 打开某个聊天：只清这个聊天的未读，并把游标推到最新通知 */
export function markChatRead(charId: CharacterId): void {
  ensureLoaded();
  let latest = cursorOf(charId);
  for (const notice of state.notices) {
    if (notice.charId === charId && notice.at > latest) latest = notice.at;
  }
  state.unread = { ...state.unread, [charId]: 0 };
  state.cursor = { ...state.cursor, [charId]: latest };
  commit();
}

/** 全部已读：清空所有聊天未读，游标推到各聊天最新一条通知 */
export function markAllRead(): void {
  ensureLoaded();
  const unread: Partial<Record<CharacterId, number>> = {};
  const cursor: Partial<Record<CharacterId, number>> = { ...state.cursor };
  for (const notice of state.notices) {
    if (notice.at > (cursor[notice.charId] ?? 0)) cursor[notice.charId] = notice.at;
  }
  for (const id of Object.keys(state.unread) as CharacterId[]) unread[id] = 0;
  state.unread = unread;
  state.cursor = cursor;
  commit();
}
