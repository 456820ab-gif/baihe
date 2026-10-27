import './style.scss';
import {
  chevronSvg,
  garlandSvg,
  lilySprigSvg,
  placePinSvg,
  postmarkSvg,
  stampFrameSvg,
  tabIconSvg,
  weatherLabel,
  weatherMarkSvg,
  weatherOverlaySvg,
  weatherTone,
} from './icons';
import {
  ZONES,
  heartGlyphSvg,
  heartbeatBpm,
  heartbeatSvg,
  stageOf,
  starChartSvg,
  zoneOf,
  type HeroinePoint,
} from './heroine';
import { flowerMarkPath, flowerMeta, flowerName, flowerSvg } from './flowers';
import { CHARACTERS, characterById, type CharacterDef, type FlowerId } from '../../characters';
import { relationAxisLabel, relationOf, relationWoman } from '../../脚本/主界面/relation';
import { mistDefsSvg } from './mist-defs';
import { CARTOUCHE, COMPASS, FLORA_ART, MAP_FIREFLIES, MAP_FLORA, MAP_HEIGHT, MAP_NODE_BY_ID, MAP_NODE_BY_LABEL, MAP_NODES, MAP_WIDTH, NODE_ART, REGION_COLORS, REGION_LABELS, RIVER_LABEL, RIVER_PATH, mapRoads, type MapNode } from './map';

type HudData = {
  环境: {
    日期: string;
    时间: string;
    天气: string;
    主题覆盖: string;
    地点: { 城市: string; 区域: string; 具体地点: string };
  };
  玩家: { _年龄?: number };
  玩家状态: {
    心情: string;
    精力: number | '待设定';
    身体状态: string;
    当前行动: string;
    关系姿态: string;
    当前穿着: string;
  };
  林清: {
    亲近: number | '待设定';
    心动: number | '待设定';
    心情: string;
    当前行动: string;
    当前穿着: string;
    关系身份: string;
    所在地点: string;
    心声: string;
  };
  苏玥: {
    亲近: number | '待设定';
    心动: number | '待设定';
    心情: string;
    当前行动: string;
    当前穿着: string;
    关系身份: string;
    所在地点: string;
    心声: string;
  };
  地图: {
    当前地点: string;
    地点状态: Record<string, { 状态: string; 备注: string }>;
  };
};

type HudSettings = {
  animate: boolean;
  scene: boolean;
  expanded: boolean;
};

type ThemeState = {
  daypart: 'day' | 'night';
  weather: string;
  override: string;
};

const SVG_NS = 'http://www.w3.org/2000/svg';
const SETTINGS_KEY = `YuriOpening:statusbar:settings:v1:${getCardSettingsId()}`;
const DEFAULT_SETTINGS: HudSettings = { animate: true, scene: true, expanded: false };
const OVERRIDE_LABELS: Record<string, string> = {
  自动: '自动场景',
  室内暖光: '室内暖光',
  特殊夜景: '特殊夜景',
  停电应急: '停电应急',
  节日灯光: '节日灯光',
};
const TAB_LABELS = { player: '玩家状态', heroine: '角色', map: '城市地图', settings: '设置' } as const;
type TabId = keyof typeof TAB_LABELS;

const PLAYER_FIELDS: Array<{ label: string; path: string; kind: 'text' | 'meter' }> = [
  { label: '心情', path: '玩家状态.心情', kind: 'text' },
  { label: '精力', path: '玩家状态.精力', kind: 'meter' },
  { label: '身体状态', path: '玩家状态.身体状态', kind: 'text' },
  { label: '当前行动', path: '玩家状态.当前行动', kind: 'text' },
  { label: '关系姿态', path: '玩家状态.关系姿态', kind: 'text' },
  { label: '当前穿着', path: '玩家状态.当前穿着', kind: 'text' },
];

function characterFields(char: CharacterDef): Array<{ label: string; path: string; kind: 'text' | 'meter' }> {
  return [
    { label: '亲近', path: `${char.varRoot}.亲近`, kind: 'meter' },
    { label: '心动', path: `${char.varRoot}.心动`, kind: 'meter' },
    { label: '当前行动', path: `${char.varRoot}.当前行动`, kind: 'text' },
    { label: '当前穿着', path: `${char.varRoot}.当前穿着`, kind: 'text' },
    { label: '所在地点', path: `${char.varRoot}.所在地点`, kind: 'text' },
  ];
}
const HEROINE_TRAIL_LENGTH = 5;
const HEROINE_HISTORY_SCAN = 16;

let active = true;
let root: HTMLElement | null = null;
let shell: HTMLElement | null = null;
let panel: HTMLElement | null = null;
let panelBody: HTMLElement | null = null;
let statusText: HTMLElement | null = null;
let activeTab: TabId = 'player';
let panelOpen = false;
let selectedNodeId: string | null = null;
// 面板每次数据更新都会整体重建；只有换页或重新展开时才播放入场动画，否则每次 MVU 更新都会闪一下。
let lastRenderedTab: TabId | null = null;
let mapIntroPlayed = false;
let lastDetailNodeId: string | null = null;
// 同一楼同一组数值只在第一次渲染时播放滑动与生长，之后的重建保持静止。
let selectedCharacter: string | null = null;
let lastHeroineKey: string | null = null;
let voiceOpenFor: string | null = null;
let settings = loadSettings();
const disposers: Array<() => void> = [];

const MAP_ZOOM_LEVELS = [0.5, 0.75, 1, 1.3, 1.7];
const MAP_DEFAULT_ZOOM_INDEX = 2;
let mapZoomIndex = MAP_DEFAULT_ZOOM_INDEX;
// 地图每次点地点都会整体重建，用视口中心占画布的比例记住位置，重建后恢复。
let mapCenter: { x: number; y: number } | null = null;

function getCardSettingsId() {
  try {
    return String(SillyTavern.characterId ?? 'current');
  } catch {
    return 'current';
  }
}

function loadSettings(): HudSettings {
  try {
    const parsed = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}') as Partial<HudSettings>;
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function saveSettings() {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // 部分 srcdoc 环境不提供持久化存储，设置只在本次会话内生效。
  }
}

function hostDocument(): Document {
  try {
    const parent = window.parent;
    if (parent && parent !== window && parent.document) return parent.document;
  } catch {
    // 跨域时退回本 iframe 文档。
  }
  return document;
}

/** 花期图集：按档位取随卡内嵌的状态图（优先本窗口，其次宿主窗口），取不到返回 null */
function bloomArtSource(flower: FlowerId, leaf: number, bloom: number): string | null {
  type ArtWindow = { __flowerArt?: Record<string, string> };
  const key = `${flower}-${leaf}${bloom}`;
  const candidates: Array<Record<string, string> | undefined> = [];
  try {
    candidates.push((window as unknown as ArtWindow).__flowerArt);
  } catch {
    // 读取失败时忽略，继续看宿主窗口。
  }
  try {
    const host = window.parent as unknown as ArtWindow;
    if (window.parent !== window) candidates.push(host.__flowerArt);
  } catch {
    // 跨域时拿不到宿主图集，回退线稿。
  }
  for (const map of candidates) {
    const src = map?.[key];
    if (src) return src;
  }
  return null;
}

