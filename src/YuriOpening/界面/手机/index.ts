/**
 * index.ts — 手机模块主入口
 *
 * 职责：
 * 1. 在宿主文档注入悬浮手机按钮（.phone-fab）
 * 2. 按钮点击弹出/收起手机外壳（.phone-shell）
 * 3. 从 MVU 读取游戏数据，传给 wechat.ts 渲染四个页面
 * 4. 四页路由（聊天/好友/朋友圈/设置）与对话子路由
 * 5. 通过 Mvu.replaceMvuData 把摘要写回消息层变量；聊天记录同步到世界书「微信记录」（wechat-log.ts）
 * 6. 监听 MVU 事件，收到更新时刷新手机数据
 * 7. 本地状态按聊天存档隔离，换档时自动切换（storage.ts）
 */

import phoneCss from './style.scss?raw';
import {
  iconBattery,
  iconChat,
  iconClose,
  iconContacts,
  iconMoments,
  iconPhone,
  iconSettings,
  iconShellExpand,
  iconShellShrink,
  iconWifiBar,
} from './phone-icons';
import { phoneKey, invalidateChatKey, getStorageGeneration, getCurrentChatId } from './storage';
import { CHARACTERS, type CharacterId, relationAtLeast } from '../../characters';
import {
  type CharacterChatData,
  type ChatPageHandle,
  type WechatCallbacks,
  type WechatData,
  renderChatList,
  renderChatPage,
  renderContactsPage,
  renderMomentsPage,
  renderSettingsPage,
  loadChatHistory,
  chatHistoryKeyOf,
} from './wechat';
import { syncWechatLogToWorldbook } from './wechat-log';

// ────────────────────────────────────────────────────────────────────────────
// 常量
// ────────────────────────────────────────────────────────────────────────────

type TabId = 'chat' | 'contacts' | 'moments' | 'settings';

const TAB_ITEMS: Array<{ id: TabId; icon: () => string; label: string }> = [
  { id: 'chat', icon: iconChat, label: '微信' },
  { id: 'contacts', icon: iconContacts, label: '通讯录' },
  { id: 'moments', icon: iconMoments, label: '朋友圈' },
  { id: 'settings', icon: iconSettings, label: '设置' },
];

// ────────────────────────────────────────────────────────────────────────────
// 状态
// ────────────────────────────────────────────────────────────────────────────

// 添加好友 / 被拒的本地标记：按角色 + 按存档隔离；林清沿用旧键，老存档无缝
const localAddedFlags = new Map<CharacterId, boolean>();
const localRejectedFlags = new Map<CharacterId, boolean>();

function localFlagKey(id: CharacterId, base: 'hasAdded:v1' | 'addRejected:v1'): string {
  return id === 'linqing' ? phoneKey(base) : phoneKey(`${base}:${id}`);
}

function readLocalFlag(id: CharacterId, base: 'hasAdded:v1' | 'addRejected:v1'): boolean {
  try { return localStorage.getItem(localFlagKey(id, base)) === 'true'; } catch { return false; }
}

function writeLocalFlag(id: CharacterId, base: 'hasAdded:v1' | 'addRejected:v1', v: boolean) {
  try { localStorage.setItem(localFlagKey(id, base), v ? 'true' : 'false'); } catch { /* 静默 */ }
}

function loadAllLocalFlags() {
  for (const def of CHARACTERS) {
    localAddedFlags.set(def.id, readLocalFlag(def.id, 'hasAdded:v1'));
    localRejectedFlags.set(def.id, readLocalFlag(def.id, 'addRejected:v1'));
  }
}

// 小窗 / 全屏模式：界面偏好，用全局键跨档共用（与悬浮按钮位置同逻辑）
type ShellMode = 'full' | 'mini';
const SHELL_MODE_KEY = 'YuriOpening:phone:shell-mode:v1';

function loadShellMode(): ShellMode {
  try { return localStorage.getItem(SHELL_MODE_KEY) === 'mini' ? 'mini' : 'full'; } catch { return 'full'; }
}

function saveShellMode(mode: ShellMode) {
  try { localStorage.setItem(SHELL_MODE_KEY, mode); } catch { /* 静默 */ }
}

// 小窗位置：拖动后按全局键记住（同样跨档共用）；缺省时居中偏上
const SHELL_POS_KEY = 'YuriOpening:phone:shell-pos:v1';

function loadShellPos(): { left: number; top: number } | null {
  try {
    const raw = localStorage.getItem(SHELL_POS_KEY);
    if (!raw) return null;
    const pos = JSON.parse(raw) as { left?: unknown; top?: unknown };
    const left = Number(pos?.left);
    const top = Number(pos?.top);
    return Number.isFinite(left) && Number.isFinite(top) ? { left, top } : null;
  } catch { return null; }
}

function saveShellPos(pos: { left: number; top: number }) {
  try { localStorage.setItem(SHELL_POS_KEY, JSON.stringify(pos)); } catch { /* 静默 */ }
}

