import { lilySprigSvg } from '../../界面/状态栏/icons';
import { hostDocument } from './host';

export type ObsTab = 'character' | 'relation' | 'map' | 'settings';


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
  private timer: number | null = null;

  constructor(private readonly options: ObservatoryOptions) {
    this.section = make('section', 'obs-layer');
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
    this.current = tab;
    this.windowEl.dataset.tab = tab;
    this.section.hidden = false;
    this.open = true;
    this.clearTimer();
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
    this.section.hidden = true;
    this.handle.classList.remove('is-open', 'is-docked');
    this.handle.classList.add('is-floating');
    this.handle.textContent = '观景窗 ▾';
    this.handle.setAttribute('aria-label', '打开观景窗');
    this.clearTimer();
    this.timer = window.setTimeout(() => {
      if (!this.open) {
        this.handle.classList.remove('is-floating');
        this.handle.classList.add('is-docked');
        this.handle.textContent = '▾';
      }
      this.timer = null;
    }, 3000);
  }

  render() {
    this.syncTabs();
    if (!this.open) return;
    this.body.replaceChildren(this.options.renderTab(this.current));
  }

  destroy() {
    this.clearTimer();
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

  private clearTimer() {
    if (this.timer !== null) {
      window.clearTimeout(this.timer);
      this.timer = null;
    }
  }
}
