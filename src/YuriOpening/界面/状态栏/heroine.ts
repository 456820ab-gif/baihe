/**
 * heroine.ts — 角色面板的共用视觉组件：关系星图、心跳线
 *
 * 「关系值 → 画面」的映射（档位分界、星图坐标、心跳频率）与花种无关，
 * 所有角色共用；花朵画布与花期文案在 flowers.ts，按角色注册表取用。
 */
export type HeroinePoint = { close: number; heart: number };

export type ZoneId = 'mutual' | 'confidant' | 'undercurrent' | 'stranger';

export const ZONES: Record<ZoneId, { label: string; hint: string }> = {
  mutual: { label: '双向奔赴', hint: '放松，也心动——你们都在往前走。' },
  confidant: { label: '知己', hint: '她很信任你，只是心跳还没被牵动。' },
  undercurrent: { label: '暗涌', hint: '戒备还没放下，心却已经先乱了。' },
  stranger: { label: '萍水相逢', hint: '你们还只是彼此生活里的过客。' },
};

export function zoneOf(point: HeroinePoint): ZoneId {
  if (point.close >= 50) return point.heart >= 50 ? 'mutual' : 'confidant';
  return point.heart >= 50 ? 'undercurrent' : 'stranger';
}

export function stageOf(value: number) {
  if (value < 25) return 0;
  if (value < 50) return 1;
  if (value < 75) return 2;
  return 3;
}

function f(value: number) {
  return String(Math.round(value * 10) / 10);
}

/* ── 关系星图 ─────────────────────────────────────────── */

export const CHART_SIZE = 220;
const CHART_PAD = 26;
const CHART_SPAN = CHART_SIZE - CHART_PAD * 2;

export function chartXY(point: HeroinePoint) {
  return {
    x: CHART_PAD + (point.close / 100) * CHART_SPAN,
    y: CHART_SIZE - CHART_PAD - (point.heart / 100) * CHART_SPAN,
  };
}

export function chartTransform(point: HeroinePoint) {
  const { x, y } = chartXY(point);
  return `translate(${f(x)}px, ${f(y)}px)`;
}