/** 有状态图时以正片叠底垫进花期卡片；缺图时保持线稿植株原样 */
function applyBloomArt(box: HTMLElement, flower: FlowerId, leaf: number, bloom: number, closeDown: boolean): void {
  const src = bloomArtSource(flower, leaf, bloom);
  if (!src) return;
  const svg = box.querySelector('.bloom-svg');
  if (!svg) return;
  const stage = document.createElement('div');
  stage.className = 'bloom-stage';
  svg.replaceWith(stage);
  const art = document.createElement('img');
  art.className = 'bloom-art';
  art.alt = '';
  art.src = src;
  stage.append(art, svg);
  box.classList.add('has-art');
  if (closeDown) box.classList.add('is-closing');
}

function createElement<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function createSvg<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attributes?: Record<string, string | number>,
): SVGElementTagNameMap[K] {
  const element = document.createElementNS(SVG_NS, tag);
  if (attributes) {
    Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, String(value)));
  }
  return element;
}

function readData(): HudData | null {
  try {
    const variables = getVariables({ type: 'message', message_id: getCurrentMessageId() });
    const data = _.get(variables, 'stat_data');
    return data && typeof data === 'object' ? (data as HudData) : null;
  } catch {
    return null;
  }
}

function readPath(data: HudData | null, path: string, fallback = '待设定'): string {
  const value = _.get(data, path);
  if (value === undefined || value === null || value === '') return fallback;
  return String(value);
}

function isUnset(value: string) {
  return value === '待设定' || value === '';
}









function getDaypart(time: string): 'day' | 'night' {
  const match = time.match(/(\d{1,2})[:：](\d{2})/);
  if (!match) return 'day';
  const hour = Number(match[1]);
  return hour >= 6 && hour < 18 ? 'day' : 'night';
}

function resolveTheme(data: HudData | null): ThemeState {
  return {
    daypart: getDaypart(readPath(data, '环境.时间')),
    weather: readPath(data, '环境.天气'),
    override: readPath(data, '环境.主题覆盖', '自动'),
  };
}

function setText(selector: string, value: string) {
  const element = shell?.querySelector<HTMLElement>(selector);
  if (element) element.textContent = value;
}

function renderSnapshot(data: HudData | null, theme: ThemeState) {
  if (!shell) return;
  shell.dataset.daypart = theme.daypart;
  shell.dataset.weather = weatherTone(theme.weather);
  shell.dataset.override = theme.override;
  shell.dataset.animate = settings.animate ? 'true' : 'false';
  shell.dataset.scene = settings.scene ? 'true' : 'false';
  const weatherSlot = shell.querySelector<HTMLElement>('[data-role="snapshot-weather"]');
  if (weatherSlot) weatherSlot.dataset.weather = theme.weather;
  setText('[data-role="weather-label"]', weatherLabel(theme.weather));
  setText('[data-role="date"]', readPath(data, '环境.日期'));
  setText('[data-role="time"]', readPath(data, '环境.时间'));
  setText('[data-role="place"]', formatPlace(data));
  setText('[data-role="weather-note"]', getWeatherNote(theme));
  const mark = shell.querySelector<HTMLElement>('[data-role="weather-mark"]');
  if (mark) {
    mark.innerHTML = weatherMarkSvg(theme.weather);
    mark.setAttribute('aria-label', weatherLabel(theme.weather));
  }
  if (panel && panelOpen) renderPanel(data, theme);
}

function formatPlace(data: HudData | null) {
  const parts = [
    readPath(data, '环境.地点.城市'),
    readPath(data, '环境.地点.区域'),
    readPath(data, '环境.地点.具体地点'),
  ].filter(value => !isUnset(value));
  return parts.join(' · ') || '地点待设定';
}

function getWeatherNote(theme: ThemeState) {
  if (!settings.scene) return '默认静态样式';
  if (!isUnset(theme.override) && theme.override !== '自动') {
    return OVERRIDE_LABELS[theme.override] ?? theme.override;
  }
  if (theme.daypart === 'night') return isUnset(theme.weather) ? '夜色待定' : `夜间 · ${theme.weather}`;
  return isUnset(theme.weather) ? '白昼待定' : `白昼 · ${theme.weather}`;
}

function renderPanel(data: HudData | null, theme: ThemeState) {
  if (!panelBody) return;
  while (panelBody.firstChild) panelBody.removeChild(panelBody.firstChild);
  const tabIds = Object.keys(TAB_LABELS) as TabId[];
  const entering = lastRenderedTab !== activeTab;
  if (entering && activeTab === 'map') mapIntroPlayed = false;
  const tabs = createElement('div', 'hud-tabs');
  tabs.style.setProperty('--tab-n', String(tabIds.length));
  tabIds.forEach(tab => {
    const button = createElement('button', `hud-tab${tab === activeTab ? ' is-active' : ''}`);
    button.innerHTML = tabIconSvg(tab);
    button.appendChild(createElement('span', 'hud-tab-label', TAB_LABELS[tab]));
    button.type = 'button';
    button.setAttribute('aria-pressed', String(tab === activeTab));
    button.addEventListener('click', () => {
      activeTab = tab;
      renderPanel(data, theme);
    });
    tabs.appendChild(button);
  });
  const ink = createElement('span', 'hud-tab-ink');
  ink.style.setProperty('--tab-i', String(tabIds.indexOf(lastRenderedTab ?? activeTab)));
  tabs.appendChild(ink);
  panelBody.appendChild(tabs);
  if (lastRenderedTab && entering) {
    // 先按上一页的位置算一次样式，再改到新位置，下划线才会滑过去而不是直接跳。
    void ink.offsetWidth;
    ink.style.setProperty('--tab-i', String(tabIds.indexOf(activeTab)));
  }
  lastRenderedTab = activeTab;
  const content = createElement('div', `hud-panel-content${entering ? ' is-entering' : ''}`);
  const relationSummary = renderRelationSummary(data);
  if (relationSummary) content.appendChild(relationSummary);
  if (activeTab === 'player') content.appendChild(renderPlayer(data));
  if (activeTab === 'heroine') content.appendChild(renderCharacterTab(data, entering, theme));
  if (activeTab === 'map') content.appendChild(renderMap(data, theme));
  if (activeTab === 'settings') content.appendChild(renderSettings(data, theme));
  panelBody.appendChild(content);
  const frame = content.querySelector<HTMLElement>('.map-frame');
  if (frame) restoreMapCenter(frame, data);
  const marker = content.querySelector<SVGGElement>('.chart-marker[data-to]');
  if (marker) {
    // 标记先停在上一楼的位置，挂进文档后再改到新位置，由 CSS 过渡滑过去。
    marker.getBoundingClientRect();
    marker.style.transform = marker.dataset.to ?? '';
  }
}

