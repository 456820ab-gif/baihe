import { CHARACTERS, type CharacterDef } from '../../characters';
import { flowerMarkPath } from '../../界面/状态栏/flowers';
import { weatherOverlaySvg, lilySprigSvg } from '../../界面/状态栏/icons';
import { mistDefsSvg } from '../../界面/状态栏/mist-defs';
import { hostDocument } from './host';
import {
  CARTOUCHE, COMPASS, FLORA_ART, MAP_FIREFLIES, MAP_FLORA, MAP_HEIGHT, MAP_NODE_BY_ID,
  MAP_NODE_BY_LABEL, MAP_NODES, MAP_WIDTH, NODE_ART, REGION_COLORS, REGION_LABELS,
  RIVER_LABEL, RIVER_PATH, mapRoads, type MapNode,
} from '../../界面/状态栏/map';
import { relationEnabled, relationWoman } from './relation';
import {
  characterNode, characterValue, getPath, playerJob, readPath, type HudData, type ThemeState,
} from './state';

interface MapViewOptions {
  rerender: () => void;
  onTravel: (message: string) => void;
}

const ZOOM_LEVELS = [0.5, 0.75, 1, 1.3, 1.7];
const DEFAULT_ZOOM = 2;

function make<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string) {
  const el = hostDocument().createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

function svg<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string> = {}) {
  const el = hostDocument().createElementNS('http://www.w3.org/2000/svg', tag);
  Object.entries(attrs).forEach(([key, value]) => el.setAttribute(key, value));
  return el;
}

function heroineNode(data: HudData | null, char: CharacterDef) {
  const label = characterNode(data, char);
  return label ? MAP_NODE_BY_LABEL.get(label) : null;
}

/* 知情 里这些值表示「没看见」，其余都算会传出去 */
const BLIND_KNOWLEDGE = ['不知情', '未察觉', '未知', '待设定', '无'];

function playerTraits(data: HudData | null) {
  const trait = String(getPath(data, '玩家._主特长', '') ?? '').trim();
  const raw = getPath(data, '玩家._兴趣', []);
  const interests = (Array.isArray(raw) ? raw : [raw])
    .map(item => String(item ?? '').trim())
    .filter(Boolean);
  return [
    trait ? `主特长「${trait}」` : '',
    interests.length ? `兴趣「${interests.join('、')}」` : '',
  ].filter(Boolean).join('、');
}

export class MapView {
  private selected: string | null = null;
  private center: { x: number; y: number } | null = null;
  private zoom = DEFAULT_ZOOM;
  private intro = false;
  private lastDetail: string | null = null;

  constructor(private readonly options: MapViewOptions) {}

  focus(label: string) {
    const node = MAP_NODE_BY_LABEL.get(label);
    if (!node) return;
    this.selected = node.id;
    this.center = { x: node.x / MAP_WIDTH, y: node.y / MAP_HEIGHT };
  }

  render(data: HudData | null, theme: ThemeState): HTMLElement {
    const wrap = make('div', 'obs-map');
    const current = MAP_NODE_BY_LABEL.get(readPath(data, '地图.当前地点', ''));
    const head = make('header', 'obs-map-head');
    head.append(
      make('span', 'obs-kicker', '百合市 · 城市地图'),
      make('h2', 'obs-title', current ? `你在这里 · ${current.label}` : '城市地图'),
      make('p', 'obs-subtitle', '滑动查看整张地图，点击地点查看详情。'),
    );
    wrap.append(head);

    const art = make('div', 'obs-map-art hud-shell');
    /* 地图背景动画（河道/霓虹/萤火/涟漪）在部分设备和录制下会高频闪，保持静态 */
    art.dataset.animate = 'false';
    art.dataset.scene = 'true';
    art.dataset.daypart = theme.daypart;
    art.dataset.weather = theme.weather === '待设定' ? 'cloudy' : theme.weather;
    art.dataset.override = theme.override;

    const viewport = make('div', 'map-viewport');
    const frame = make('div', 'map-frame');
    frame.style.setProperty('--map-zoom', String(ZOOM_LEVELS[this.zoom]));
    frame.append(this.canvas(data, theme.weather));
    this.bindPan(frame);
    viewport.append(frame, this.zoomControls(frame));
    art.append(viewport);
    wrap.append(art);
    requestAnimationFrame(() => this.restoreCenter(frame, data));

    const place = readPath(data, '地图.当前地点', '待设定');
    const where = current
      ? `你在「${current.label}」。`
      : place === '待设定'
        ? '第一段正文结束后会标出你的位置。'
        : '你现在不在百合市地图范围内。';
    const here = CHARACTERS.map(char => {
      const node = heroineNode(data, char);
      return node ? `${char.name}在「${node.label}」` : '';
    }).filter(Boolean).join('，');
    art.append(make('p', 'map-hint', `${where}${here ? `${here}。` : ''}地图支持拖动和缩放。`));

    if (this.selected) {
      const node = MAP_NODE_BY_ID.get(this.selected);
      if (node) {
        wrap.classList.add('has-detail');
        wrap.append(this.detail(data, node, node.id !== current?.id));
      }
    }
    return wrap;
  }

