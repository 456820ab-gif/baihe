import { CHARACTERS, type CharacterDef } from '../../characters';
import { hostDocument, hostWindow } from './host';
import {
  RELATION_AXES, arenaLabel, arenaLevel, relationAxisLabel, relationAxisTone, relationConfidants, relationWoman,
  type RelationAxis, type RelationWoman,
} from './relation';
import { getPath, isUnset, playerJob, readPath, type HudData } from './state';

export type RelationAction = '约她' | '去见她' | '留下痕迹' | '擦掉痕迹' | '公开' | '带去聚会' | '坦白' | '继续瞒';

export const RELATION_ACTIONS: RelationAction[] = [
  '约她',
  '去见她',
  '留下痕迹',
  '擦掉痕迹',
  '公开',
  '带去聚会',
  '坦白',
  '继续瞒',
];

function make<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string) {
  const el = hostDocument().createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

/* 视图每次重建 DOM，旧值只能记在模块级：有旧值才谈得上「从旧值涨到新值」 */
const meterValues = new Map<string, number>();
const sweptGates = new Set<string>();

export function paintFill(fill: HTMLElement, key: string, value: number | null) {
  const target = value === null ? 0 : Math.min(1, Math.max(0, value / 100));
  const previous = meterValues.get(key);
  meterValues.set(key, target);
  fill.style.setProperty('--v', String(target));
  // 首次出现与降级都直接落到目标值，不从旧值回抽
  if (previous === undefined || target <= previous) return;
  fill.style.setProperty('--v', String(previous));
  const frame = hostWindow().requestAnimationFrame;
  const start = () => {
    fill.classList.add('is-updating');
    fill.style.setProperty('--v', String(target));
    fill.addEventListener('transitionend', () => fill.classList.remove('is-updating'), { once: true });
    // 减少动效或过渡被跳过时不会触发 transitionend，留一条兜底
    hostWindow().setTimeout(() => fill.classList.remove('is-updating'), 1000);
    sweepGate(fill, key);
  };
  if (typeof frame === 'function') frame(() => frame(start));
  else start();
}

/* 门槛刚满足时让那条玉色细线扫过一次，不发光，每道门槛只扫一次 */
function sweepGate(fill: HTMLElement, key: string) {
  const gate = fill.closest('.obs-gate');
  if (!gate || gate.getAttribute('data-ready') !== 'true' || sweptGates.has(key)) return;
  sweptGates.add(key);
  fill.classList.add('is-sweeping');
  hostWindow().setTimeout(() => fill.classList.remove('is-sweeping'), 700);
}

/** 动作只生成一句带【标记】的意图，真正的叙事交给 AI */
export function relationActionLine(action: RelationAction, name: string, place?: string) {
  const where = place && !isUnset(place) ? place : '她现在待的地方';
  if (action === '约她') return `【约她】我想约${name}今晚在「月见河滨公园」见面。`;
  if (action === '去见她') return `【去见她】我想现在去${where}找${name}。`;
  if (action === '留下痕迹') return `【留下痕迹】我想在${name}那里留下一处只有我们两个人知道的痕迹。`;
  if (action === '擦掉痕迹') return `【擦掉痕迹】我想把那处留在${name}身上的痕迹处理掉。`;
  if (action === '公开') return `【公开】我想把我和${name}的关系公开出去。`;
  if (action === '带去聚会') return `【带去聚会】我想带${name}一起去今晚的朋友聚会。`;
  if (action === '坦白') return `【坦白】我想向${name}坦白另一段关系。`;
  return `【继续瞒】我想继续瞒着${name}，不让另一段关系被发现。`;
}

export function relationActionBar(options: { name: string; place?: string; onAction: (line: string) => void }) {
  const bar = make('div', 'obs-rel-actions');
  RELATION_ACTIONS.forEach(action => {
    const button = make('button', 'obs-rel-action', action);
    button.type = 'button';
    button.dataset.action = action;
    button.setAttribute('aria-label', `${action}：只填入输入框，不发送`);
    button.addEventListener('click', () => options.onAction(relationActionLine(action, options.name, options.place)));
    bar.append(button);
  });
  return bar;
}

function meter(charId: string, axis: RelationAxis, value: number | null) {
  const row = make('div', `obs-meter obs-meter-${axis} ${relationAxisTone(axis, value)}`);
  row.append(make('span', 'obs-meter-label', axis));
  const track = make('span', 'obs-meter-track');
  const fill = make('span', 'obs-meter-fill');
  paintFill(fill, `${charId}:${axis}`, value);
  track.append(fill);
  row.append(track, make('strong', 'obs-meter-value', value === null ? '—' : String(value)));
  row.append(make('small', 'obs-rel-meter-label', relationAxisLabel(axis, value)));
  return row;
}

function interestList(data: HudData | null) {
  const raw = getPath(data, '玩家._兴趣');
  const list = Array.isArray(raw) ? raw : typeof raw === 'string' ? raw.split(/[、,，/]/) : [];
  return list.map(item => String(item).trim()).filter(item => item && !isUnset(item));
}

function circles(data: HudData | null) {
  const box = make('div', 'obs-rel-circles');
  const job = playerJob(data);
  const skill = readPath(data, '玩家._主特长', '');
  const interests = interestList(data);

  const open = make('div', 'obs-rel-circle is-public');
  open.append(make('span', 'obs-rel-circle-label', '公开圈'));
  open.append(make('p', 'obs-rel-circle-text', `职业「${job}」是别人问一句就能知道的你。`));

  const inner = make('div', 'obs-rel-circle is-private');
  inner.append(make('span', 'obs-rel-circle-label', '私下圈'));
  const detail = [
    skill && !isUnset(skill) ? `主特长「${skill}」` : '',
    interests.length ? `兴趣「${interests.join('、')}」` : '',
  ].filter(Boolean).join('，');
  inner.append(make('p', 'obs-rel-circle-text', `${detail || '工作之外的你'}，只对走得够近的人展开。`));

  box.append(open, inner);
  return box;
}

function knownCircle(woman: RelationWoman | null) {
  const box = make('div', 'obs-rel-known');
  box.append(make('span', 'obs-rel-section-label', '知情圈'));
  const confidants = relationConfidants(woman);
  if (!confidants.length) {
    box.append(make('span', 'obs-rel-empty', '还没有第三个人知道'));
    return box;
  }
  const chips = make('div', 'obs-rel-known-chips');
  confidants.forEach(item => {
    const chip = make('span', 'obs-rel-known-chip', item.人);
    chip.title = item.知道 || `${item.人}知道一些事`;
    chips.append(chip);
  });
  box.append(chips);
  return box;
}

function traceList(woman: RelationWoman | null) {
  const box = make('div', 'obs-rel-traces-box');
  box.append(make('span', 'obs-rel-section-label', '痕迹'));
  if (!woman?.痕迹.length) {
    box.append(make('span', 'obs-rel-empty', '还没有留下痕迹'));
    return box;
  }
  const list = make('ul', 'obs-rel-traces');
  const shown = woman.痕迹.slice(-4).reverse();
  shown.forEach(trace => {
    const item = make('li', 'obs-rel-trace');
    item.append(make('span', 'obs-rel-trace-kind', trace.类型 || '痕迹'));
    item.append(make('p', 'obs-rel-trace-text', trace.内容));
    item.append(make('small', 'obs-rel-trace-meta', [trace.时间, trace.可见性].filter(Boolean).join(' · ')));
    list.append(item);
  });
  if (woman.痕迹.length > shown.length) {
    list.append(make('li', 'obs-rel-trace-more', `还有 ${woman.痕迹.length - shown.length} 条更早的痕迹`));
  }
  box.append(list);
  return box;
}

function column(data: HudData | null, char: CharacterDef, onAction: (line: string) => void) {
  const woman = relationWoman(data, char.varRoot);
  const place = readPath(data, `${char.varRoot}.所在地点`, '');
  const identity = readPath(data, `${char.varRoot}.关系身份`);
  const arena = woman?.修罗场 ?? '无';

  const col = make('article', 'obs-rel-col');
  col.dataset.character = char.id;
  col.style.setProperty('--char-accent', char.accent);
  col.style.setProperty('--char-accent-soft', char.accentSoft);

  const head = make('header', 'obs-rel-col-head');
  head.append(make('strong', 'obs-rel-col-name', char.name));
  if (identity && !isUnset(identity)) head.append(make('span', 'obs-chip', identity));
  head.append(make('span', `obs-rel-arena is-level-${arenaLevel(arena)}`, arenaLabel(arena)));

  const meters = make('div', 'obs-rel-meters');
  RELATION_AXES.forEach(axis => meters.append(meter(char.id, axis, woman ? woman[axis] : null)));

  const body = make('div', 'obs-rel-col-body');
  body.append(knownCircle(woman), traceList(woman));

  col.append(head, meters, body);
  if (woman) col.append(relationActionBar({ name: char.name, place, onAction }));
  return col;
}

export function renderRelationView(options: { data: HudData | null; onAction: (line: string) => void }): HTMLElement {
  const data = options.data;
  const wrap = make('div', 'obs-relation');
  const head = make('header', 'obs-rel-head');
  head.append(
    make('p', 'obs-kicker', '只有测试卡提供'),
    make('h2', 'obs-title', '关系账本'),
    make('p', 'obs-subtitle', '公开身份写在明面上，私密、克制、失控与风险只在这扇窗里。'),
  );
  wrap.append(head, circles(data));

  const cols = make('div', 'obs-rel-cols');
  CHARACTERS.forEach(char => cols.append(column(data, char, options.onAction)));
  wrap.append(cols);
  return wrap;
}