let active = true;
let phoneOpen = false;
let activeTab: TabId = 'chat';
let inChatPage = false;
let chatHandle: ChatPageHandle | null = null;
let shellMode: ShellMode = loadShellMode();
let shellPos: { left: number; top: number } | null = loadShellPos();
let modeBtn: HTMLElement | null = null;
let fab: HTMLElement | null = null;
let shell: HTMLElement | null = null;
let contentArea: HTMLElement | null = null;
let badge: HTMLElement | null = null;
let statusTime: HTMLElement | null = null;
const disposers: Array<() => void> = [];

// ────────────────────────────────────────────────────────────────────────────
// 读 MVU 数据
// ────────────────────────────────────────────────────────────────────────────

type CharRaw = {
  关系身份?: string;
  亲近?: number | string;
  心动?: number | string;
  心情?: string;
  所在地点?: string;
  心声?: string;
  当前行动?: string;
  当前穿着?: string;
};

type MvuRaw = {
  玩家?: { _姓名?: string };
  林清?: CharRaw;
  苏玥?: CharRaw;
  微信?: {
    _未读数?: number;
    _朋友圈?: Array<{ 作者?: string; 内容: string; 时间: string; 心情: string; 点赞数: number }>;
    [key: string]: unknown;
  };
  环境?: { 日期?: string; 时间?: string };
};

function readMvu(): MvuRaw {
  try {
    const mvuData = Mvu.getMvuData({ type: 'message', message_id: 'latest' });
    return (mvuData.stat_data ?? {}) as MvuRaw;
  } catch {
    return {};
  }
}

/** 酒馆用户设定名（等价于 {{user}} 展开的内容），取不到返回空串 */
function readStPersonaName(): string {
  const pick = (value: unknown): string => (typeof value === 'string' && value.trim() ? value.trim() : '');
  type StHost = { SillyTavern?: { getContext?: () => { name1?: unknown }; name1?: unknown }; name1?: unknown };
  const probe = (win: Window): string => {
    const host = win as unknown as StHost;
    const fromContext = pick(host.SillyTavern?.getContext?.().name1);
    if (fromContext) return fromContext;
    const direct = pick(host.SillyTavern?.name1);
    if (direct) return direct;
    return pick(host.name1);
  };
  try {
    const fromHost = probe(window.parent);
    if (fromHost) return fromHost;
  } catch { /* 跨域时忽略 */ }
  try {
    if (window.parent !== window) return probe(window);
  } catch { /* 忽略 */ }
  return '';
}

/** 玩家名字：开局表单的 玩家._姓名 优先；空或「未命名」时退回酒馆用户名（{{user}} 等价物）；最后兜底「你」 */
function resolvePlayerName(raw: MvuRaw): string {
  const formName = raw.玩家?._姓名?.trim();
  if (formName && formName !== '未命名') return formName;
  return readStPersonaName() || '你';
}