function sectionHeading(title: string, subtitle: string) {
  const heading = createElement('div', 'section-heading');
  heading.appendChild(createElement('span', 'section-kicker', subtitle));
  heading.appendChild(createElement('h3', '', title));
  heading.insertAdjacentHTML(
    'beforeend',
    '<svg class="heading-flourish" viewBox="0 0 120 18" aria-hidden="true"><path pathLength="1" d="M1,12 C16,10 30,14.5 42,13.5 C50,12.8 55,17 60,14.5 C66,11.5 71.5,8.5 71.5,5 C71.5,2.2 69,0.5 66,0.5 C63.2,0.5 60.8,2.3 60,5 C59.2,2.3 56.8,0.5 54,0.5 C51,0.5 48.5,2.2 48.5,5 C48.5,8.5 54,11.5 60,14.5 C65,17 70,12.8 78,13.5 C90,14.5 104,10 119,12" /></svg>',
  );
  return heading;
}

function renderPlayer(data: HudData | null) {
  const section = createElement('section', 'status-section');
  section.appendChild(sectionHeading('玩家状态', '这一刻的你'));
  const list = createElement('div', 'status-list');
  PLAYER_FIELDS.forEach((field, index) => {
    const row = createElement('div', 'status-row');
    row.style.setProperty('--i', String(index));
    row.appendChild(createElement('span', 'status-index', String(index + 1).padStart(2, '0')));
    row.appendChild(createElement('span', 'status-name', field.label));
    row.appendChild(
      field.kind === 'meter'
        ? renderMeter(data, field.path)
        : renderFigure(data, field.path),
    );
    list.appendChild(row);
  });
  section.appendChild(list);
  return section;
}

function riskClass(value: number | null) {
  if (value === null) return '';
  if (value >= 50) return ' is-high';
  if (value < 25) return ' is-low';
  return '';
}

/* 关系摘要只读存档里的「关系」；档案不存在时整块不出现 */
function renderRelationSummary(data: HudData | null) {
  if (!relationOf(data)) return null;
  const section = createElement('section', 'status-section status-relation');
  section.appendChild(sectionHeading('关系', '只有你看得见'));
  const list = createElement('div', 'status-relation-list');

  CHARACTERS.forEach(char => {
    const woman = relationWoman(data, char.name);
    if (!woman) return;
    const row = createElement('div', 'status-relation-row');
    row.dataset.character = char.id;
    row.style.setProperty('--char-accent', char.accent);

    const identity = readPath(data, `${char.varRoot}.关系身份`);
    const who = createElement('span', 'status-relation-who');
    who.appendChild(createElement('strong', 'status-relation-name', char.name));
    who.appendChild(
      createElement(
        'span',
        `status-relation-identity${isUnset(identity) ? ' is-unset' : ''}`,
        isUnset(identity) ? '未设定' : identity,
      ),
    );

    const facts = createElement('span', 'status-relation-facts');
    facts.appendChild(
      createElement('span', 'status-relation-tier', `私密 · ${relationAxisLabel('私密', woman.私密)}`),
    );
    facts.appendChild(
      createElement('span', `status-relation-risk${riskClass(woman.风险)}`, `风险 · ${relationAxisLabel('风险', woman.风险)}`),
    );
    if (woman.修罗场 !== '无') {
      const tense = woman.修罗场 === '撞见' || woman.修罗场 === '摊牌';
      facts.appendChild(createElement('span', `status-relation-scene${tense ? ' is-high' : ''}`, `修罗场 · ${woman.修罗场}`));
    }

    row.append(who, facts);
    list.appendChild(row);
  });

  if (!list.childElementCount) return null;
  section.appendChild(list);
  return section;
}

function renderFigure(data: HudData | null, path: string) {
  const value = readPath(data, path);
  const figure = createElement('span', `status-figure${isUnset(value) ? ' is-unset' : ''}`, value);
  return figure;
}

function renderMeter(data: HudData | null, path: string) {
  const raw = _.get(data, path);
  const box = createElement('span', 'status-meter');
  if (typeof raw !== 'number' || !Number.isFinite(raw)) {
    box.appendChild(createElement('span', 'status-figure is-unset', '待设定'));
    return box;
  }
  const value = Math.max(0, Math.min(100, Math.round(raw)));
  const track = createElement('span', 'meter-track');
  const fill = createElement('span', 'meter-fill');
  fill.style.width = `${value}%`;
  track.appendChild(fill);
  box.appendChild(track);
  box.appendChild(createElement('span', 'meter-figure', String(value)));
  return box;
}

function safeMessageId() {
  try {
    return getCurrentMessageId();
  } catch {
    return -1;
  }
}

function readHeroinePoint(data: unknown, char: CharacterDef): HeroinePoint | null {
  const close = _.get(data, `${char.varRoot}.亲近`);
  const heart = _.get(data, `${char.varRoot}.心动`);
  if (typeof close !== 'number' || typeof heart !== 'number') return null;
  if (!Number.isFinite(close) || !Number.isFinite(heart)) return null;
  return { close: _.clamp(Math.round(close), 0, 100), heart: _.clamp(Math.round(heart), 0, 100) };
}

function samePoint(a: HeroinePoint, b: HeroinePoint) {
  return a.close === b.close && a.heart === b.heart;
}

// 足迹取自往前若干楼的楼层变量；老存档没有该角色数据的楼层直接跳过。
function readHeroineHistory(current: HeroinePoint, char: CharacterDef) {
  const id = safeMessageId();
  let previous: HeroinePoint | null = null;
  const trail: HeroinePoint[] = [];
  let newer = current;
  for (let index = id - 1; index >= 0 && index >= id - HEROINE_HISTORY_SCAN; index -= 1) {
    if (trail.length >= HEROINE_TRAIL_LENGTH) break;
    let point: HeroinePoint | null;
    try {
      point = readHeroinePoint(_.get(getVariables({ type: 'message', message_id: index }), 'stat_data'), char);
    } catch {
      break;
    }
    if (!point) continue;
    previous ??= point;
    if (samePoint(point, newer)) continue;
    trail.unshift(point);
    newer = point;
  }
  return { previous, trail };
}

function heroineNode(data: HudData | null, char: CharacterDef) {
  return MAP_NODE_BY_LABEL.get(readPath(data, `${char.varRoot}.所在地点`, ''));
}

function formatDelta(value: number) {
  return value > 0 ? `+${value}` : `−${Math.abs(value)}`;
}

/* ── 角色页签：列表 → 详情 两级导航 ─────────────────────────── */

function rerenderPanel() {
  const latest = readData();
  renderPanel(latest, latest ? resolveTheme(latest) : { daypart: 'day', weather: '待设定', override: '自动' });
}