  private canvas(data: HudData | null, weather: string) {
    const currentId = MAP_NODE_BY_LABEL.get(readPath(data, '地图.当前地点', ''))?.id;
    const canvas = svg('svg', {
      viewBox: `0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`,
      class: `map-canvas${this.intro ? '' : ' is-intro'}`,
      role: 'img',
      preserveAspectRatio: 'xMidYMid meet',
    });
    this.intro = true;
    canvas.append(svg('rect', { x: '0', y: '0', width: String(MAP_WIDTH), height: String(MAP_HEIGHT), class: 'map-ground' }));
    canvas.insertAdjacentHTML('beforeend', mistDefsSvg());
    canvas.append(svg('path', { d: RIVER_PATH, class: 'map-water' }));
    canvas.append(svg('path', { d: RIVER_PATH, class: 'map-water-flow' }));
    canvas.append(svg('path', { d: RIVER_PATH, class: 'map-water-edge' }));
    canvas.append(this.riverLabel());
    const overlay = weatherOverlaySvg(weather, MAP_WIDTH, MAP_HEIGHT);
    if (overlay) canvas.insertAdjacentHTML('beforeend', overlay);
    MAP_FLORA.forEach((flora, index) => canvas.append(this.flora(flora, index)));
    REGION_LABELS.forEach(label => {
      const group = svg('g', { class: 'map-region' });
      group.style.setProperty('--region', REGION_COLORS[label.text] ?? 'var(--hud-muted)');
      const text = svg('text', { x: String(label.x), y: String(label.y), class: 'map-label' });
      text.textContent = label.text;
      const sub = svg('text', { x: String(label.x), y: String(label.y + 7.5), class: 'map-label-sub' });
      sub.textContent = label.sub;
      group.append(text, sub);
      canvas.append(group);
    });
    mapRoads().forEach(({ d }) => {
      canvas.append(svg('path', { d, class: 'map-road', pathLength: '1' }));
      canvas.append(svg('path', { d, class: 'map-road-inner' }));
    });
    MAP_FIREFLIES.forEach((fly, index) => {
      const dot = svg('circle', { cx: String(fly.x), cy: String(fly.y), r: '1.6', class: 'map-firefly' });
      dot.style.animationDelay = `${-index * 1.3}s`;
      canvas.append(dot);
    });
    canvas.append(this.compass());
    canvas.append(this.cartouche());
    MAP_NODES.forEach((node, index) => canvas.append(this.node(node, node.id === currentId, index)));
    CHARACTERS.forEach((char, index) => {
      const node = heroineNode(data, char);
      if (!node) return;
      const offset = (index - (CHARACTERS.length - 1) / 2) * 18;
      canvas.append(this.pin(node, char, offset));
    });
    return canvas;
  }

  private riverLabel() {
    const text = svg('text', { class: 'map-river-label' });
    Array.from(RIVER_LABEL.text).forEach((char, index) => {
      const span = svg('tspan', { x: String(RIVER_LABEL.x), y: String(RIVER_LABEL.y + index * 10) });
      span.textContent = char;
      text.append(span);
    });
    return text;
  }

