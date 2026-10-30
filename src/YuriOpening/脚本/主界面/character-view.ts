import { CHARACTERS, characterById, type CharacterDef, type FlowerId } from '../../characters';
import { flowerMarkPath, flowerMeta, flowerName, flowerSvg } from '../../界面/状态栏/flowers';
import { ZONES, heartbeatBpm, heartbeatSvg, stageOf, starChartSvg } from '../../界面/状态栏/heroine';
import { mistDefsSvg } from '../../界面/状态栏/mist-defs';
import { hostDocument } from './host';
import {
  arenaLabel, arenaLevel, relationAxisTone, relationEnabled, relationRecentTrace, relationWoman,
  type RelationAxis, type RelationWoman,
} from './relation';
import { paintFill, relationActionBar } from './relation-view';
import {
  characterNode, characterPoint, characterTrail, characterValue,
  isUnset, relationZone, type HudData, type ThemeState,
} from './state';

interface CharacterViewOptions {
  rerender: () => void;
  onLocate: (label: string) => void;
  onAction: (line: string) => void;
}

function make<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string) {
  const el = hostDocument().createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

function chip(text: string, tone = '') {
  return make('span', `obs-chip${tone ? ` ${tone}` : ''}`, text);
}

function meter(label: string, value: number | null, tone = '', owner = '') {
  const row = make('div', `obs-meter${tone ? ` ${tone}` : ''}`);
  row.append(make('span', 'obs-meter-label', label));
  const track = make('span', 'obs-meter-track');
  const fill = make('span', 'obs-meter-fill');
  paintFill(fill, `${owner}:${label}`, value);
  track.append(fill);
  row.append(track, make('strong', 'obs-meter-value', value === null ? '—' : String(value)));
  return row;
}

function row(label: string, value: string) {
  const el = make('div', 'obs-row');
  el.append(make('span', 'obs-row-label', label), make('strong', 'obs-row-value', value));
  return el;
}

function bloomArtSource(flower: FlowerId, leaf: number, bloom: number) {
  const key = `${flower}-${leaf}${bloom}`;
  const candidates = [
    (window as Window & { __flowerArt?: Record<string, string> }).__flowerArt,
    (window.parent as Window & { __flowerArt?: Record<string, string> }).__flowerArt,
    (window.top as Window & { __flowerArt?: Record<string, string> }).__flowerArt,
  ];
  for (const map of candidates) {
    const src = map?.[key];
    if (src) return src;
  }
  return null;
}

function applyBloomArt(box: HTMLElement, flower: FlowerId, leaf: number, bloom: number, closeDown: boolean) {
  const src = bloomArtSource(flower, leaf, bloom);
  if (!src) return;
  const svg = box.querySelector('.bloom-svg');
  if (!svg) return;
  const stage = make('div', 'bloom-stage');
  svg.replaceWith(stage);
  const art = make('img', 'bloom-art');
  art.alt = '';
  art.src = src;
  stage.append(art, svg);
  box.classList.add('has-art');
  if (closeDown) box.classList.add('is-closing');
}

function flowerMark(char: CharacterDef) {
  const svg = hostDocument().createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '-16 -16 32 32');
  svg.setAttribute('aria-hidden', 'true');
  const path = hostDocument().createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', flowerMarkPath(char.flower, 13));
  path.setAttribute('fill', 'currentColor');
  svg.append(path);
  return svg;
}

function pulseNote(heart: number) {
  if (heart >= 86) return '几乎藏不住';
  if (heart >= 65) return '明显快了半拍';
  if (heart >= 46) return '比平常轻快';
  if (heart >= 21) return '有一点起伏';
  return '安静平稳';
}