function switchCharacter(next: string | null) {
  selectedCharacter = next;
  rerenderPanel();
}







function renderCharStat(label: string, value: number | null) {
  const row = createElement('span', 'char-stat');
  row.appendChild(createElement('span', 'char-stat-label', label));
  const track = createElement('span', 'char-stat-track');
  const fill = createElement('span', 'char-stat-fill');
  if (value !== null) fill.style.width = `${value}%`;
  track.appendChild(fill);
  row.appendChild(track);
  row.appendChild(createElement('span', 'char-stat-figure', value === null ? '—' : String(value)));
  return row;
}

function renderCharacterList(data: HudData | null) {
  const section = createElement('section', 'status-section heroine-section char-list-section');
  section.appendChild(sectionHeading('角色', '她们的故事'));

  const list = createElement('div', 'char-list');
  CHARACTERS.forEach(char => {
    const point = readHeroinePoint(data, char);
    const relation = readPath(data, `${char.varRoot}.关系身份`);
    const met = point !== null || !isUnset(relation);
    const zone = point ? zoneOf(point) : null;
    const action = readPath(data, `${char.varRoot}.当前行动`);

    const item = createElement('button', `char-item${met ? '' : ' is-unmet'}`);
    item.type = 'button';
    item.dataset.character = char.id;
    item.style.setProperty('--char-accent', char.accent);
    item.style.setProperty('--char-accent-soft', char.accentSoft);
    item.style.setProperty('--char-jade', char.jade);

    const roundel = createElement('span', 'char-item-roundel');
    roundel.innerHTML =
      '<svg viewBox="0 0 30 30" aria-hidden="true">' +
      '<circle class="char-roundel-ring" cx="15" cy="15" r="14" />' +
      `<path class="char-roundel-flower" d="${flowerMarkPath(char.flower, 8)}" transform="translate(15, 15)" />` +
      '</svg>';
    item.appendChild(roundel);

    const info = createElement('span', 'char-item-info');
    const nameLine = createElement('span', 'char-item-name-line');
    nameLine.appendChild(createElement('strong', 'char-item-name', char.name));
    if (met) {
      if (zone) nameLine.appendChild(createElement('span', `heroine-zone is-${zone}`, ZONES[zone].label));
      if (!isUnset(relation)) nameLine.appendChild(createElement('span', 'char-item-relation', relation));
    }
    info.appendChild(nameLine);
    info.appendChild(
      createElement('small', 'char-item-hint', met ? (isUnset(action) ? '行踪未定' : action) : '还没有遇见她'),
    );
    item.appendChild(info);

    const stats = createElement('span', 'char-item-stats');
    stats.appendChild(renderCharStat('亲近', point ? point.close : null));
    stats.appendChild(renderCharStat('心动', point ? point.heart : null));
    item.appendChild(stats);

    item.appendChild(createElement('span', 'char-item-arrow', '›'));
    item.addEventListener('click', () => switchCharacter(char.id));
    list.appendChild(item);
  });
  section.appendChild(list);
  return section;
}

function renderCharacterTab(data: HudData | null, entering: boolean, theme: ThemeState) {
  const char = selectedCharacter ? characterById(selectedCharacter) : null;
  if (!char) return renderCharacterList(data);
  return renderCharacterDetail(data, entering, theme, char);
}

function renderCharacterDetail(data: HudData | null, entering: boolean, theme: ThemeState, char: CharacterDef) {
  const section = createElement('section', 'status-section heroine-section char-panel');
  section.dataset.character = char.id;
  // 身份色作用域：重映射 HUD 强调变量，花期/星图/心跳/进度条整套换色（纸面仍随场景）
  section.style.setProperty('--hud-accent', char.accent);
  section.style.setProperty('--hud-accent-soft', char.accentSoft);
  section.style.setProperty('--hud-jade', char.jade);
  section.style.setProperty('--hud-glow', char.glow);

  const back = createElement('button', 'char-back');
  back.type = 'button';
  back.innerHTML = '<span class="char-back-arrow">‹</span> 全部角色';
  back.addEventListener('click', () => switchCharacter(null));
  section.appendChild(back);

  section.appendChild(sectionHeading(char.name, char.subtitle));

  const point = readHeroinePoint(data, char);
  const relation = readPath(data, `${char.varRoot}.关系身份`);
  const met = point !== null || !isUnset(relation);
  const { previous, trail } = point ? readHeroineHistory(point, char) : { previous: null, trail: [] };
  const key = `${char.id}:${safeMessageId()}:${point ? `${point.close},${point.heart}` : 'unset'}`;
  const play = entering || key !== lastHeroineKey;
  lastHeroineKey = key;
  const zone = point ? zoneOf(point) : null;

  const card = createElement('div', 'heroine-card');
  const seal = createElement('span', `heroine-seal${isUnset(relation) ? ' is-unset' : ''}`);
  seal.appendChild(createElement('small', '', '关系'));
  seal.appendChild(createElement('strong', '', isUnset(relation) ? '未定' : relation));
  const id = createElement('div', 'heroine-id');
  const nameLine = createElement('div', 'heroine-name-line');
  nameLine.appendChild(createElement('strong', 'heroine-name', char.name));
  const mood = readPath(data, `${char.varRoot}.心情`);
  nameLine.appendChild(createElement('span', `heroine-mood${isUnset(mood) ? ' is-unset' : ''}`, mood));
  if (zone) nameLine.appendChild(createElement('span', `heroine-zone is-${zone}`, ZONES[zone].label));
  id.appendChild(nameLine);
  id.appendChild(
    createElement('small', 'heroine-hint', zone ? ZONES[zone].hint : '她还没出现在星图上——等故事走到她身边。'),
  );
  card.append(seal, id);
  section.appendChild(card);

  const figures = createElement('div', `heroine-figures${play ? ' is-playing' : ''}`);
  const chart = createElement('figure', 'heroine-chart-box');
  const from = play && previous && point && !samePoint(previous, point) ? previous : null;
  chart.innerHTML = starChartSvg({ point, trail, from, mark: flowerMarkPath(char.flower, 7.5) });
  chart.appendChild(createElement('figcaption', '', trail.length ? `关系星图 · 近 ${trail.length} 次足迹` : '关系星图'));
  figures.appendChild(chart);

  const flower = flowerMeta(char.flower);
  const bloomBox = createElement('figure', 'heroine-bloom-box');
  if (point) {
    const leaf = stageOf(point.close);
    const bloom = stageOf(point.heart);
    const heartDown = Boolean(previous && point.heart < previous.heart && stageOf(previous.heart) > 0);
    const closeDown = Boolean(previous && point.close < previous.close);
    bloomBox.dataset.leaf = String(leaf);
    bloomBox.dataset.bloom = String(bloom);
    bloomBox.innerHTML = flowerSvg(char.flower, {
      leaf,
      bloom,
      heartDown,
      closeDown,
      weather: theme.weather,
      defs: mistDefsSvg(),
    });
    applyBloomArt(bloomBox, char.flower, leaf, bloom, closeDown);
    const caption = createElement('figcaption');
    caption.appendChild(createElement('strong', 'bloom-name', flowerName(char.flower, leaf, bloom)));
    caption.appendChild(
      createElement('small', '', `枝叶 · ${flower.leafStages[leaf]}\u3000花 · ${flower.bloomStages[bloom]}`),
    );
    bloomBox.appendChild(caption);
  } else {
    bloomBox.innerHTML = flowerSvg(char.flower, null);
    const caption = createElement('figcaption');
    caption.appendChild(createElement('strong', 'bloom-name is-unset', '尚未播种'));
    caption.appendChild(createElement('small', '', flower.period));
    bloomBox.appendChild(caption);
  }
  figures.appendChild(bloomBox);
  section.appendChild(figures);

  if (point && previous && !samePoint(point, previous)) {
    const delta = createElement('div', `heroine-delta${play ? ' is-new' : ''}`);
    delta.appendChild(createElement('span', 'delta-label', '较上一楼'));
    const changes: Array<[string, number]> = [
      ['亲近', point.close - previous.close],
      ['心动', point.heart - previous.heart],
    ];
    changes
      .filter(([, value]) => value !== 0)
      .forEach(([label, value]) => {
        delta.appendChild(
          createElement('span', `delta-chip ${value > 0 ? 'is-up' : 'is-down'}`, `${label} ${formatDelta(value)}`),
        );
      });
    section.appendChild(delta);
  }

  const pulse = createElement('div', `heroine-pulse${point ? '' : ' is-idle'}`);
  pulse.innerHTML = heartGlyphSvg() + heartbeatSvg();
  if (point) {
    const bpm = heartbeatBpm(point.heart);
    pulse.style.setProperty('--beat', `${(60 / bpm).toFixed(2)}s`);
    pulse.appendChild(createElement('span', 'pulse-figure', `心跳 ${bpm}`));
  } else {
    pulse.appendChild(createElement('span', 'pulse-figure', '心跳 —'));
  }
  section.appendChild(pulse);

  const list = createElement('div', 'status-list');
  const visibleFields = characterFields(char);
  visibleFields.forEach((field, index) => {
    const row = createElement('div', 'status-row');
    row.style.setProperty('--i', String(index));
    row.appendChild(createElement('span', 'status-index', String(index + 1).padStart(2, '0')));
    row.appendChild(createElement('span', 'status-name', field.label));
    row.appendChild(
      field.kind === 'meter'
        ? renderMeter(data, field.path)
        : renderFigure(data, field.path),
    );
    list.appendChild(row);
  });
  section.appendChild(list);

  const node = heroineNode(data, char);
  if (node) {
    const locate = createElement('button', 'heroine-locate', '在地图上找她');
    locate.type = 'button';
    locate.addEventListener('click', () => {
      activeTab = 'map';
      selectedNodeId = node.id;
      mapCenter = { x: node.x / MAP_WIDTH, y: node.y / MAP_HEIGHT };
      rerenderPanel();
    });
    section.appendChild(locate);
  }

  const voice = readPath(data, `${char.varRoot}.心声`, '');
  if (voice) section.appendChild(renderVoice(voice));
  return section;
}