  private flora(flora: (typeof MAP_FLORA)[number], index: number) {
    const art = FLORA_ART[flora.kind];
    const group = svg('g', { class: `map-flora is-${flora.kind}`, transform: `translate(${flora.x}, ${flora.y})` });
    const sway = svg('g', { class: 'flora-sway' });
    sway.style.animationDelay = `${-index * 0.7}s`;
    sway.append(svg('path', { d: art.line, class: 'flora-line' }));
    if (art.fill) sway.append(svg('path', { d: art.fill, class: 'flora-fill' }));
    group.append(sway);
    return group;
  }

  private compass() {
    const group = svg('g', { class: 'map-compass', transform: `translate(${COMPASS.x}, ${COMPASS.y})` });
    group.append(svg('circle', { r: '13', class: 'compass-ring' }), svg('circle', { r: '9.5', class: 'compass-ring-inner' }));
    const needle = svg('g', { class: 'compass-needle' });
    needle.append(
      svg('path', { d: 'M0,-11 L2.6,0 L-2.6,0 Z', class: 'compass-north' }),
      svg('path', { d: 'M0,11 L2.6,0 L-2.6,0 Z', class: 'compass-south' }),
    );
    group.append(needle);
    const letter = svg('text', { y: '-15.5', class: 'compass-letter' });
    letter.textContent = 'N';
    group.append(letter);
    return group;
  }

  private cartouche() {
    const group = svg('g', { class: 'map-cartouche', transform: `translate(${CARTOUCHE.x}, ${CARTOUCHE.y})` });
    group.append(
      svg('path', { d: 'M-44,-6 L-53,-6 L-49,0 L-53,6 L-44,6 Z', class: 'cartouche-tail' }),
      svg('path', { d: 'M44,-6 L53,-6 L49,0 L53,6 L44,6 Z', class: 'cartouche-tail' }),
      svg('rect', { x: '-45', y: '-9', width: '90', height: '18', class: 'cartouche-ribbon' }),
    );
    const title = svg('text', { y: '0.5', class: 'cartouche-title' });
    title.textContent = '百合市';
    const sub = svg('text', { y: '6.2', class: 'cartouche-sub' });
    sub.textContent = 'LILY CITY · 2025';
    group.append(title, sub);
    return group;
  }

