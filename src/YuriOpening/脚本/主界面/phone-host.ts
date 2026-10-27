/**
 * phone-host.ts — 主应用内嵌手机面板的桥
 *
 * 手机核心模块（界面/手机）既能在酒馆页自带悬浮按钮 overlay 运行，
 * 也能被主应用挂进 #yuri-front 的一块容器里。这里负责后者：
 * 建面板层（幕布 + 设备框 + 挂载容器）、调用 mountPhone(embedded)，
 * 并把手机句柄收敛成主应用用的几个动作。
 *
 * 手机自带的关闭键会摘掉 .phone-shell 的 is-open，面板层跟着它同步显隐。
 */

import './phone-flag';
import { mountPhone, type PhoneHandle, type PhoneNotice } from '../../界面/手机';
import type { CharacterId } from '../../characters';

type PhoneHostOptions = {
  /** 面板层的宿主元素：主应用画布根节点 */
  host: HTMLElement;
  onNotify?: (notice: PhoneNotice) => void;
  onUnread?: (count: number) => void;
};

let handle: PhoneHandle | null = null;
let layer: HTMLElement | null = null;
let shellWatch: MutationObserver | null = null;
let reportUnread: ((count: number) => void) | null = null;
let panelOpen = false;

/** 手机只在收到新消息时回调未读；进聊天已读、开关面板后由这里补一次读数 */
function refreshUnread() {
  reportUnread?.(handle?.getUnread() ?? 0);
}

function showLayer() {
  panelOpen = true;
  if (layer) layer.hidden = false;
}

function hideLayer() {
  panelOpen = false;
  if (layer) layer.hidden = true;
}

function syncFromShell(shell: HTMLElement) {
  if (shell.classList.contains('is-open')) showLayer();
  else hideLayer();
  refreshUnread();
}

function mount(options: PhoneHostOptions) {
  if (handle) return;
  const doc = options.host.ownerDocument;
  const win = doc.defaultView ?? window;

  const nextLayer = doc.createElement('div');
  nextLayer.className = 'phone-layer';
  nextLayer.hidden = true;

  const scrim = doc.createElement('div');
  scrim.className = 'phone-layer-scrim';
  scrim.setAttribute('aria-hidden', 'true');
  scrim.addEventListener('click', close);

  const frame = doc.createElement('section');
  frame.className = 'phone-frame';
  frame.setAttribute('role', 'dialog');
  frame.setAttribute('aria-label', '手机');

  const mountRoot = doc.createElement('div');
  mountRoot.className = 'phone-mount';
  frame.append(mountRoot);
  nextLayer.append(scrim, frame);
  options.host.append(nextLayer);
  layer = nextLayer;

  handle = mountPhone({
    host: doc,
    hostWin: win,
    embedded: true,
    root: mountRoot,
    onNotify: options.onNotify,
    onUnread: options.onUnread,
  });
  reportUnread = options.onUnread ?? null;

  const shell = mountRoot.querySelector<HTMLElement>('.phone-shell');
  if (shell) {
    syncFromShell(shell);
    shellWatch = new win.MutationObserver(() => syncFromShell(shell));
    shellWatch.observe(shell, { attributes: true, attributeFilter: ['class'] });
  }
}

function open() {
  if (!handle) return;
  handle.open();
  showLayer();
  refreshUnread();
}

function close() {
  handle?.close();
  hideLayer();
  refreshUnread();
}

function toggle() {
  if (panelOpen) close();
  else open();
}

function openChat(id?: CharacterId) {
  if (!handle) return;
  handle.openChat(id);
  showLayer();
  refreshUnread();
}

function openNotifications() {
  if (!handle) return;
  handle.openNotifications();
  showLayer();
  refreshUnread();
}

function getUnread(): number {
  return handle?.getUnread() ?? 0;
}

function destroy() {
  shellWatch?.disconnect();
  shellWatch = null;
  handle?.destroy();
  handle = null;
  layer?.remove();
  layer = null;
  reportUnread = null;
  panelOpen = false;
}

export const phoneHost = { mount, open, close, toggle, openChat, openNotifications, getUnread, destroy };