function renderVoice(voice: string) {
  const open = voiceOpenFor === voice;
  const note = createElement('button', `heroine-voice${open ? ' is-open' : ''}`);
  note.type = 'button';
  note.setAttribute('aria-expanded', String(open));
  note.appendChild(createElement('span', 'voice-tape'));
  note.appendChild(createElement('span', 'voice-label', '她没说出口的话'));
  note.appendChild(createElement('span', 'voice-text', voice));
  const hint = createElement('span', 'voice-hint', open ? '轻触合上' : '轻触翻开');
  note.appendChild(hint);
  note.addEventListener('click', () => {
    const next = !note.classList.contains('is-open');
    voiceOpenFor = next ? voice : null;
    note.classList.toggle('is-open', next);
    note.setAttribute('aria-expanded', String(next));
    hint.textContent = next ? '轻触合上' : '轻触翻开';
  });
  return note;
}

function currentNode(data: HudData | null) {
  return MAP_NODE_BY_LABEL.get(readPath(data, '地图.当前地点', ''));
}

function buildHeroinePin(node: MapNode, char: CharacterDef, offsetX: number) {
  const group = createSvg('g', { class: 'heroine-pin', transform: `translate(${node.x + 17 + offsetX}, ${node.y - 15})` });
  group.dataset.character = char.id;
  group.style.setProperty('--pin-accent', char.accent);
  const bob = createSvg('g', { class: 'heroine-pin-bob' });
  bob.appendChild(createSvg('ellipse', { cx: 0, cy: 9.5, rx: 3.2, ry: 1.1, class: 'heroine-pin-shadow' }));
  bob.appendChild(
    createSvg('path', { d: 'M0,9 C-2.6,5.8 -6.5,3.2 -6.5,-1.5 A6.5,6.5 0 1,1 6.5,-1.5 C6.5,3.2 2.6,5.8 0,9 Z', class: 'heroine-pin-body' }),
  );
  bob.appendChild(createSvg('path', { d: flowerMarkPath(char.flower, 4.4), transform: 'translate(0, -1.6)', class: 'heroine-pin-flower' }));
  group.appendChild(bob);
  return group;
}

