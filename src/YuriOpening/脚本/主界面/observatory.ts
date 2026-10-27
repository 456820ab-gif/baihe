import overlayCss from './motion.overlay.scss?raw';
import { lilySprigSvg } from '../../界面/状态栏/icons';
import { hostDocument } from './host';

export type ObsTab = 'character' | 'relation' | 'map' | 'settings';

/** 观景窗与手机面板共用的显隐状态 */
export type OverlayState = 'closed' | 'opening' | 'open' | 'closing';

const MOTION_STYLE_ID = 'yuri-motion-overlay';
const CLOSE_MS = 180;
const DOCK_MS = 3000;

/** 转场样式单独注入：styles.scss 只留布局与配色 */
export function ensureOverlayMotionStyle(doc: Document = hostDocument()) {
  if (doc.getElementById(MOTION_STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = MOTION_STYLE_ID;
  style.textContent = overlayCss;
  (doc.head ?? doc.body).append(style);
}


interface ObservatoryOptions {
  root: HTMLElement;
  renderTab: (tab: ObsTab) => HTMLElement;
  /** 页签是否出现（关系页只有测试卡提供数据时才有） */
  isTabAvailable?: (tab: ObsTab) => boolean;
}

const TABS: ObsTab[] = ['character', 'relation', 'map', 'settings'];

const LABELS: Record<ObsTab, string> = {
  character: '角色',
  relation: '关系',
  map: '地图',
  settings: '设置',
};

function make<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string) {
  const el = hostDocument().createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

export class Observatory {
  private readonly section: HTMLElement;
  private readonly windowEl: HTMLElement;
  private readonly body: HTMLElement;
  private readonly nav: HTMLElement;
  private readonly handle: HTMLButtonElement;
  private readonly tabs = new Map<ObsTab, HTMLButtonElement>();
  private current: ObsTab = 'character';
  private open = false;
  private stateTimer: number | null = null;
  private dockTimer: number | null = null;
  private raf: number | null = null;

  constructor(private readonly options: ObservatoryOptions) {
    ensureOverlayMotionStyle();
    this.section = make('section', 'obs-layer');
    this.section.dataset.state = 'closed';
    this.section.hidden = true;

    this.windowEl = make('div', 'obs-window');
    this.windowEl.dataset.tab = this.current;
    const head = make('header', 'obs-head');
    const brand = make('div', 'obs-brand');    brand.append(make('span', 'obs-kicker', '百合花期'), make('strong', '', '观景窗'));
    const nav = make('nav', 'obs-tabs');
    this.nav = nav;
    const close = make('button', 'obs-close', '×');
    close.type = 'button';
    close.setAttribute('aria-label', '关闭观景窗');
    close.addEventListener('click', () => this.close());
    head.append(brand, nav, close);
    this.body = make('div', 'obs-body');
    const ornament = make('span', 'obs-ornament');
    ornament.setAttribute('aria-hidden', 'true');
    ornament.innerHTML = lilySprigSvg();
    this.windowEl.append(ornament, head, this.body);
    this.section.append(this.windowEl);

    this.handle = make('button', 'obs-handle is-docked', '▾');
    this.handle.type = 'button';
    this.handle.setAttribute('aria-label', '打开观景窗');
    this.handle.addEventListener('click', () => this.toggle());
    this.options.root.append(this.section, this.handle);
    this.syncTabs();
  }

  get opened() {
    return this.open;
  }

  get tab() {
    return this.current;
  }

  openTab(tab: ObsTab) {
    const wasOpen = this.open;
    this.current = tab;
    this.windowEl.dataset.tab = tab;
    this.open = true;
    this.clearTimers();
    this.section.hidden = false;
    if (!wasOpen) {
      this.section.dataset.state = 'opening';
      this.scheduleOpen();
    } else if (this.section.dataset.state !== 'open') {
      this.section.dataset.state = 'open';
    }
    this.handle.classList.remove('is-docked', 'is-floating');
    this.handle.classList.add('is-open');
    this.handle.textContent = '▴';
    this.handle.setAttribute('aria-label', '收起观景窗');
    this.render();
  }

  toggle() {
    if (this.open) this.close();
    else this.openTab(this.current);
  }

  close() {
    if (!this.open) return;
    this.open = false;
    this.clearTimers();
    const win = this.section.ownerDocument.defaultView ?? window;
    this.section.dataset.state = 'closing';
    this.section.hidden = false;
    this.stateTimer = win.setTimeout(() => {
      this.stateTimer = null;
      this.section.hidden = true;
      this.section.dataset.state = 'closed';
    }, CLOSE_MS);
    this.handle.classList.remove('is-open', 'is-docked');
    this.handle.classList.add('is-floating');
    this.handle.textContent = '观景窗 ▾';
    this.handle.setAttribute('aria-label', '打开观景窗');
    this.dockTimer = win.setTimeout(() => {
      this.dockTimer = null;
      if (this.open) return;
      this.handle.classList.remove('is-floating');
      this.handle.classList.add('is-docked');
      this.handle.textContent = '▾';
    }, DOCK_MS);
  }

  render() {
    this.syncTabs();
    if (!this.open) return;
    this.body.replaceChildren(this.options.renderTab(this.current));
  }

  destroy() {
    this.clearTimers();
    this.section.remove();
    this.handle.remove();
  }

  /* 数据里没有「关系」时该页签不进入 DOM；当前页不可用时退回第一个可用页 */
  private syncTabs() {
    const available = this.options.isTabAvailable ?? (() => true);
    const shown = TABS.filter(tab => available(tab));
    if (!shown.includes(this.current)) {
      this.current = shown[0] ?? 'character';
      this.windowEl.dataset.tab = this.current;
    }
    const buttons = shown.map(tab => this.tabButton(tab));
    const mounted = [...this.nav.children];
    if (mounted.length !== buttons.length || buttons.some((button, index) => button !== mounted[index])) {
      this.nav.replaceChildren(...buttons);
    }
    buttons.forEach((button, index) => button.classList.toggle('is-active', shown[index] === this.current));
  }

  private tabButton(tab: ObsTab) {
    const existing = this.tabs.get(tab);
    if (existing) return existing;
    const button = make('button', 'obs-tab', LABELS[tab]);
    button.type = 'button';
    button.dataset.tab = tab;
    button.addEventListener('click', () => this.openTab(tab));
    this.tabs.set(tab, button);
    return button;
  }

  /* 先 hidden=false 并停在 opening，下一帧才进 open，过渡才有起点 */
  private scheduleOpen() {
    const win = this.section.ownerDocument.defaultView ?? window;
    this.raf = win.requestAnimationFrame(() => {
      this.raf = win.requestAnimationFrame(() => {
        this.raf = null;
        if (this.open) this.section.dataset.state = 'open';
      });
    });
  }

  private clearTimers() {
    const win = this.section.ownerDocument.defaultView ?? window;
    if (this.stateTimer !== null) {
      win.clearTimeout(this.stateTimer);
      this.stateTimer = null;
    }
    if (this.dockTimer !== null) {
      win.clearTimeout(this.dockTimer);
      this.dockTimer = null;
    }
    if (this.raf !== null) {
      win.cancelAnimationFrame(this.raf);
      this.raf = null;
    }
  }
}