function pulseRing(heart: number) {
  const box = make('div', 'obs-pulse-ring');
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  const ticks = Array.from({ length: 12 }, (_, index) => {
    const angle = (index / 12) * Math.PI * 2;
    const inner = 30.4;
    const outer = 32.4;
    return `<line class="ring-tick" x1="${(33 + Math.cos(angle) * inner).toFixed(1)}" y1="${(33 + Math.sin(angle) * inner).toFixed(1)}" x2="${(33 + Math.cos(angle) * outer).toFixed(1)}" y2="${(33 + Math.sin(angle) * outer).toFixed(1)}"></line>`;
  }).join('');
  box.innerHTML = `<svg viewBox="0 0 66 66" aria-hidden="true">
    <defs>
      <linearGradient id="pulse-ring-grad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="var(--accent)"></stop>
        <stop offset="100%" stop-color="var(--accent-2, var(--accent))"></stop>
      </linearGradient>
    </defs>
    <circle class="ring-track" cx="33" cy="33" r="${radius}"></circle>
    <circle class="ring-fill" cx="33" cy="33" r="${radius}" stroke-dasharray="${circumference.toFixed(1)}" stroke-dashoffset="${(circumference * (1 - heart / 100)).toFixed(1)}"></circle>
    ${ticks}
  </svg>`;
  return box;
}

/* 读数在盘外：数字大而克制，单位只做注解 */
function pulseReadout(heart: number) {
  const readout = make('div', 'obs-pulse-readout');
  readout.append(make('strong', '', String(heartbeatBpm(heart))), make('small', '', '次 / 分'));
  return readout;
}

export class CharacterView {
  private selected: string | null = null;

  constructor(private readonly options: CharacterViewOptions) {}

  render(data: HudData | null, theme: ThemeState): HTMLElement {
    const char = this.selected ? characterById(this.selected) : null;
    return char ? this.detail(data, theme, char) : this.list(data);
  }

  private list(data: HudData | null) {
    const wrap = make('div', 'obs-character');
    wrap.append(
      make('p', 'obs-kicker', '她们的故事'),
      make('h2', 'obs-title', '角色'),
      make('p', 'obs-subtitle', '两个人，各自沿着自己的花期走到今天。'),
    );
    const list = make('div', 'obs-char-list');
    CHARACTERS.forEach(char => {
      const point = characterPoint(data, char);
      const relation = characterValue(data, char, '关系身份');
      const action = characterValue(data, char, '当前行动');
      const item = make('button', 'obs-char-item');
      item.type = 'button';
      item.dataset.character = char.id;
      item.style.setProperty('--char-accent', char.accent);
      item.style.setProperty('--char-accent-soft', char.accentSoft);
      const mark = make('span', 'obs-char-mark');
      mark.append(flowerMark(char));
      const id = make('div', 'obs-char-id');
      const nameLine = make('div', 'obs-char-name-line');
      nameLine.append(make('strong', '', char.name));
      if (relation && !isUnset(relation)) nameLine.append(chip(relation));
      const zone = relationZone(point);
      if (zone) nameLine.append(chip(ZONES[zone].label, 'obs-chip-soft'));
      id.append(nameLine, make('small', '', isUnset(action) ? '行踪未定' : action));
      item.append(mark, id);
      const stats = make('div', 'obs-char-compact');
      stats.append(
        meter('亲近', point?.close ?? null, '', char.id),
        meter('心动', point?.heart ?? null, '', char.id),
      );
      item.append(stats, make('span', 'obs-char-chevron', '›'));
      item.addEventListener('click', () => {
        this.selected = char.id;
        this.options.rerender();
      });
      list.append(item);
    });
    wrap.append(list);
    return wrap;
  }