function buildMapCanvas(data: HudData | null, weatherName: string) {
  const currentId = currentNode(data)?.id;
  const svg = createSvg('svg', {
    viewBox: `0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`,
    class: `map-canvas${mapIntroPlayed ? '' : ' is-intro'}`,
    role: 'img',
    preserveAspectRatio: 'xMidYMid meet',
  });
  mapIntroPlayed = true;

  svg.appendChild(createSvg('rect', { x: 0, y: 0, width: MAP_WIDTH, height: MAP_HEIGHT, class: 'map-ground' }));

  // 雾絮的径向渐变：SVG 的 url() 不能跨元素引用，每张画布各带一份 defs
  svg.insertAdjacentHTML('beforeend', mistDefsSvg());

  svg.appendChild(createSvg('path', { d: RIVER_PATH, class: 'map-water' }));
  svg.appendChild(createSvg('path', { d: RIVER_PATH, class: 'map-water-flow' }));
  svg.appendChild(createSvg('path', { d: RIVER_PATH, class: 'map-water-edge' }));
  svg.appendChild(buildRiverLabel());

  // 天气层垫在河道之上、地点之下，并置 pointer-events:none，
  // 否则会挡住地点点击与地图拖动。
  const weather = weatherOverlaySvg(weatherName, MAP_WIDTH, MAP_HEIGHT);
  if (weather) svg.insertAdjacentHTML('beforeend', weather);

  MAP_FLORA.forEach((flora, index) => svg.appendChild(buildFlora(flora, index)));

  REGION_LABELS.forEach(label => {
    const group = createSvg('g', { class: 'map-region' });
    group.style.setProperty('--region', REGION_COLORS[label.text] ?? 'var(--hud-muted)');
    const text = createSvg('text', { x: label.x, y: label.y, class: 'map-label' });
    text.textContent = label.text;
    const sub = createSvg('text', { x: label.x, y: label.y + 7.5, class: 'map-label-sub' });
    sub.textContent = label.sub;
    group.append(text, sub);
    svg.appendChild(group);
  });

  mapRoads().forEach(({ d }) => {
    svg.appendChild(createSvg('path', { d, class: 'map-road', pathLength: 1 }));
    svg.appendChild(createSvg('path', { d, class: 'map-road-inner' }));
  });

  MAP_FIREFLIES.forEach((fly, index) => {
    const dot = createSvg('circle', { cx: fly.x, cy: fly.y, r: 1.6, class: 'map-firefly' });
    dot.style.animationDelay = `${-index * 1.3}s`;
    svg.appendChild(dot);
  });

  svg.appendChild(buildCompass());
  svg.appendChild(buildCartouche());

  MAP_NODES.forEach((node, index) => {
    svg.appendChild(buildNode(node, node.id === currentId, index));
  });

  CHARACTERS.forEach((char, index) => {
    const node = heroineNode(data, char);
    if (!node) return;
    const offset = (index - (CHARACTERS.length - 1) / 2) * 18;
    svg.appendChild(buildHeroinePin(node, char, offset));
  });

  return svg;
}

function buildRiverLabel() {
  const text = createSvg('text', { class: 'map-river-label' });
  Array.from(RIVER_LABEL.text).forEach((char, index) => {
    const span = createSvg('tspan', { x: RIVER_LABEL.x, y: RIVER_LABEL.y + index * 10 });
    span.textContent = char;
    text.appendChild(span);
  });
  return text;
}

function buildFlora(flora: (typeof MAP_FLORA)[number], index: number) {
  const art = FLORA_ART[flora.kind];
  const group = createSvg('g', { class: `map-flora is-${flora.kind}`, transform: `translate(${flora.x}, ${flora.y})` });
  const sway = createSvg('g', { class: 'flora-sway' });
  sway.style.animationDelay = `${-index * 0.7}s`;
  sway.appendChild(createSvg('path', { d: art.line, class: 'flora-line' }));
  if (art.fill) sway.appendChild(createSvg('path', { d: art.fill, class: 'flora-fill' }));
  group.appendChild(sway);
  return group;
}

function buildCompass() {
  const group = createSvg('g', { class: 'map-compass', transform: `translate(${COMPASS.x}, ${COMPASS.y})` });
  group.appendChild(createSvg('circle', { r: 13, class: 'compass-ring' }));
  group.appendChild(createSvg('circle', { r: 9.5, class: 'compass-ring-inner' }));
  const needle = createSvg('g', { class: 'compass-needle' });
  needle.appendChild(createSvg('path', { d: 'M0,-11 L2.6,0 L-2.6,0 Z', class: 'compass-north' }));
  needle.appendChild(createSvg('path', { d: 'M0,11 L2.6,0 L-2.6,0 Z', class: 'compass-south' }));
  group.appendChild(needle);
  const letter = createSvg('text', { y: -15.5, class: 'compass-letter' });
  letter.textContent = 'N';
  group.appendChild(letter);
  return group;
}

function buildCartouche() {
  const group = createSvg('g', { class: 'map-cartouche', transform: `translate(${CARTOUCHE.x}, ${CARTOUCHE.y})` });
  group.appendChild(createSvg('path', { d: 'M-44,-6 L-53,-6 L-49,0 L-53,6 L-44,6 Z', class: 'cartouche-tail' }));
  group.appendChild(createSvg('path', { d: 'M44,-6 L53,-6 L49,0 L53,6 L44,6 Z', class: 'cartouche-tail' }));
  group.appendChild(createSvg('rect', { x: -45, y: -9, width: 90, height: 18, class: 'cartouche-ribbon' }));
  const title = createSvg('text', { y: 0.5, class: 'cartouche-title' });
  title.textContent = '百合市';
  const sub = createSvg('text', { y: 6.2, class: 'cartouche-sub' });
  sub.textContent = 'LILY CITY · 2025';
  group.append(title, sub);
  return group;
}

function buildNode(node: MapNode, isCurrent: boolean, index: number) {
  const group = createSvg('g', {
    class: `map-node${isCurrent ? ' is-current' : ''}`,
    tabindex: 0,
    role: 'button',
    'aria-label': `${node.label}，${node.region}`,
  });
  group.style.setProperty('--i', String(index));
  if (node.nightGlow) {
    group.appendChild(createSvg('ellipse', { cx: node.x, cy: node.y, rx: 30, ry: 21, class: 'node-neon' }));
  }
  group.appendChild(createSvg('ellipse', { cx: node.x, cy: node.y, rx: 34, ry: 24, class: 'node-halo' }));
  if (isCurrent) {
    [0, 1].forEach(ring => {
      const ripple = createSvg('circle', { cx: node.x, cy: node.y, r: 18, class: 'node-ripple' });
      ripple.style.animationDelay = `${ring * 1.6}s`;
      group.appendChild(ripple);
    });
  }
  group.appendChild(createSvg('ellipse', { cx: node.x, cy: node.y, rx: 24, ry: 16, class: 'node-ground' }));

  const art = NODE_ART[node.id];
  if (art) {
    const drawing = createSvg('g', { transform: `translate(${node.x}, ${node.y})` });
    if (art.solid) drawing.appendChild(createSvg('path', { d: art.solid, class: 'node-art-solid' }));
    drawing.appendChild(createSvg('path', { d: art.body, class: 'node-art' }));
    group.appendChild(drawing);
  }

  const name = createSvg('text', { x: node.x, y: node.y + 30, class: 'node-name' });
  name.textContent = node.label;
  group.appendChild(name);

  group.appendChild(
    createSvg('circle', { cx: node.x, cy: node.y, r: 30, class: 'node-hit' }),
  );

  const activate = () => {
    selectedNodeId = node.id;
    const data = readData();
    renderPanel(data, data ? resolveTheme(data) : { daypart: 'day', weather: '待设定', override: '自动' });
  };
  group.addEventListener('click', activate);
  group.addEventListener('keydown', event => {
    if ((event as KeyboardEvent).key === 'Enter' || (event as KeyboardEvent).key === ' ') {
      event.preventDefault();
      activate();
    }
  });
  return group;
}