function buildWechatData(raw: MvuRaw): WechatData {
  const wx = raw.微信 ?? {};
  const groups = raw as unknown as Record<string, CharRaw | undefined>;
  const characters: CharacterChatData[] = CHARACTERS.map(def => {
    const group = groups[def.varRoot] ?? {};
    const relationship = group.关系身份 ?? '待设定';
    // 关系到位后，之前的拒绝记录自动失效（她会重新考虑你）
    if (localRejectedFlags.get(def.id) && relationAtLeast(relationship, def.phone.addGate)) {
      localRejectedFlags.set(def.id, false);
      writeLocalFlag(def.id, 'addRejected:v1', false);
    }
    const summaryRaw = wx[def.phone.fields.summaryHistory];
    return {
      def,
      relationship,
      closeness: group.亲近 ?? '待设定',
      heartbeat: group.心动 ?? '待设定',
      recentEvent: (wx[def.phone.fields.knownEvents] as string | undefined) ?? '',
      summaryHistory: Array.isArray(summaryRaw) ? (summaryRaw as string[]) : [],
      // 本地标记优先：添加好友后即时生效，不等 MVU 写回同步
      hasAdded: Boolean(localAddedFlags.get(def.id)) || wx[def.phone.fields.added] === true,
      addRejected: Boolean(localRejectedFlags.get(def.id)),
      mood: group.心情 ?? '平静',
      location: group.所在地点 ?? '',
      innerVoice: group.心声 ?? '',
      currentAction: group.当前行动 ?? '',
      outfit: group.当前穿着 ?? '',
    };
  });
  return {
    playerName: resolvePlayerName(raw),
    storyDate: raw.环境?.日期 || '待设定',
    moments: (wx._朋友圈 ?? []).map(m => ({
      作者: m.作者 ?? '林清',
      内容: m.内容,
      时间: m.时间,
      心情: m.心情,
      点赞数: m.点赞数,
    })),
    characters,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// 写回 MVU 消息层变量（get → 修改 → replace，与主线 AI 读到的是同一层）
// ────────────────────────────────────────────────────────────────────────────

function updateMvu(mutate: (wx: Record<string, unknown>) => void): Promise<void> {
  try {
    const mvu = Mvu.getMvuData({ type: 'message', message_id: 'latest' });
    if (!mvu.stat_data.微信) mvu.stat_data.微信 = {};
    mutate(mvu.stat_data.微信 as Record<string, unknown>);
    return Mvu.replaceMvuData(mvu, { type: 'message', message_id: 'latest' }).catch(() => { /* 写回失败静默 */ });
  } catch {
    /* MVU 不可用时静默 */
    return Promise.resolve();
  }
}

// ────────────────────────────────────────────────────────────────────────────
// 悬浮按钮
// ────────────────────────────────────────────────────────────────────────────

// 悬浮按钮位置：全局保存（跨档共用），拖动后自动持久化

const FAB_POS_KEY = 'YuriOpening:phone:fab-pos:v1';
let fabSuppressClick = false;

function loadFabPos(): { left: number; top: number } | null {
  try {
    const raw = localStorage.getItem(FAB_POS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { left?: unknown; top?: unknown };
    if (typeof parsed.left === 'number' && typeof parsed.top === 'number') {
      return { left: parsed.left, top: parsed.top };
    }
  } catch { /* 静默 */ }
  return null;
}

function saveFabPos(pos: { left: number; top: number }) {
  try { localStorage.setItem(FAB_POS_KEY, JSON.stringify(pos)); } catch { /* 静默 */ }
}

function applyFabPos(pos: { left: number; top: number }) {
  if (!fab) return;
  const hostWin = hostDoc().defaultView ?? window;
  const rect = fab.getBoundingClientRect();
  const margin = 4;
  const maxLeft = Math.max(margin, hostWin.innerWidth - rect.width - margin);
  const maxTop = Math.max(margin, hostWin.innerHeight - rect.height - margin);
  const left = Math.min(Math.max(margin, pos.left), maxLeft);
  const top = Math.min(Math.max(margin, pos.top), maxTop);
  fab.style.left = `${left}px`;
  fab.style.top = `${top}px`;
  fab.style.right = 'auto';
  fab.style.bottom = 'auto';
}

function enableFabDrag(btn: HTMLElement) {
  const DRAG_THRESHOLD = 5;
  let dragging = false;
  let moved = false;
  let pointerId = -1;
  let startX = 0;
  let startY = 0;
  let originLeft = 0;
  let originTop = 0;

  const finish = () => {
    if (!dragging) return;
    dragging = false;
    btn.classList.remove('is-dragging');
    if (pointerId >= 0) {
      try { btn.releasePointerCapture(pointerId); } catch { /* 静默 */ }
    }
    pointerId = -1;
    if (moved) {
      const rect = btn.getBoundingClientRect();
      saveFabPos({ left: rect.left, top: rect.top });
      // 抑制拖动结束后浏览器补发的 click
      fabSuppressClick = true;
    }
  };

  btn.addEventListener('pointerdown', (e: PointerEvent) => {
    if (dragging) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    dragging = true;
    moved = false;
    fabSuppressClick = false;
    pointerId = e.pointerId;
    startX = e.clientX;
    startY = e.clientY;
    const rect = btn.getBoundingClientRect();
    originLeft = rect.left;
    originTop = rect.top;
    try { btn.setPointerCapture(pointerId); } catch { /* 静默 */ }
  });

  btn.addEventListener('pointermove', (e: PointerEvent) => {
    if (!dragging || e.pointerId !== pointerId) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if (!moved) {
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      moved = true;
      btn.classList.add('is-dragging');
    }
    applyFabPos({ left: originLeft + dx, top: originTop + dy });
  });

  const onPointerEnd = (e: PointerEvent) => {
    if (e.pointerId !== pointerId) return;
    finish();
  };
  btn.addEventListener('pointerup', onPointerEnd);
  btn.addEventListener('pointercancel', onPointerEnd);

  btn.addEventListener('click', () => {
    if (fabSuppressClick) {
      fabSuppressClick = false;
      return;
    }
    togglePhone();
  });
}

function buildFab(): HTMLElement {
  const btn = document.createElement('button');
  btn.className = 'phone-fab';
  btn.setAttribute('aria-label', '打开手机');
  btn.innerHTML = iconPhone();
  badge = document.createElement('span');
  badge.className = 'phone-fab-badge';
  badge.setAttribute('aria-hidden', 'true');
  btn.appendChild(badge);
  enableFabDrag(btn);
  return btn;
}

function updateBadge(count: number) {
  if (!badge) return;
  badge.textContent = count > 0 ? String(Math.min(count, 99)) : '';
  badge.style.display = count > 0 ? '' : 'none';
}

// ────────────────────────────────────────────────────────────────────────────
// 手机外壳
// ────────────────────────────────────────────────────────────────────────────

function buildShell(): HTMLElement {
  const s = document.createElement('div');
  s.className = 'phone-shell';
  s.setAttribute('role', 'dialog');
  s.setAttribute('aria-label', '手机');

  // 状态栏
  const statusBar = document.createElement('div');
  statusBar.className = 'phone-status-bar';
  statusTime = document.createElement('span');
  statusTime.className = 'phone-time';
  updateStatusTime();
  statusBar.appendChild(statusTime);
  const icons = document.createElement('div');
  icons.className = 'phone-status-icons';
  icons.innerHTML = iconWifiBar() + iconBattery();
  statusBar.appendChild(icons);
  s.appendChild(statusBar);
  enableShellDrag(statusBar);

  // 内容区
  contentArea = document.createElement('div');
  contentArea.className = 'phone-content';
  s.appendChild(contentArea);

  // 底部导航
  const navbar = document.createElement('div');
  navbar.className = 'phone-navbar';
  TAB_ITEMS.forEach(tab => {
    const btn = document.createElement('button');
    btn.className = `phone-tab${tab.id === activeTab ? ' is-active' : ''}`;
    btn.dataset.tab = tab.id;
    btn.setAttribute('aria-label', tab.label);
    btn.innerHTML = `${tab.icon()}<span class="phone-tab-label">${tab.label}</span>`;
    btn.addEventListener('click', () => {
      if (inChatPage) {
        // 离开聊天页：中断流式、后台生成摘要
        chatHandle?.beforeLeave();
        chatHandle = null;
      }
      activeTab = tab.id;
      Array.from(navbar.querySelectorAll('.phone-tab')).forEach(b =>
        b.classList.toggle('is-active', (b as HTMLElement).dataset.tab === tab.id),
      );
      renderTabContent();
    });
    navbar.appendChild(btn);
  });
  s.appendChild(navbar);

  // 关闭按钮（右上角）
  const closeBtn = document.createElement('button');
  closeBtn.className = 'phone-close-btn';
  closeBtn.setAttribute('aria-label', '关闭手机');
  closeBtn.innerHTML = iconClose();
  closeBtn.addEventListener('click', togglePhone);
  s.appendChild(closeBtn);

  // 小窗 / 全屏切换（关闭键左侧；图标指向将要进入的模式）
  modeBtn = document.createElement('button');
  modeBtn.className = 'phone-mode-btn';
  modeBtn.addEventListener('click', () => setShellMode(shellMode === 'full' ? 'mini' : 'full'));
  s.appendChild(modeBtn);
  s.classList.toggle('is-mini', shellMode === 'mini');
  updateModeBtn();

  return s;
}

function readStoryTime(raw: MvuRaw = readMvu()): { date: string; time: string } {
  return { date: raw.环境?.日期 || '待设定', time: raw.环境?.时间 || '待设定' };
}

/** 状态栏显示故事内时间（环境.时间），开局未设定时显示 --:-- */
function updateStatusTime(raw?: MvuRaw) {
  if (!statusTime) return;
  const { time } = readStoryTime(raw);
  statusTime.textContent = time === '待设定' ? '--:--' : time;
}

function syncWechatLog() {
  const raw = readMvu();
  const chats = CHARACTERS.map(def => ({
    name: def.name,
    messages: loadChatHistory(chatHistoryKeyOf(def.id)),
  }));
  void syncWechatLogToWorldbook(chats, resolvePlayerName(raw));
}

// ────────────────────────────────────────────────────────────────────────────
// 页面渲染路由
// ────────────────────────────────────────────────────────────────────────────

function renderTabContent() {
  if (!contentArea) return;
  // 告知上一页释放自己起的定时器（如设置页的键盘诊断）
  if (contentArea.children.length > 0) contentArea.dispatchEvent(new Event('wc-dispose'));
  contentArea.innerHTML = '';
  inChatPage = false;
  chatHandle = null;
  typing = false;

  const raw = readMvu();
  const data = buildWechatData(raw);
  const storageGen = getStorageGeneration();

  const callbacks: WechatCallbacks = {
    onSyncSummary: (char, summary) => {
      if (getStorageGeneration() !== storageGen) return;
      updateMvu(wx => {
        const key = char.phone.fields.summaryHistory;
        const hist = Array.isArray(wx[key]) ? (wx[key] as string[]) : [];
        // 追加到摘要历史（最多保留 5 条）
        wx[key] = [...hist, summary].slice(-5);
      });
    },
    getStoryTime: () => readStoryTime(),
    onHistoryChange: () => {
      if (getStorageGeneration() !== storageGen) return;
      void syncWechatLog();
    },
    onAddMoment: (moment) => {
      if (getStorageGeneration() !== storageGen) return;
      void updateMvu(wx => {
        const list = Array.isArray(wx._朋友圈) ? (wx._朋友圈 as typeof data.moments) : [];
        // MVU 回读的是反序列化新对象，按「内容+时间」定位同一条，避免点赞时产生重复条目
        const idx = list.findIndex(m => m.内容 === moment.内容 && m.时间 === moment.时间);
        if (idx >= 0) {
          const next = [...list];
          next[idx] = moment;
          wx._朋友圈 = next;
        } else {
          wx._朋友圈 = [...list, moment];
        }
      }).then(() => {
        // 正在看朋友圈时，新动态/点赞写回后就地刷新
        if (phoneOpen && activeTab === 'moments') renderTabContent();
      });
    },
    onAddFriend: (char) => {
      if (getStorageGeneration() !== storageGen) return;
      localAddedFlags.set(char.id, true);
      localRejectedFlags.set(char.id, false);
      writeLocalFlag(char.id, 'hasAdded:v1', true);
      writeLocalFlag(char.id, 'addRejected:v1', false);
      updateMvu(wx => {
        wx[char.phone.fields.added] = true;
      });
      // 立即重渲，无需等 MVU 写回
      renderTabContent();
    },
    onAddRejected: (char) => {
      if (getStorageGeneration() !== storageGen) return;
      // 只落盘，不重渲：按钮与提示已由 wechat.ts 就地更新，
      // 重渲会连带清空搜索框，让玩家看不到刚发生的拒绝
      localRejectedFlags.set(char.id, true);
      writeLocalFlag(char.id, 'addRejected:v1', true);
    },
    onUnreadClear: () => {
      if (getStorageGeneration() !== storageGen) return;
      updateMvu(wx => {
        wx._未读数 = 0;
      });
      updateBadge(0);
    },
  };

  const doc = hostDoc();

  if (activeTab === 'chat') {
    const list = renderChatList(doc, data, (char) => {
      contentArea!.innerHTML = '';
      inChatPage = true;
      updateMvu(wx => {
        wx._未读数 = 0;
      });
      updateBadge(0);
      const freshData = buildWechatData(readMvu());
      const freshChar = freshData.characters.find(c => c.def.id === char.def.id) ?? char;
      const handle = renderChatPage(doc, freshData, freshChar, callbacks, () => {
        inChatPage = false;
        renderTabContent();
      });
      chatHandle = handle;
      contentArea!.appendChild(handle.el);
    });
    contentArea.appendChild(list);
  } else if (activeTab === 'contacts') {
    contentArea.appendChild(renderContactsPage(doc, data, callbacks));
  } else if (activeTab === 'moments') {
    contentArea.appendChild(renderMomentsPage(doc, data, callbacks));
  } else if (activeTab === 'settings') {
    contentArea.appendChild(renderSettingsPage(doc, describeViewport));
  }
}

// ────────────────────────────────────────────────────────────────────────────
// 小窗 / 全屏
// ────────────────────────────────────────────────────────────────────────────

/** 切换键的图标与提示指向「将要进入的模式」：当前全屏就显示收拢图标 */
function updateModeBtn() {
  if (!modeBtn) return;
  const nextMini = shellMode === 'full';
  modeBtn.innerHTML = nextMini ? iconShellShrink() : iconShellExpand();
  modeBtn.setAttribute('aria-label', nextMini ? '切换到小窗' : '切换到全屏');
}

function setShellMode(mode: ShellMode) {
  shellMode = mode;
  saveShellMode(mode);
  if (!shell) return;
  shell.classList.toggle('is-mini', mode === 'mini');
  updateModeBtn();
  syncShellViewport();
}

/** 小窗拖动：按住顶部状态栏移动（仅小窗模式；阈值内视为点按不触发） */
function enableShellDrag(bar: HTMLElement) {
  const DRAG_THRESHOLD = 4;
  let dragging = false;
  let moved = false;
  let pointerId = -1;
  let startX = 0;
  let startY = 0;
  let originLeft = 0;
  let originTop = 0;

  const finish = () => {
    if (!dragging) return;
    dragging = false;
    shell?.classList.remove('is-dragging');
    if (pointerId >= 0) {
      try { bar.releasePointerCapture(pointerId); } catch { /* 静默 */ }
    }
    pointerId = -1;
    if (moved && shell) {
      // 回存实际生效的位置（含边缘吸附后的结果）
      const left = parseFloat(shell.style.left);
      const top = parseFloat(shell.style.top);
      if (Number.isFinite(left) && Number.isFinite(top)) {
        shellPos = { left, top };
        saveShellPos(shellPos);
      }
    }
  };

  bar.addEventListener('pointerdown', (e: PointerEvent) => {
    if (shellMode !== 'mini' || dragging || !shell) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    dragging = true;
    moved = false;
    pointerId = e.pointerId;
    startX = e.clientX;
    startY = e.clientY;
    const rect = shell.getBoundingClientRect();
    originLeft = rect.left;
    originTop = rect.top;
    try { bar.setPointerCapture(pointerId); } catch { /* 静默 */ }
  });

  bar.addEventListener('pointermove', (e: PointerEvent) => {
    if (!dragging || e.pointerId !== pointerId) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if (!moved) {
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      moved = true;
      shell?.classList.add('is-dragging');
    }
    shellPos = { left: originLeft + dx, top: originTop + dy };
    syncShellViewport();
  });

  const onPointerEnd = (e: PointerEvent) => {
    if (e.pointerId !== pointerId) return;
    finish();
  };
  bar.addEventListener('pointerup', onPointerEnd);
  bar.addEventListener('pointercancel', onPointerEnd);
}

// ────────────────────────────────────────────────────────────────────────────
// 开关手机
// ────────────────────────────────────────────────────────────────────────────

function togglePhone() {
  phoneOpen = !phoneOpen;
  if (!shell) return;
  if (phoneOpen) {
    shell.classList.add('is-open');
    syncShellViewport();
    startViewportHeartbeat();
    renderTabContent();
  } else {
    shell.classList.remove('is-open');
    stopViewportHeartbeat();
    typing = false;
    if (inChatPage) {
      // 收起手机等同于离开聊天页：后台生成摘要与朋友圈，保留进行中的回复
      chatHandle?.beforeHide();
      chatHandle = null;
      inChatPage = false;
    }
  }
}

// ────────────────────────────────────────────────────────────────────────────
// 注入宿主文档
// ────────────────────────────────────────────────────────────────────────────

function hostDoc(): Document {
  try {
    const p = window.parent;
    if (p && p !== window && p.document) return p.document;
  } catch {
    /* 跨域 */
  }
  return document;
}

// ────────────────────────────────────────────────────────────────────────────
// 视口与键盘适配
// ────────────────────────────────────────────────────────────────────────────

// 环境不报告键盘时（覆盖式输入法 / adjustNothing）按屏幕比例保守预留
const KEYBOARD_FALLBACK_RATIO = 0.45;
// 低于这个高度就认为环境没报告出真实键盘
const KEYBOARD_INSET_MIN = 80;

let typing = false;
let idleHeight = 0;

/** 环境报告出的键盘高度；0 表示环境未报告 */
function reportedKeyboardInset(hostWin: Window): number {
  const vv = (hostWin as unknown as { visualViewport?: VisualViewport | null }).visualViewport;
  if (vv && vv.scale > 1.05) return 0; // 页面被缩放时忽略，避免误判
  let inset = 0;
  if (vv) inset = Math.max(inset, Math.round(hostWin.innerHeight - vv.height));
  const vk = (navigator as unknown as { virtualKeyboard?: { boundingRect?: { height?: number } } }).virtualKeyboard;
  const vkHeight = Math.round(vk?.boundingRect?.height ?? 0);
  if (vkHeight > 0) inset = Math.max(inset, vkHeight);
  return Math.max(0, inset);
}

/** 把外壳对齐到真实可视区域（键盘弹出/收起、转屏时保持底部输入区可见）。
 *  全屏 = 铺满可视区；小窗 = 受限宽度浮窗，键盘弹出时先上移、不够再压缩高度。 */
function syncShellViewport() {
  if (!shell) return;
  const hostWin = hostDoc().defaultView ?? window;
  const baseHeight = Math.round(hostWin.innerHeight);
  if (!baseHeight) return;
  const baseWidth = Math.round(hostWin.innerWidth) || baseHeight;

  const reported = reportedKeyboardInset(hostWin);
  if (!typing) idleHeight = baseHeight;

  let inset = reported;
  if (typing && reported < KEYBOARD_INSET_MIN) {
    // 环境既不缩视口也不报告键盘，只能自己把输入栏抬出去
    const shrankByEnvironment = idleHeight > 0 && baseHeight < idleHeight - 60;
    if (!shrankByEnvironment) inset = Math.round(baseHeight * KEYBOARD_FALLBACK_RATIO);
  }

  // 键盘上沿：窗口底边不许越过这条线（留 8px 呼吸）
  const limitBottom = baseHeight - inset - 8;

  if (shellMode === 'mini') {
    const width = Math.min(255, Math.max(240, baseWidth - 24));
    const desiredHeight = Math.min(480, baseHeight - 24);
    let height = desiredHeight;
    // 拖过就用记忆位置，否则水平居中、纵向偏上（下方给键盘留位）
    let left = shellPos ? Math.round(shellPos.left) : Math.round((baseWidth - width) / 2);
    let top = shellPos ? Math.round(shellPos.top) : Math.round((baseHeight - height) * 0.42);
    left = Math.min(Math.max(8, left), Math.max(8, baseWidth - width - 8));
    top = Math.min(Math.max(8, top), Math.max(8, baseHeight - height - 8));
    if (top + height > limitBottom) {
      top = Math.max(8, limitBottom - height);
      if (top + height > limitBottom) {
        height = Math.max(280, limitBottom - 8);
        top = 8;
      }
    }
    shell.style.width = `${width}px`;
    shell.style.height = `${height}px`;
    shell.style.left = `${left}px`;
    shell.style.right = 'auto';
    shell.style.top = `${top}px`;
    shell.style.bottom = 'auto';
    return;
  }

  const vv = (hostWin as unknown as { visualViewport?: VisualViewport | null }).visualViewport;
  const height = Math.max(220, baseHeight - inset);
  shell.style.width = '100%';
  shell.style.height = `${height}px`;
  // 清掉小窗留下的定位，回到 CSS 的 inset: 0 铺满
  shell.style.left = '';
  shell.style.right = '';
  shell.style.top = `${reported > 0 && vv ? Math.round(vv.offsetTop) : 0}px`;
  shell.style.bottom = 'auto';
}

/** 该节点是否是外壳内的文本输入框（用于判断键盘是否因输入而弹出） */
function isShellTextEntry(target: EventTarget | null): boolean {
  const node = target as { tagName?: unknown; closest?: unknown } | null;
  if (!node || typeof node.tagName !== 'string' || typeof node.closest !== 'function') return false;
  const tag = node.tagName.toLowerCase();
  if (tag !== 'textarea' && tag !== 'input') return false;
  return Boolean((node.closest as (selector: string) => Element | null)('.phone-shell'));
}

/** 设置页的键盘诊断读数：环境到底报告了什么 */
function describeViewport(): string {
  const hostWin = hostDoc().defaultView ?? window;
  const vv = (hostWin as unknown as { visualViewport?: VisualViewport | null }).visualViewport;
  return [
    `模式 ${shellMode === 'mini' ? '小窗' : '全屏'}`,
    `屏幕 ${Math.round(hostWin.innerHeight)}`,
    vv ? `可视 ${Math.round(vv.height)}` : '无 visualViewport',
    vv ? `偏移 ${Math.round(vv.offsetTop)}` : '',
    `键盘 ${reportedKeyboardInset(hostWin)}`,
    `输入中 ${typing ? '是' : '否'}`,
    `当前 ${shell?.style.height || '未设定'}`,
  ].filter(Boolean).join(' · ');
}

let viewportHeartbeat: number | null = null;
let viewportBurst: number | null = null;

/** 打开手机期间的低频心跳：兜底不派发视口事件的环境 */
function startViewportHeartbeat() {
  if (viewportHeartbeat !== null) return;
  const hostWin = hostDoc().defaultView ?? window;
  viewportHeartbeat = hostWin.setInterval(syncShellViewport, 600);
}

function stopViewportHeartbeat() {
  if (viewportHeartbeat === null) return;
  const hostWin = hostDoc().defaultView ?? window;
  hostWin.clearInterval(viewportHeartbeat);
  viewportHeartbeat = null;
}

/** 聚焦/失焦（键盘弹起/收起）瞬间的高频重试 */
function burstSyncShellViewport() {
  const hostWin = hostDoc().defaultView ?? window;
  if (viewportBurst !== null) {
    hostWin.clearInterval(viewportBurst);
    viewportBurst = null;
  }
  let remaining = 8;
  viewportBurst = hostWin.setInterval(() => {
    syncShellViewport();
    remaining -= 1;
    if (remaining <= 0 && viewportBurst !== null) {
      hostWin.clearInterval(viewportBurst);
      viewportBurst = null;
    }
  }, 150);
  syncShellViewport();
}

function mount() {
  const host = hostDoc();
  const existing = host.getElementById('phone-root-host');
  if (existing) existing.remove();

  // 把编译后的 CSS 注入到宿主文档，确保样式与 DOM 在同一 document
  const existingStyle = host.getElementById('phone-root-style');
  if (existingStyle) existingStyle.remove();
  const styleEl = host.createElement('style');
  styleEl.id = 'phone-root-style';
  styleEl.textContent = phoneCss as unknown as string;
  (host.head ?? host.body).appendChild(styleEl);

  const container = host.createElement('div');
  container.id = 'phone-root-host';
  host.body.appendChild(container);

  fab = buildFab();
  shell = buildShell();
  container.appendChild(fab);
  container.appendChild(shell);

  const savedPos = loadFabPos();
  if (savedPos) applyFabPos(savedPos);
}

// ────────────────────────────────────────────────────────────────────────────
// 生命周期
// ────────────────────────────────────────────────────────────────────────────

function addDisposer(value: unknown) {
  if (typeof value === 'function') disposers.push(value as () => void);
  else if (value && typeof (value as { stop?: unknown }).stop === 'function') {
    disposers.push(() => (value as { stop: () => void }).stop());
  }
}

function destroy() {
  active = false;
  while (disposers.length) disposers.pop()?.();
  const host = hostDoc();
  host.getElementById('phone-root-host')?.remove();
  host.getElementById('phone-root-style')?.remove();
  fab = null;
  shell = null;
  modeBtn = null;
  contentArea = null;
  statusTime = null;
}

async function init() {
  await waitGlobalInitialized('Mvu');
  if (!active) return;

  mount();

  // 视口变化（转屏/窗口缩放）时：悬浮按钮拉回可视范围 + 外壳适配
  const onViewportResize = () => {
    const saved = loadFabPos();
    if (saved) applyFabPos(saved);
    syncShellViewport();
  };
  const hostWin = hostDoc().defaultView ?? window;
  hostWin.addEventListener('resize', onViewportResize);

  // 全屏外壳视口适配：四通道兜底（vv 事件 / 窗口 resize / 聚焦重试 / 打开期间心跳）
  const vv = (hostWin as unknown as { visualViewport?: VisualViewport | null }).visualViewport;
  if (vv) {
    vv.addEventListener('resize', syncShellViewport);
    vv.addEventListener('scroll', syncShellViewport);
  }
  const hostDocument = hostDoc();
  let typingCheckTimer: number | null = null;
  const onFocusIn = (event: Event) => {
    typing = isShellTextEntry(event.target);
    burstSyncShellViewport();
  };
  const onFocusOut = () => {
    // 失焦后延迟判定：切换输入框时会先 focusout 再 focusin
    if (typingCheckTimer !== null) hostWin.clearTimeout(typingCheckTimer);
    typingCheckTimer = hostWin.setTimeout(() => {
      typingCheckTimer = null;
      typing = isShellTextEntry(hostDocument.activeElement);
      burstSyncShellViewport();
    }, 120);
  };
  hostDocument.addEventListener('focusin', onFocusIn);
  hostDocument.addEventListener('focusout', onFocusOut);

  const vk = (navigator as unknown as { virtualKeyboard?: { addEventListener?: (t: string, f: () => void) => void; removeEventListener?: (t: string, f: () => void) => void } }).virtualKeyboard;
  if (vk && typeof vk.addEventListener === 'function') {
    vk.addEventListener('geometrychange', syncShellViewport);
  }

  syncShellViewport();
  addDisposer(() => {
    if (vv) {
      vv.removeEventListener('resize', syncShellViewport);
      vv.removeEventListener('scroll', syncShellViewport);
    }
    hostDocument.removeEventListener('focusin', onFocusIn);
    hostDocument.removeEventListener('focusout', onFocusOut);
    if (typingCheckTimer !== null) hostWin.clearTimeout(typingCheckTimer);
    if (vk && typeof vk.removeEventListener === 'function') {
      vk.removeEventListener('geometrychange', syncShellViewport);
    }
  });

  const onUpdate = () => {
    if (!active) return;
    const raw = readMvu();
    // 正文剧情里加上了微信（AI 写入对应字段）时，同步到手机本地状态。
    // 只单向打开，不回退——不能把玩家已经用上的功能收回去。
    for (const def of CHARACTERS) {
      if (!localAddedFlags.get(def.id) && raw.微信?.[def.phone.fields.added] === true) {
        localAddedFlags.set(def.id, true);
        localRejectedFlags.set(def.id, false);
        writeLocalFlag(def.id, 'hasAdded:v1', true);
        writeLocalFlag(def.id, 'addRejected:v1', false);
      }
    }
    const unread = raw.微信?._未读数 ?? 0;
    updateBadge(Number(unread));
    updateStatusTime(raw);
    // 只在列表页刷新；聊天页正在进行中时不重渲，避免将聊天页清掉
    if (phoneOpen && !inChatPage) renderTabContent();
  };

  // 换档：手机本地状态切换到新存档，丢弃旧存档的异步写入
  let lastChatId = getCurrentChatId();
  const onChatChanged = (chatId: string) => {
    if (!active) return;
    const id = chatId || getCurrentChatId();
    if (!id || id === lastChatId) return; // 同档的消息重载（如正则刷新）不处理
    lastChatId = id;
    invalidateChatKey();
    chatHandle?.abort();
    chatHandle = null;
    loadAllLocalFlags();
    updateStatusTime();
    // 世界书跨存档共享：换档后用新存档的记录覆盖（无记录则禁用条目）
    syncWechatLog();
    if (phoneOpen) renderTabContent();
  };

  loadAllLocalFlags();
  onUpdate();
  syncWechatLog();
  addDisposer(eventOn(Mvu.events.VARIABLE_INITIALIZED, onUpdate));
  addDisposer(eventOn(Mvu.events.VARIABLE_UPDATE_ENDED, onUpdate));
  try {
    addDisposer(eventOn(tavern_events.CHAT_CHANGED, onChatChanged));
  } catch { /* 旧版本助手未导出 tavern_events 时不影响主体功能 */ }
  addDisposer(() => hostWin.removeEventListener('resize', onViewportResize));
  addDisposer(() => {
    stopViewportHeartbeat();
    if (viewportBurst !== null) {
      hostWin.clearInterval(viewportBurst);
      viewportBurst = null;
    }
  });
  $(window).one('pagehide', destroy);
}

$(() => {
  errorCatched(init)();
});