  private detail(data: HudData | null, theme: ThemeState, char: CharacterDef) {
    const point = characterPoint(data, char);
    const { previous, trail } = characterTrail(data, char, point);
    const zone = relationZone(point);
    const relation = characterValue(data, char, '关系身份');
    const mood = characterValue(data, char, '心情');
    const action = characterValue(data, char, '当前行动');
    const location = characterValue(data, char, '所在地点');
    const clothing = characterValue(data, char, '当前穿着');
    const voice = characterValue(data, char, '心声');
    const stage = point ? { leaf: stageOf(point.close), bloom: stageOf(point.heart) } : { leaf: 0, bloom: 0 };
    const heartDown = Boolean(previous && point && point.heart < previous.heart);
    const closeDown = Boolean(previous && point && point.close < previous.close);

    const wrap = make('div', 'obs-character obs-character-detail');
    wrap.style.setProperty('--char-accent', char.accent);
    wrap.style.setProperty('--char-accent-soft', char.accentSoft);
    wrap.style.setProperty('--char-jade', char.jade);
    wrap.style.setProperty('--char-glow', char.glow);

    const rail = make('div', 'obs-char-rail');
    CHARACTERS.forEach((item, index) => {
      const railButton = make('button', `obs-rail-item${item.id === char.id ? ' is-active' : ''}`);
      railButton.type = 'button';
      railButton.dataset.character = item.id;
      railButton.style.setProperty('--char-accent', item.accent);
      railButton.setAttribute('aria-label', item.name);
      railButton.append(make('span', 'obs-rail-num', String(index + 1).padStart(2, '0')), flowerMark(item));
      railButton.addEventListener('click', () => {
        if (item.id === char.id) return;
        this.selected = item.id;
        this.options.rerender();
      });
      rail.append(railButton);
    });
    const back = make('button', 'obs-rail-back', '全部');
    back.type = 'button';
    back.addEventListener('click', () => {
      this.selected = null;
      this.options.rerender();
    });
    rail.append(back);
    wrap.append(rail);

    const head = make('header', 'obs-char-title');
    const mark = make('span', 'obs-char-mark obs-char-mark-lg');
    mark.append(flowerMark(char));
    const title = make('div', 'obs-char-title-copy');
    const nameLine = make('div', 'obs-title-line');
    nameLine.append(make('h2', '', char.name));
    if (relation && !isUnset(relation)) nameLine.append(chip(relation));
    if (zone) nameLine.append(chip(ZONES[zone].label, 'obs-chip-soft'));
    title.append(make('p', 'obs-kicker', char.subtitle), nameLine);
    title.append(make('p', 'obs-muted', [mood, action, location].filter(value => value && !isUnset(value)).join(' · ') || '尚未相遇'));
    head.append(mark, title);
    wrap.append(head);

    const art = make('div', 'obs-art-scope hud-shell');
    art.style.setProperty('--hud-accent', char.accent);
    art.style.setProperty('--hud-accent-soft', char.accentSoft);
    art.style.setProperty('--hud-jade', char.jade);
    art.style.setProperty('--hud-glow', char.glow);
    art.dataset.animate = 'true';
    art.dataset.scene = 'true';
    art.dataset.daypart = theme.daypart;
    art.dataset.weather = theme.weather === '待设定' ? 'cloudy' : theme.weather;
    art.dataset.override = theme.override;

    const bloom = make('figure', 'obs-bloom heroine-bloom-box');
    bloom.dataset.leaf = String(stage.leaf);
    bloom.dataset.bloom = String(stage.bloom);
    bloom.innerHTML = flowerSvg(char.flower, {
      leaf: stage.leaf,
      bloom: stage.bloom,
      heartDown,
      closeDown,
      weather: theme.weather,
      defs: mistDefsSvg(),
    });
    applyBloomArt(bloom, char.flower, stage.leaf, stage.bloom, closeDown);
    const bloomCaption = make('figcaption');
    const meta = flowerMeta(char.flower);
    bloomCaption.append(
      make('strong', 'obs-bloom-name', point ? flowerName(char.flower, stage.leaf, stage.bloom) : '尚未播种'),
      make('small', '', point ? `${meta.leafStages[stage.leaf]} · ${meta.bloomStages[stage.bloom]}` : meta.period),
    );
    bloom.append(bloomCaption);
    /* 标本签：右下角小字，记季节与档位 */
    bloom.append(make('span', 'obs-bloom-stamp', point
      ? `${meta.period} · 叶${stage.leaf + 1} 花${stage.bloom + 1}`
      : meta.period));

    const chart = make('figure', 'obs-chart-box');
    chart.innerHTML = starChartSvg({
      point,
      trail,
      from: previous && point && (previous.close !== point.close || previous.heart !== point.heart) ? previous : null,
      mark: flowerMarkPath(char.flower, 7.5),
    });
    chart.append(make('figcaption', '', trail.length ? `关系星图 · 近 ${trail.length} 次足迹` : '关系星图'));

    const pulse = make('div', 'obs-pulse');
    if (point) {
      const bpm = heartbeatBpm(point.heart);
      pulse.style.setProperty('--beat', `${(60 / bpm).toFixed(2)}s`);
      const copy = make('div', 'obs-pulse-copy');
      copy.append(make('span', 'obs-pulse-title', '心跳'), make('span', 'obs-pulse-note', pulseNote(point.heart)));
      const line = make('div');
      line.innerHTML = heartbeatSvg();
      copy.append(line);
      pulse.append(pulseRing(point.heart), pulseReadout(point.heart), copy);
    } else {
      pulse.append(make('span', 'obs-pulse-title', '心跳'), make('span', 'obs-pulse-note', '尚无可读的心跳'));
    }

    const visual = make('div', 'obs-visual');
    visual.append(bloom, chart, pulse);
    art.append(visual);
    wrap.append(art);

    const stats = make('div', 'obs-stat-grid');
    stats.append(
      meter('亲近', point?.close ?? null, '', char.id),
      meter('心动', point?.heart ?? null, '', char.id),
    );
    const details = make('div', 'obs-detail-rows');
    const detailRows: Array<[string, string]> = relationEnabled(data)
      ? [['关系身份', relation], ['当前行动', action]]
      : [['关系身份', relation], ['当前行动', action], ['所在地点', location], ['当前穿着', clothing]];
    detailRows.forEach(([label, value]) => details.append(row(label, value)));
    wrap.append(stats, details);

    const woman = relationWoman(data, char.varRoot);
    if (relationEnabled(data)) wrap.append(this.privateZone(data, char, woman));


    const node = characterNode(data, char);
    if (node) {
      const locate = make('button', 'obs-locate', '在地图上找她');
      locate.type = 'button';
      locate.addEventListener('click', () => this.options.onLocate(node));
      wrap.append(locate);
    }

    if (voice && !isUnset(voice)) {
      const voiceBox = make('button', 'obs-voice');
      voiceBox.type = 'button';
      voiceBox.append(make('span', 'obs-voice-label', '她没说出口的话'), make('span', 'obs-voice-text', voice));
      voiceBox.addEventListener('click', () => voiceBox.classList.toggle('is-open'));
      wrap.append(voiceBox);
    }

    return wrap;
  }