function renderMap(data: HudData | null, theme: ThemeState) {
  const section = createElement('section', 'status-section map-section');
  section.appendChild(sectionHeading('城市地图', '轻轻点开一处'));

  const current = currentNode(data);
  const viewport = createElement('div', 'map-viewport');
  const frame = createElement('div', 'map-frame');
  frame.style.setProperty('--map-zoom', String(MAP_ZOOM_LEVELS[mapZoomIndex]));
  frame.appendChild(buildMapCanvas(data, theme.weather));
  bindMapPan(frame);
  viewport.appendChild(frame);
  viewport.appendChild(buildZoomControls(frame));
  section.appendChild(viewport);
  const place = readPath(data, '地图.当前地点', '待设定');
  const where = current
    ? `你在「${current.label}」。`
    : isUnset(place)
      ? '第一段正文结束后会标出你的位置。'
      : '你现在不在百合市地图范围内。';
  const here = CHARACTERS.map(char => {
    const node = heroineNode(data, char);
    return node ? `${char.name}在「${node.label}」` : '';
  })
    .filter(Boolean)
    .join('，');
  const her = here ? `${here}。` : '';
  section.appendChild(
    createElement('p', 'map-hint', `${where}${her}滑动查看整张地图，右上角可缩放；点击地点查看详情。`),
  );

  if (selectedNodeId) {
    const selected = MAP_NODE_BY_ID.get(selectedNodeId);
    if (selected) {
      const isNew = selected.id !== lastDetailNodeId;
      lastDetailNodeId = selected.id;
      section.appendChild(renderNodeDetail(data, selected, selected.id !== current?.id, isNew));
    }
  } else {
    lastDetailNodeId = null;
  }
  return section;
}

function readMapCenter(frame: HTMLElement) {
  return {
    x: (frame.scrollLeft + frame.clientWidth / 2) / Math.max(frame.scrollWidth, 1),
    y: (frame.scrollTop + frame.clientHeight / 2) / Math.max(frame.scrollHeight, 1),
  };
}

function applyMapCenter(frame: HTMLElement, center: { x: number; y: number }) {
  frame.scrollLeft = center.x * frame.scrollWidth - frame.clientWidth / 2;
  frame.scrollTop = center.y * frame.scrollHeight - frame.clientHeight / 2;
}

function restoreMapCenter(frame: HTMLElement, data: HudData | null) {
  if (!mapCenter) {
    const node = currentNode(data);
    mapCenter = node ? { x: node.x / MAP_WIDTH, y: node.y / MAP_HEIGHT } : { x: 0.5, y: 0.5 };
  }
  applyMapCenter(frame, mapCenter);
}

function buildZoomControls(frame: HTMLElement) {
  const controls = createElement('div', 'map-zoom');
  const zoomOut = createElement('button', 'map-zoom-button', '−');
  const level = createElement('span', 'map-zoom-level');
  const zoomIn = createElement('button', 'map-zoom-button', '+');
  zoomOut.type = 'button';
  zoomIn.type = 'button';
  zoomOut.setAttribute('aria-label', '缩小地图');
  zoomIn.setAttribute('aria-label', '放大地图');

  const sync = () => {
    level.textContent = `${Math.round(MAP_ZOOM_LEVELS[mapZoomIndex] * 100)}%`;
    zoomOut.disabled = mapZoomIndex === 0;
    zoomIn.disabled = mapZoomIndex === MAP_ZOOM_LEVELS.length - 1;
  };
  const step = (delta: number) => {
    const next = Math.max(0, Math.min(MAP_ZOOM_LEVELS.length - 1, mapZoomIndex + delta));
    if (next === mapZoomIndex) return;
    const center = readMapCenter(frame);
    mapZoomIndex = next;
    frame.style.setProperty('--map-zoom', String(MAP_ZOOM_LEVELS[mapZoomIndex]));
    applyMapCenter(frame, center);
    mapCenter = readMapCenter(frame);
    sync();
  };
  zoomOut.addEventListener('click', () => step(-1));
  zoomIn.addEventListener('click', () => step(1));
  sync();

  controls.append(zoomOut, level, zoomIn);
  return controls;
}

// 触屏用原生滚动滑动；鼠标没有原生拖拽滚动，单独补上。
function bindMapPan(frame: HTMLElement) {
  let drag: { x: number; y: number; left: number; top: number; moved: boolean } | null = null;
  let suppressClick = false;

  frame.addEventListener('scroll', () => {
    mapCenter = readMapCenter(frame);
  });
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
    if (drag?.moved) suppressClick = true;
    drag = null;
    frame.classList.remove('is-dragging');
  };
  frame.addEventListener('pointerup', end);
  frame.addEventListener('pointercancel', end);
  // 拖拽松手时落在地点上不应触发打开详情。
  frame.addEventListener(
    'click',
    event => {
      if (!suppressClick) return;
      suppressClick = false;
      event.stopPropagation();
      event.preventDefault();
    },
    true,
  );
}

function renderNodeDetail(data: HudData | null, node: MapNode, canTravel: boolean, isNew: boolean) {
  const detail = createElement('div', `node-detail${isNew ? ' is-new' : ''}`);
  detail.appendChild(createElement('span', 'section-kicker', node.region));
  detail.appendChild(createElement('h4', '', node.label));
  detail.appendChild(createElement('p', '', node.description));

  const state = (_.get(data, ['地图', '地点状态', node.label]) ?? {}) as { 状态?: string; 备注?: string };
  const note = [state.状态, state.备注].filter(Boolean).join(' · ');
  if (note) detail.appendChild(createElement('small', '', note));

  CHARACTERS.forEach(char => {
    if (heroineNode(data, char)?.id !== node.id) return;
    const action = readPath(data, `${char.varRoot}.当前行动`);
    detail.appendChild(
      createElement('p', 'node-heroine', isUnset(action) ? `${char.name}在这里。` : `${char.name}在这里 · ${action}`),
    );
  });

  const sprig = createElement('span', 'node-detail-sprig');
  sprig.innerHTML = lilySprigSvg();
  detail.appendChild(sprig);

  if (canTravel) {
    const button = createElement('button', 'travel-button', '选择前往');
    button.type = 'button';
    button.addEventListener('click', () => {
      void fillTravelIntent(node);
    });
    detail.appendChild(button);
  }

  const close = createElement('button', 'node-close', '×');
  close.type = 'button';
  close.setAttribute('aria-label', '收起地点详情');
  close.addEventListener('click', () => {
    selectedNodeId = null;
    renderPanel(data, data ? resolveTheme(data) : { daypart: 'day', weather: '待设定', override: '自动' });
  });
  detail.appendChild(close);
  return detail;
}

async function fillTravelIntent(node: MapNode) {
  const input = hostDocument().querySelector<HTMLTextAreaElement>(
    '#send_textarea, textarea[data-testid="send-textarea"]',
  );
  if (input?.value.trim()) {
    setStatus('输入框已有内容，请先处理当前消息。');
    return;
  }
  const message = `我决定前往「${node.label}」。`;
  try {
    await triggerSlash(`/setinput ${JSON.stringify(message)}`);
  } catch {
    if (!input) {
      setStatus('暂时找不到酒馆输入框，请手动输入前往意图。');
      return;
    }
    input.value = message;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }
  setStatus('前往意图已填入输入框，发送由你决定。');
}