export function starChartSvg(options: {
  point: HeroinePoint | null;
  trail: HeroinePoint[];
  from: HeroinePoint | null;
  /** 角色花徽路径（flowers.ts 的 flowerMarkPath 按她的花生成） */
  mark: string;
}) {
  const { point, trail, from, mark } = options;
  const active = point ? zoneOf(point) : null;
  const half = CHART_SPAN / 2;
  const mid = CHART_PAD + half;
  const zones: Array<[ZoneId, number, number, number, number, 'start' | 'end']> = [
    ['undercurrent', CHART_PAD, CHART_PAD, CHART_PAD + 6, CHART_PAD + 12, 'start'],
    ['mutual', mid, CHART_PAD, CHART_SIZE - CHART_PAD - 6, CHART_PAD + 12, 'end'],
    ['stranger', CHART_PAD, mid, CHART_PAD + 6, CHART_SIZE - CHART_PAD - 7, 'start'],
    ['confidant', mid, mid, CHART_SIZE - CHART_PAD - 6, CHART_SIZE - CHART_PAD - 7, 'end'],
  ];
  const parts: string[] = [];
  zones.forEach(([id, x, y]) => {
    parts.push(
      `<rect class="chart-zone is-${id}${id === active ? ' is-active' : ''}" x="${f(x)}" y="${f(y)}" width="${f(half)}" height="${f(half)}" />`,
    );
  });
  [25, 75].forEach(value => {
    const offset = CHART_PAD + (value / 100) * CHART_SPAN;
    parts.push(
      `<path class="chart-grid" d="M${f(offset)},${CHART_PAD} L${f(offset)},${CHART_SIZE - CHART_PAD} M${CHART_PAD},${f(offset)} L${CHART_SIZE - CHART_PAD},${f(offset)}" />`,
    );
  });
  parts.push(
    `<path class="chart-axis-mid" d="M${f(mid)},${CHART_PAD} L${f(mid)},${CHART_SIZE - CHART_PAD} M${CHART_PAD},${f(mid)} L${CHART_SIZE - CHART_PAD},${f(mid)}" />`,
  );
  parts.push(
    `<rect class="chart-frame" x="${CHART_PAD}" y="${CHART_PAD}" width="${CHART_SPAN}" height="${CHART_SPAN}" />`,
  );
  zones.forEach(([id, , , lx, ly, anchor]) => {
    parts.push(
      `<text class="chart-zone-label${id === active ? ' is-active' : ''}" x="${f(lx)}" y="${f(ly)}" text-anchor="${anchor}">${ZONES[id].label}</text>`,
    );
  });
  const bottom = CHART_SIZE - CHART_PAD;
  parts.push(`<text class="chart-tick" x="${CHART_PAD}" y="${bottom + 9}" text-anchor="middle">0</text>`);
  parts.push(`<text class="chart-tick" x="${f(mid)}" y="${bottom + 9}" text-anchor="middle">50</text>`);
  parts.push(`<text class="chart-tick" x="${bottom}" y="${bottom + 9}" text-anchor="middle">100</text>`);
  parts.push(`<text class="chart-tick" x="${CHART_PAD - 4}" y="${f(mid + 2)}" text-anchor="end">50</text>`);
  parts.push(`<text class="chart-tick" x="${CHART_PAD - 4}" y="${CHART_PAD + 2}" text-anchor="end">100</text>`);
  parts.push(`<text class="chart-axis-label" x="${f(mid)}" y="${CHART_SIZE - 4}" text-anchor="middle">亲近 →</text>`);
  parts.push(
    `<text class="chart-axis-label" x="9" y="${f(mid)}" text-anchor="middle" transform="rotate(-90 9 ${f(mid)})">心动 →</text>`,
  );

  if (point && trail.length) {
    const coords = [...trail, point].map(chartXY);
    parts.push(
      `<path class="chart-trail" d="${coords.map((c, index) => `${index ? 'L' : 'M'}${f(c.x)},${f(c.y)}`).join(' ')}" />`,
    );
    trail.forEach((step, index) => {
      const c = chartXY(step);
      const opacity = 0.3 + (0.55 * (index + 1)) / trail.length;
      parts.push(
        `<circle class="chart-step" cx="${f(c.x)}" cy="${f(c.y)}" r="2.3" style="opacity:${f(opacity)};--i:${index}" />`,
      );
    });
  }

  if (point) {
    const start = from ?? point;
    const slide = from !== null;
    parts.push(
      `<g class="chart-marker" style="transform:${chartTransform(start)}"${slide ? ` data-to="${chartTransform(point)}"` : ''}>` +
        '<circle class="marker-halo" r="12" />' +
        `<path class="marker-flower" d="${mark}" />` +
        '<circle class="marker-core" r="2" />' +
        '</g>',
    );
  }

  return `<svg class="star-chart" viewBox="0 0 ${CHART_SIZE} ${CHART_SIZE}" aria-hidden="true">${parts.join('')}</svg>`;
}

/* ── 心跳线 ───────────────────────────────────────────── */

export function heartbeatBpm(heart: number) {
  return Math.round(60 + heart * 0.6);
}

// 三个周期首尾相接，向左平移一个周期（60）后无缝循环
export function heartbeatSvg() {
  const beat = (offset: number) =>
    `M${offset},10 L${offset + 17},10 L${offset + 20},7.5 L${offset + 23},10 L${offset + 27},10 L${offset + 30},2 L${offset + 33},17.5 L${offset + 36},10 L${offset + 41},10 L${offset + 44},8 L${offset + 48},10 L${offset + 60},10`;
  return (
    '<svg class="heartbeat-line" viewBox="0 0 120 20" preserveAspectRatio="none" aria-hidden="true">' +
    `<g class="heartbeat-scroll"><path d="${beat(0)} ${beat(60)} ${beat(120)}" /></g>` +
    '</svg>'
  );
}

export function heartGlyphSvg() {
  return '<svg class="heartbeat-heart" viewBox="0 0 16 16" aria-hidden="true"><path d="M8,14 C4,11 1.5,8.6 1.5,5.8 C1.5,3.6 3.2,2 5.2,2 C6.4,2 7.4,2.7 8,3.6 C8.6,2.7 9.6,2 10.8,2 C12.8,2 14.5,3.6 14.5,5.8 C14.5,8.6 12,11 8,14 Z" /></svg>';
}