  /* 私密区：只有测试卡有「关系」时才出现，正式卡完全不渲染 */
  private privateZone(data: HudData | null, char: CharacterDef, woman: RelationWoman | null) {
    const box = make('section', 'obs-private');
    const head = make('header', 'obs-private-head');
    head.append(make('span', 'obs-private-kicker', '私下圈'));
    head.append(make('strong', 'obs-private-title', '只有你们知道的部分'));
    if (woman) head.append(make('span', `obs-rel-arena is-level-${arenaLevel(woman.修罗场)}`, arenaLabel(woman.修罗场)));

    const meters = make('div', 'obs-private-meters');
    const privateMeter = (label: RelationAxis, value: number | null) =>
      meter(label, value, `obs-private-meter ${relationAxisTone(label, value)}`, char.id);
    meters.append(privateMeter('私密', woman?.私密 ?? null), privateMeter('风险', woman?.风险 ?? null));

    const rows = make('div', 'obs-private-rows');
    rows.append(
      row('她的心情', characterValue(data, char, '心情')),
      row('穿着', characterValue(data, char, '当前穿着')),
      row('所在地', characterValue(data, char, '所在地点')),
    );

    const recent = relationRecentTrace(woman);
    const trace = make('p', 'obs-private-trace');
    trace.append(make('span', 'obs-private-trace-label', '最近痕迹'));
    trace.append(
      make('span', 'obs-private-trace-text', recent ? [recent.内容, recent.时间].filter(Boolean).join(' · ') : '还没有留下痕迹'),
    );

    box.append(head, meters, rows, trace);
    if (woman) {
      box.append(relationActionBar({
        name: char.name,
        place: characterValue(data, char, '所在地点'),
        onAction: this.options.onAction,
      }));
    }
    return box;
  }
}