function renderSettings(data: HudData | null, theme: ThemeState) {
  const section = createElement('section', 'status-section settings-section');
  section.appendChild(sectionHeading('状态栏设置', '让界面顺着你的习惯'));
  const options: Array<[keyof HudSettings, string, string]> = [
    ['animate', '动态效果', '天气签、花枝、页签与地图上的河流、萤火等装饰动画'],
    ['scene', '场景主题跟随', '根据时间、天气和剧情主题改变纸面色彩'],
    ['expanded', '默认展开', '每次打开消息时展示完整面板'],
  ];
  options.forEach(([key, label, description]) => {
    const row = createElement('label', 'setting-row');
    const copy = createElement('span', 'setting-copy');
    copy.appendChild(createElement('strong', '', label));
    copy.appendChild(createElement('small', '', description));
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = settings[key];
    input.addEventListener('change', () => {
      settings[key] = input.checked;
      saveSettings();
      renderSnapshot(data, theme);
      if (panel && panelOpen) renderPanel(data, theme);
    });
    row.appendChild(copy);
    row.appendChild(input);
    section.appendChild(row);
  });
  const reset = createElement('button', 'reset-button', '恢复默认设置');
  reset.type = 'button';
  reset.addEventListener('click', () => {
    settings = { ...DEFAULT_SETTINGS };
    saveSettings();
    renderSnapshot(data, theme);
    renderPanel(data, theme);
  });
  section.appendChild(reset);
  return section;
}

function setStatus(message: string) {
  if (statusText) statusText.textContent = message;
}

function buildShell() {
  root = document.querySelector<HTMLElement>('#statusbar-root');
  if (!root) return false;
  while (root.firstChild) root.removeChild(root.firstChild);

  shell = createElement('section', 'hud-shell');
  shell.setAttribute('aria-label', '故事状态栏');

  const snapshot = createElement('button', 'snapshot-bar');
  snapshot.type = 'button';
  panelOpen = settings.expanded;
  snapshot.setAttribute('aria-expanded', String(panelOpen));

  const stamp = createElement('span', 'weather-stamp');
  stamp.innerHTML = stampFrameSvg();
  const mark = createElement('span', 'weather-mark');
  mark.dataset.role = 'weather-mark';
  const postmark = createElement('span', 'weather-postmark');
  postmark.innerHTML = postmarkSvg();
  stamp.append(mark, postmark);

  const weatherWords = createElement('span', 'weather-words');
  const weatherStrong = createElement('strong', '', '');
  weatherStrong.dataset.role = 'weather-label';
  weatherWords.appendChild(weatherStrong);
  const weatherSmall = createElement('small', '', '');
  weatherSmall.dataset.role = 'date';
  weatherWords.appendChild(weatherSmall);

  const placeWords = createElement('span', 'place-words');
  const placeStrong = createElement('strong', '', '');
  placeStrong.dataset.role = 'time';
  placeWords.appendChild(placeStrong);
  const placeLine = createElement('small', 'place-line');
  const pin = createElement('span', 'place-pin');
  pin.innerHTML = placePinSvg();
  const placeText = createElement('span', '', '');
  placeText.dataset.role = 'place';
  placeLine.append(pin, placeText);
  placeWords.appendChild(placeLine);

  const note = createElement('span', 'weather-note', '');
  note.dataset.role = 'weather-note';

  const arrow = createElement('span', 'snapshot-arrow');
  arrow.innerHTML = chevronSvg();

  const sheen = createElement('span', 'snapshot-sheen');
  const sprig = createElement('span', 'snapshot-sprig');
  sprig.innerHTML = lilySprigSvg();

  // 快照条的天气氛围层：由 renderSnapshot 把当前天气写到 data-weather，
  // 具体雨丝/雪花纹理交给 CSS，避免在细长的快照条里排粒子。
  const weatherLayer = createElement('span', 'snapshot-weather');
  weatherLayer.dataset.role = 'snapshot-weather';

  snapshot.append(sheen, sprig, weatherLayer, stamp, weatherWords, placeWords, note, arrow);

  panel = createElement('section', 'hud-drawer');
  panel.hidden = !panelOpen;
  panel.appendChild(buildGarland());
  panelBody = createElement('div', 'hud-drawer-body');
  panel.appendChild(panelBody);

  statusText = createElement('p', 'hud-status');
  shell.append(snapshot, panel, statusText);
  root.appendChild(shell);
  snapshot.addEventListener('click', () => {
    panelOpen = !panelOpen;
    if (!panelOpen) lastRenderedTab = null;
    snapshot.setAttribute('aria-expanded', String(panelOpen));
    if (panel) panel.hidden = !panelOpen;
    const data = readData();
    renderSnapshot(data, data ? resolveTheme(data) : { daypart: 'day', weather: '待设定', override: '自动' });
  });
  return true;
}

// 灯泡位置取自 garlandSvg 那条挂线的曲线采样（x 为百分比，y 为像素），改挂线路径时要一起改。
const GARLAND_BULBS: Array<[number, number]> = [
  [7, 5],
  [19, 8.5],
  [31, 9.5],
  [43, 8.1],
  [56, 4.1],
  [68, 1.6],
  [80, 0.9],
  [92, 1.9],
];

function buildGarland() {
  const garland = createElement('div', 'hud-garland');
  garland.setAttribute('aria-hidden', 'true');
  garland.innerHTML = garlandSvg();
  GARLAND_BULBS.forEach(([x, y], index) => {
    const bulb = createElement('span', 'garland-bulb');
    bulb.style.left = `${x}%`;
    bulb.style.top = `${y + 1}px`;
    bulb.style.animationDelay = `${-index * 0.45}s`;
    garland.appendChild(bulb);
  });
  return garland;
}

function addDisposer(value: unknown) {
  if (typeof value === 'function') disposers.push(value as () => void);
  else if (value && typeof (value as { stop?: unknown }).stop === 'function') {
    disposers.push(() => (value as { stop: () => void }).stop());
  }
}

function destroy() {
  active = false;
  while (disposers.length) disposers.pop()?.();
  root?.replaceChildren();
  root = null;
  shell = null;
  panel = null;
  panelBody = null;
  statusText = null;
}

async function init() {
  await waitGlobalInitialized('Mvu');
  if (!active || !buildShell()) return;
  const update = () => {
    if (!active) return;
    const data = readData();
    if (!data) return;
    const theme = resolveTheme(data);
    renderSnapshot(data, theme);
    if (panelOpen) renderPanel(data, theme);
  };
  update();
  addDisposer(eventOn(Mvu.events.VARIABLE_INITIALIZED, update));
  addDisposer(eventOn(Mvu.events.VARIABLE_UPDATE_ENDED, update));
  $(window).one('pagehide', destroy);
}

$(() => {
  errorCatched(init)();
});