  private node(node: MapNode, isCurrent: boolean, index: number) {
    const group = svg('g', {
      class: `map-node${isCurrent ? ' is-current' : ''}${this.selected === node.id ? ' is-selected' : ''}`,
      tabindex: '0',
      role: 'button',
      'aria-label': `${node.label}，${node.region}`,
    });
    group.style.setProperty('--i', String(index));
    if (node.nightGlow) group.append(svg('ellipse', { cx: String(node.x), cy: String(node.y), rx: '30', ry: '21', class: 'node-neon' }));
    group.append(svg('ellipse', { cx: String(node.x), cy: String(node.y), rx: '34', ry: '24', class: 'node-halo' }));
    if (isCurrent) {
      [0, 1].forEach(ring => {
        const ripple = svg('circle', { cx: String(node.x), cy: String(node.y), r: '18', class: 'node-ripple' });
        ripple.style.animationDelay = `${ring * 1.6}s`;
        group.append(ripple);
      });
    }
    group.append(svg('ellipse', { cx: String(node.x), cy: String(node.y), rx: '24', ry: '16', class: 'node-ground' }));
    const art = NODE_ART[node.id];
    if (art) {
      const drawing = svg('g', { transform: `translate(${node.x}, ${node.y})` });
      if (art.solid) drawing.append(svg('path', { d: art.solid, class: 'node-art-solid' }));
      drawing.append(svg('path', { d: art.body, class: 'node-art' }));
      group.append(drawing);
    }
    const name = svg('text', { x: String(node.x), y: String(node.y + 30), class: 'node-name' });
    name.textContent = node.label;
    group.append(name, svg('circle', { cx: String(node.x), cy: String(node.y), r: '30', class: 'node-hit' }));
    const activate = () => {
      this.selected = node.id;
      this.options.rerender();
    };
    group.addEventListener('click', activate);
    group.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        activate();
      }
    });
    return group;
  }

  private pin(node: MapNode, char: CharacterDef, offset: number) {
    const group = svg('g', { class: 'heroine-pin', transform: `translate(${node.x + 17 + offset}, ${node.y - 15})` });
    group.dataset.character = char.id;
    group.style.setProperty('--pin-accent', char.accent);
    const bob = svg('g', { class: 'heroine-pin-bob' });
    bob.append(svg('ellipse', { cx: '0', cy: '9.5', rx: '3.2', ry: '1.1', class: 'heroine-pin-shadow' }));
    bob.append(svg('path', { d: 'M0,9 C-2.6,5.8 -6.5,3.2 -6.5,-1.5 A6.5,6.5 0 1,1 6.5,-1.5 C6.5,3.2 2.6,5.8 0,9 Z', class: 'heroine-pin-body' }));
    bob.append(svg('path', { d: flowerMarkPath(char.flower, 4.4), transform: 'translate(0, -1.6)', class: 'heroine-pin-flower' }));
    const name = svg('text', { x: '0', y: '-11', class: 'heroine-pin-name' });
    name.textContent = char.name;
    group.append(bob, name);
    return group;
  }

  private restoreCenter(frame: HTMLElement, data: HudData | null) {
    if (!this.center) {
      const current = MAP_NODE_BY_LABEL.get(readPath(data, '地图.当前地点', ''));
      this.center = current ? { x: current.x / MAP_WIDTH, y: current.y / MAP_HEIGHT } : { x: 0.5, y: 0.5 };
    }
    frame.scrollLeft = this.center.x * frame.scrollWidth - frame.clientWidth / 2;
    frame.scrollTop = this.center.y * frame.scrollHeight - frame.clientHeight / 2;
  }

  private zoomControls(frame: HTMLElement) {
    const box = make('div', 'map-zoom');
    const out = make('button', 'map-zoom-button', '−');
    const level = make('span', 'map-zoom-level');
    const inn = make('button', 'map-zoom-button', '+');
    out.type = 'button';
    inn.type = 'button';
    out.setAttribute('aria-label', '缩小地图');
    inn.setAttribute('aria-label', '放大地图');
    const sync = () => {
      level.textContent = `${Math.round(ZOOM_LEVELS[this.zoom] * 100)}%`;
      out.disabled = this.zoom === 0;
      inn.disabled = this.zoom === ZOOM_LEVELS.length - 1;
    };
    const step = (delta: number) => {
      const next = Math.max(0, Math.min(ZOOM_LEVELS.length - 1, this.zoom + delta));
      if (next === this.zoom) return;
      const center = this.readCenter(frame);
      this.zoom = next;
      frame.style.setProperty('--map-zoom', String(ZOOM_LEVELS[this.zoom]));
      frame.scrollLeft = center.x * frame.scrollWidth - frame.clientWidth / 2;
      frame.scrollTop = center.y * frame.scrollHeight - frame.clientHeight / 2;
      this.center = this.readCenter(frame);
      sync();
    };
    out.addEventListener('click', () => step(-1));
    inn.addEventListener('click', () => step(1));
    sync();
    box.append(out, level, inn);
    return box;
  }

  private readCenter(frame: HTMLElement) {
    return {
      x: (frame.scrollLeft + frame.clientWidth / 2) / Math.max(frame.scrollWidth, 1),
      y: (frame.scrollTop + frame.clientHeight / 2) / Math.max(frame.scrollHeight, 1),
    };
  }

  private bindPan(frame: HTMLElement) {
    let drag: { x: number; y: number; left: number; top: number; moved: boolean } | null = null;
    let suppress = false;
    frame.addEventListener('scroll', () => { this.center = this.readCenter(frame); });
    frame.addEventListener('pointerdown', event => {
      if (event.pointerType !== 'mouse' || event.button !== 0) return;
      drag = { x: event.clientX, y: event.clientY, left: frame.scrollLeft, top: frame.scrollTop, moved: false };
    });
    frame.addEventListener('pointermove', event => {
      if (!drag) return;
      const dx = event.clientX - drag.x;
      const dy = event.clientY - drag.y;
      if (!drag.moved && Math.hypot(dx, dy) < 4) return;
      if (!drag.moved) {
        drag.moved = true;
        frame.setPointerCapture(event.pointerId);
        frame.classList.add('is-dragging');
      }
      frame.scrollLeft = drag.left - dx;
      frame.scrollTop = drag.top - dy;
    });
    const end = () => {
      if (drag?.moved) suppress = true;
      drag = null;
      frame.classList.remove('is-dragging');
    };
    frame.addEventListener('pointerup', end);
    frame.addEventListener('pointercancel', end);
    frame.addEventListener('click', event => {
      if (!suppress) return;
      suppress = false;
      event.stopPropagation();
      event.preventDefault();
    }, true);
  }

  /* 只有关系档案启用后才提示风险；只读现有变量，不写回 MVU */
  private risk(data: HudData | null, node: MapNode) {
    if (!relationEnabled(data)) return null;
    const seen: string[] = [];
    let score = 0;
    CHARACTERS.forEach(char => {
      const woman = relationWoman(data, char.name);
      if (!woman) return;
      const here = heroineNode(data, char)?.id === node.id;
      score = Math.max(score, (woman.风险 ?? 0) + (here ? 15 : 0));
      if (here) seen.push(`${char.name}此刻就在「${node.label}」`);
      woman.知情.forEach(({ 人, 知道 }) => {
        const text = String(知道 ?? '').trim();
        if (!人 || !text || BLIND_KNOWLEDGE.includes(text)) return;
        seen.push(`${人}（${text}）`);
      });
    });
    score = Math.min(100, score);
    const level = score >= 50 ? '高' : score < 25 ? '低' : '中';
    const box = make('div', `map-risk${level === '高' ? ' is-high' : level === '低' ? ' is-low' : ''}`);
    box.append(make('p', 'map-risk-line', `可能被谁看见 · ${seen.length ? seen.join('；') : '此刻没人在意这里'}`));
    const traits = playerTraits(data);
    if (traits) {
      box.append(make('p', 'map-risk-player', `你以「${playerJob(data)}」的身份出现，${traits}在${node.region}很容易被记住。`));
    }
    box.append(make('small', 'map-risk-score', `风险 ${score}/100 · ${level}`));
    return box;
  }

  private detail(data: HudData | null, node: MapNode, canTravel: boolean) {
    const detail = make('div', `node-detail${this.lastDetail !== node.id ? ' is-new' : ''}`);
    this.lastDetail = node.id;
    detail.append(
      make('span', 'section-kicker', node.region),
      make('h4', '', node.label),
      make('p', '', node.description),
    );
    const placeState = getPath(data, `地图.地点状态.${node.label}`) as { 状态?: string; 备注?: string } | undefined;
    const note = [placeState?.状态, placeState?.备注].filter(Boolean).join(' · ');
    if (note) detail.append(make('small', '', note));
    CHARACTERS.forEach(char => {
      if (heroineNode(data, char)?.id !== node.id) return;
      const action = characterValue(data, char, '当前行动');
      detail.append(make('p', 'node-heroine', action === '待设定' ? `${char.name}在这里。` : `${char.name}在这里 · ${action}`));
    });
    const risk = this.risk(data, node);
    if (risk) detail.append(risk);
    const sprig = make('span', 'node-detail-sprig');
    sprig.innerHTML = lilySprigSvg();
    detail.append(sprig);
    if (canTravel) {
      const travel = make('button', 'travel-button', '选择前往');
      travel.type = 'button';
      travel.addEventListener('click', () => this.options.onTravel(`我决定前往「${node.label}」。`));
      detail.append(travel);
    }
    const close = make('button', 'node-close', '×');
    close.type = 'button';
    close.setAttribute('aria-label', '收起地点详情');
    close.addEventListener('click', () => {
      this.selected = null;
      this.options.rerender();
    });
    detail.append(close);
    return detail;
  }
}
