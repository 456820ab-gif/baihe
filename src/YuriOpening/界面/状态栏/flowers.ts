/**
 * flowers.ts — 花朵美术与花期文案（一名角色一种花）
 *
 * 花期系统是「植株 4 档 × 开花 4 档」双轴：
 * - 植株档（亲近）：花茎 / 藤蔓的长成程度
 * - 开花档（心动）：花苞到盛放的程度
 * 每朵花的档位名、16 组花期名、画布 SVG 与徽记路径都在这里定义；
 * 角色面板（index.ts）只认 FlowerId，不关心具体画的是哪种花。
 *
 * 画布统一 100×120、地面基线 y=112.5，动画沿用 bloom-stem（生长）/
 * bloom-leaf-wrap（舒展）/ bloom-open（绽开）/ bloom-head（摆动）这些
 * 样式类，不必为新花种改 CSS。
 */
import type { FlowerId } from '../../characters';
import { weatherOverlaySvg } from './icons';

function f(value: number) {
  return String(Math.round(value * 10) / 10);
}

type Point = { x: number; y: number };

function cubicAt(p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point {
  const u = 1 - t;
  return {
    x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
    y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y,
  };
}

// 叶片与花瓣共用的柳叶形：从基点沿 angle 方向伸出，两侧各一段三次曲线收成尖
function bladePath(x: number, y: number, length: number, angle: number, width: number) {
  const rad = (angle * Math.PI) / 180;
  const dx = Math.cos(rad);
  const dy = Math.sin(rad);
  const px = -dy;
  const py = dx;
  const tipX = x + dx * length;
  const tipY = y + dy * length;
  const nearX = x + dx * length * 0.25;
  const nearY = y + dy * length * 0.25;
  const farX = x + dx * length * 0.72;
  const farY = y + dy * length * 0.72;
  return (
    `M${f(x)},${f(y)} ` +
    `C${f(nearX + px * width)},${f(nearY + py * width)} ${f(farX + px * width * 0.85)},${f(farY + py * width * 0.85)} ${f(tipX)},${f(tipY)} ` +
    `C${f(farX - px * width * 0.85)},${f(farY - py * width * 0.85)} ${f(nearX - px * width)},${f(nearY - py * width)} ${f(x)},${f(y)} Z`
  );
}

const GROUND_SVG =
  '<path class="bloom-ground" d="M6,112.5 L94,112.5" />' +
  '<path class="bloom-soil" d="M18,112.5 C30,105.5 70,105.5 82,112.5 Z" />' +
  '<path class="bloom-tuft" d="M14,112 L12.5,108 M15.5,112 L16,107.5 M86,112 L84.5,108.2 M87.5,112 L88.5,108" />';

function seedSvg(): string {
  return (
    '<svg class="bloom-svg" viewBox="0 0 100 120" aria-hidden="true">' +
    GROUND_SVG +
    '<ellipse class="bloom-seed" cx="50" cy="107.5" rx="4" ry="2.6" transform="rotate(-14 50 107.5)" />' +
    '</svg>'
  );
}

export type FlowerSvgOptions = {
  leaf: number;
  bloom: number;
  heartDown: boolean;
  closeDown: boolean;
  /** 当前天气：下雨时画面里落雨、下雪时飘雪，其余天气不额外绘制 */
  weather?: string;
  /** 画布自带的 defs（雾絮渐变），SVG 的 url() 不能跨元素引用 */
  defs?: string;
};

/* ── 百合 ─────────────────────────────────────────────── */

const LILY_BASE_X = 50;
const LILY_BASE_Y = 112;
const LILY_STEM_TOP = [94, 72, 54, 40];
const LILY_BLOOM_SCALE = [0.72, 0.84, 0.94, 1];

// [沿茎位置 t, 朝向（-1 左 / 1 右）, 叶长, 叶宽]
const LILY_LEAF_LAYOUT: Array<Array<[number, -1 | 1, number, number]>> = [
  [],
  [
    [0.4, -1, 15, 5],
    [0.62, 1, 13, 4.5],
  ],
  [
    [0.22, -1, 20, 6.5],
    [0.4, 1, 19, 6],
    [0.58, -1, 16, 5.2],
    [0.74, 1, 13, 4.4],
  ],
  [
    [0.15, -1, 23, 7],
    [0.3, 1, 22, 6.8],
    [0.45, -1, 20, 6.2],
    [0.6, 1, 17, 5.5],
    [0.74, -1, 14, 4.6],
    [0.86, 1, 11, 3.8],
  ],
];

function lilyBudSvg() {
  return (
    '<g transform="rotate(8)">' +
    '<path class="bloom-bud" d="M0,0 C-4.2,-3 -4.6,-10 0,-17 C4.6,-10 4.2,-3 0,0 Z" />' +
    '<path class="bloom-sepal" d="M0,0 C-3,-2 -4.5,-5 -4.4,-8 M0,0 C3,-2 4.5,-5 4.4,-8" />' +
    '</g>'
  );
}

function lilyHalfOpenSvg() {
  return (
    `<path class="bloom-petal is-back" d="${bladePath(0, 0, 15, -122, 4.6)}" />` +
    `<path class="bloom-petal is-back" d="${bladePath(0, 0, 15, -58, 4.6)}" />` +
    '<path class="bloom-stamen" d="M0,-1 L-2.2,-13 M0,-1 L2.6,-14" />' +
    '<circle class="bloom-anther" cx="-2.2" cy="-13" r="1.1" />' +
    '<circle class="bloom-anther" cx="2.6" cy="-14" r="1.1" />' +
    `<path class="bloom-petal" d="${bladePath(0, 0, 17, -90, 5)}" />`
  );
}

function lilyFullBloomSvg() {
  const inner = [-30, 90, 210].map(angle => `<path class="bloom-petal is-back" d="${bladePath(0, 0, 16, angle, 6.5)}" />`);
  const outer = [-90, 30, 150].map(angle => `<path class="bloom-petal" d="${bladePath(0, 0, 18, angle, 6)}" />`);
  const freckles = [-90, 30, 150].map(angle => {
    const rad = (angle * Math.PI) / 180;
    return `<circle class="bloom-freckle" cx="${f(Math.cos(rad) * 6.5)}" cy="${f(Math.sin(rad) * 6.5)}" r="0.8" />`;
  });
  const stamens = [-60, -120, 0, 180, 60, 120].map(angle => {
    const rad = (angle * Math.PI) / 180;
    const x = Math.cos(rad) * 10;
    const y = Math.sin(rad) * 10 - 2;
    return `<path class="bloom-stamen" d="M0,0 Q${f(x * 0.4)},${f(y * 0.7)} ${f(x)},${f(y)}" /><circle class="bloom-anther" cx="${f(x)}" cy="${f(y)}" r="1.2" />`;
  });
  return (
    '<g transform="rotate(-8)">' +
    inner.join('') +
    outer.join('') +
    freckles.join('') +
    stamens.join('') +
    '<circle class="bloom-center" r="2" />' +
    '</g>'
  );
}

function lilyBloomHead(stage: number, x: number, y: number, scale: number, delay: number) {
  if (stage === 0) return '';
  const art = stage === 1 ? lilyBudSvg() : stage === 2 ? lilyHalfOpenSvg() : lilyFullBloomSvg();
  return (
    `<g transform="translate(${f(x)}, ${f(y)}) scale(${f(scale)})">` +
    `<g class="bloom-open" style="--d:${delay}ms"><g class="bloom-head">${art}</g></g>` +
    '</g>'
  );
}

function lilySvg(options: FlowerSvgOptions | null): string {
  if (!options) return seedSvg();
  const { leaf, bloom, heartDown, closeDown, weather = '', defs = '' } = options;
  const top: Point = { x: LILY_BASE_X + 1, y: LILY_STEM_TOP[leaf] };
  const height = LILY_BASE_Y - top.y;
  const p0: Point = { x: LILY_BASE_X, y: LILY_BASE_Y };
  const p1: Point = { x: LILY_BASE_X - 1, y: LILY_BASE_Y - height * 0.35 };
  const p2: Point = { x: top.x + 2, y: top.y + height * 0.35 };
  const parts: string[] = [];

  parts.push(
    `<path class="bloom-stem" pathLength="1" d="M${f(p0.x)},${f(p0.y)} C${f(p1.x)},${f(p1.y)} ${f(p2.x)},${f(p2.y)} ${f(top.x)},${f(top.y)}" />`,
  );

  const leaves: Array<{ x: number; y: number; length: number; angle: number; width: number }> = [];
  if (leaf === 0) {
    leaves.push({ x: top.x, y: top.y + 1, length: 8, angle: -145, width: 3.4 });
    leaves.push({ x: top.x, y: top.y + 1, length: 8, angle: -35, width: 3.4 });
  } else {
    LILY_LEAF_LAYOUT[leaf].forEach(([t, side, length, width]) => {
      const at = cubicAt(p0, p1, p2, top, t);
      const angle = side < 0 ? -160 + t * 35 : -20 - t * 35;
      leaves.push({ x: at.x, y: at.y, length, angle, width });
    });
  }

  if (leaf === 3) {
    const fork = cubicAt(p0, p1, p2, top, 0.52);
    const end = { x: top.x + 24, y: top.y + 20 };
    parts.push(
      `<path class="bloom-stem is-branch" pathLength="1" d="M${f(fork.x)},${f(fork.y)} C${f(fork.x + 8)},${f(fork.y - 4)} ${f(end.x - 2)},${f(end.y + 10)} ${f(end.x)},${f(end.y)}" />`,
    );
    parts.push(lilyBloomHead(bloom, end.x, end.y, LILY_BLOOM_SCALE[leaf] * 0.7, 1100));
  }

  leaves.forEach((item, index) => {
    const leafStyle = `transform-origin:${f(item.x)}px ${f(item.y)}px;--i:${index}`;
    parts.push(`<g class="bloom-leaf-wrap" style="${leafStyle}">`);
    parts.push(`<path class="bloom-leaf" d="${bladePath(item.x, item.y, item.length, item.angle, item.width)}" />`);
    const rad = (item.angle * Math.PI) / 180;
    parts.push(
      `<path class="bloom-vein" d="M${f(item.x)},${f(item.y)} L${f(item.x + Math.cos(rad) * item.length * 0.8)},${f(item.y + Math.sin(rad) * item.length * 0.8)}" />`,
    );
    if (closeDown && index % 2 === 0) {
      const start = 0.6;
      parts.push(
        `<path class="bloom-leaf-yellow" d="${bladePath(
          item.x + Math.cos(rad) * item.length * start,
          item.y + Math.sin(rad) * item.length * start,
          item.length * (1 - start),
          item.angle,
          item.width * 0.55,
        )}" />`,
      );
    }
    parts.push('</g>');
  });

  parts.push(lilyBloomHead(bloom, top.x, top.y, LILY_BLOOM_SCALE[leaf], 800));

  const fallen = lilyFallenSvg(heartDown);
  const plant = `<g class="bloom-plant">${parts.join('')}</g>`;
  const overlay = weatherOverlaySvg(weather, 100, 120, 'bloom');
  return `<svg class="bloom-svg" viewBox="0 0 100 120" aria-hidden="true">${defs}${GROUND_SVG}${plant}${fallen}${overlay}</svg>`;
}

function lilyFallenSvg(heartDown: boolean): string {
  if (!heartDown) return '';
  const petals: Array<[number, number, number, number]> = [
    [32, 110.6, -8, -4],
    [64, 110.2, 168, 6],
    [71, 111, -14, -8],
  ];
  return petals
    .map(
      ([x, y, angle, dx], index) =>
        `<path class="bloom-fallen" style="--dx:${dx}px;--rise:${f(-(LILY_BASE_Y - LILY_STEM_TOP[0]))}px;--i:${index}" d="${bladePath(x, y, 8, angle, 2.8)}" />`,
    )
    .join('');
}

/* ── 紫藤 ─────────────────────────────────────────────── */

const WIST_BASE_Y = 112;
// 藤蔓顶端（按植株档位）
const WIST_TOP = [97, 68, 52, 38];
const WIST_BLOOM_SCALE = [0.8, 0.88, 0.96, 1.04];
// 竹架：一根略微倾斜的细竹竿（另一串小短线是竹节），藤蔓盘着它向上
const WIST_TRELLIS = 'M59,110.5 C57.5,78 58,50 56.4,28';
const WIST_TRELLIS_NODES = 'M57.3,88 L59.3,88.6 M58,64 L60,64.6 M58.7,42 L60.7,42.6';

// 藤蔓走势：每档由若干三次曲线段首尾相接，左右摆动着盘上竹架（竹架在 x≈57）
const WIST_VINE_SEGMENTS: Array<Array<[Point, Point, Point, Point]>> = [
  [[{ x: 50, y: 112 }, { x: 46, y: 108 }, { x: 54, y: 103 }, { x: 51.5, y: 97 }]],
  [
    [{ x: 50, y: 112 }, { x: 44, y: 104 }, { x: 60, y: 96 }, { x: 54, y: 88 }],
    [{ x: 54, y: 88 }, { x: 49, y: 82 }, { x: 61, y: 76 }, { x: 56.5, y: 68 }],
  ],
  [
    [{ x: 50, y: 112 }, { x: 43, y: 102 }, { x: 60, y: 94 }, { x: 52, y: 84 }],
    [{ x: 52, y: 84 }, { x: 46, y: 75 }, { x: 62, y: 66 }, { x: 55, y: 52 }],
  ],
  [
    [{ x: 50, y: 112 }, { x: 43, y: 101 }, { x: 61, y: 92 }, { x: 51, y: 82 }],
    [{ x: 51, y: 82 }, { x: 44, y: 72 }, { x: 62, y: 63 }, { x: 53, y: 52 }],
    [{ x: 53, y: 52 }, { x: 48, y: 47 }, { x: 60, y: 42 }, { x: 58, y: 38 }],
  ],
];

// 侧藤（植株 ≥ 3 档时补一条，让"满架"名副其实）
const WIST_SIDE_VINE = 'M50,82 C58,78 60,70 57,62';

// 复叶：[所在藤段索引, 段内位置 t, 伸展方向角, 叶长]
const WIST_LEAVES: Array<Array<[number, number, number, number]>> = [
  [],
  [
    [1, 0.35, -150, 16],
    [1, 0.8, 158, 13],
  ],
  [
    [0, 0.55, -152, 16],
    [1, 0.4, 160, 15],
    [1, 0.85, -18, 14],
    [0, 0.95, 168, 11],
  ],
  [
    [0, 0.5, -150, 17],
    [1, 0.3, 162, 16],
    [1, 0.75, -16, 15],
    [2, 0.35, 150, 14],
    [2, 0.75, -28, 12],
    [0, 0.95, 170, 12],
  ],
];

/** 卷须：从 (x,y) 往 dir 方向探出并卷成一个小圈 */
function tendrilPath(x: number, y: number, r: number, dir: number): string {
  const d = dir;
  return (
    `M${f(x)},${f(y)} ` +
    `C${f(x + d * r * 2.4)},${f(y - r * 0.4)} ${f(x + d * r * 3.2)},${f(y + r * 1.2)} ${f(x + d * r * 1.7)},${f(y + r * 1.8)} ` +
    `C${f(x + d * r * 0.6)},${f(y + r * 2.3)} ${f(x - d * r * 0.4)},${f(y + r * 1.2)} ${f(x + d * r * 0.7)},${f(y + r * 0.8)}`
  );
}

// 卷须位置：[藤段索引, 段内位置 t, 半径, 方向]
const WIST_TENDRILS: Array<Array<[number, number, number, number]>> = [
  [[0, 1, 2.4, 1]],
  [[1, 1, 2.6, -1]],
  [
    [1, 1, 2.7, 1],
    [0, 0.4, 2.2, -1],
  ],
  [
    [2, 1, 2.8, -1],
    [1, 0.5, 2.4, 1],
    [0, 1, 2.2, -1],
  ],
];

/** 复叶：一根叶轴 + 三对侧生小叶 + 一枚顶生小叶（柳叶形复用百合的 bladePath） */
function compoundLeaf(x: number, y: number, angle: number, length: number): string {
  const rad = (angle * Math.PI) / 180;
  const tipX = x + Math.cos(rad) * length;
  const tipY = y + Math.sin(rad) * length;
  const parts: string[] = [`<path class="bloom-vein" d="M${f(x)},${f(y)} L${f(tipX)},${f(tipY)}" />`];
  const spots: Array<[number, number, number]> = [
    [0.42, -1, 0.36],
    [0.62, 1, 0.32],
    [0.82, -1, 0.28],
  ];
  spots.forEach(([t, side, size]) => {
    const bx = x + Math.cos(rad) * length * t;
    const by = y + Math.sin(rad) * length * t;
    const leafletAngle = angle + side * 52;
    parts.push(`<path class="bloom-leaf" d="${bladePath(bx, by, length * size, leafletAngle, length * size * 0.55)}" />`);
  });
  parts.push(`<path class="bloom-leaf" d="${bladePath(tipX, tipY, length * 0.34, angle, length * 0.18)}" />`);
  return parts.join('');
}

/** 顶生小叶的位置（给黄叶覆盖用） */
function compoundLeafTip(x: number, y: number, angle: number, length: number): { x: number; y: number } {
  const rad = (angle * Math.PI) / 180;
  return { x: x + Math.cos(rad) * length, y: y + Math.sin(rad) * length };
}

/**
 * 花穗：一条垂落的穗轴 + 沿轴排列的小花。
 * openRatio 从穗顶往下计算——紫藤顶部的花先开；
 * 小花是缩小的柳叶形，未开用花苞色、开了用花瓣色，沿用百合的样式类。
 */
function racemeSvg(length: number, openRatio: number, sway: number): string {
  // 花穗要密——小花沿轴交叠才像一串悬垂的花瀑
  const count = Math.max(3, Math.round(length / 2.9));
  const parts: string[] = [
    `<path class="bloom-axis" d="M0,0 C${f(sway)},${f(length * 0.4)} ${f(-sway)},${f(length * 0.75)} 0,${f(length)}" />`,
  ];
  for (let i = 0; i < count; i += 1) {
    const t = (i + 0.5) / count;
    const fx = Math.sin(t * 2.6 + sway) * 2.4;
    const fy = t * length;
    const size = 3.7 * (1 - t * 0.32);
    const tilt = (i % 2 === 0 ? -18 : 16) + Math.sin(t * 5 + sway) * 6;
    const open = t < openRatio;
    // 开了的花隔一朵用深一档的底色，垂穗才有层次不至于一片平
    const cls = open ? (i % 2 === 0 ? 'bloom-petal is-back' : 'bloom-petal') : 'bloom-bud';
    parts.push(`<path class="${cls}" d="${bladePath(fx, fy, size, 74 + tilt, size * 0.52)}" />`);
  }
  return parts.join('');
}

function wisteriaFallenSvg(heartDown: boolean): string {
  if (!heartDown) return '';
  const florets: Array<[number, number, number, number]> = [
    [30, 110.8, -70, -4],
    [47, 111, -95, 2],
    [63, 110.5, -80, 6],
    [73, 111, -100, -7],
  ];
  return florets
    .map(
      ([x, y, angle, dx], index) =>
        `<path class="bloom-fallen" style="--dx:${dx}px;--rise:${f(-(WIST_BASE_Y - WIST_TOP[0]))}px;--i:${index}" d="${bladePath(x, y, 3.4, angle, 1.6)}" />`,
    )
    .join('');
}

function wisteriaSvg(options: FlowerSvgOptions | null): string {
  if (!options) return seedSvg();
  const { leaf, bloom, heartDown, closeDown, weather = '', defs = '' } = options;
  const segments = WIST_VINE_SEGMENTS[leaf];
  const top = segments[segments.length - 1][3];
  const parts: string[] = [];

  // 竹架
  parts.push(`<path class="bloom-trellis" d="${WIST_TRELLIS}" />`);
  parts.push(`<path class="bloom-trellis" d="${WIST_TRELLIS_NODES}" />`);

  // 藤蔓：主藤 + （满架档的）侧藤
  const vinePath = ['M' + f(segments[0][0].x) + ',' + f(segments[0][0].y)]
    .concat(
      segments.map(([, c1, c2, end]) => `C${f(c1.x)},${f(c1.y)} ${f(c2.x)},${f(c2.y)} ${f(end.x)},${f(end.y)}`),
    )
    .join(' ');
  parts.push(`<path class="bloom-stem" pathLength="1" d="${vinePath}" />`);
  if (leaf >= 3) {
    parts.push(`<path class="bloom-stem is-branch" pathLength="1" d="${WIST_SIDE_VINE}" />`);
  }

  // 复叶
  WIST_LEAVES[leaf].forEach(([segIndex, t, angle, length], index) => {
    const at = cubicAt(...segments[segIndex], t);
    parts.push(`<g class="bloom-leaf-wrap" style="transform-origin:${f(at.x)}px ${f(at.y)}px;--i:${index}">`);
    parts.push(compoundLeaf(at.x, at.y, angle, length));
    if (closeDown && index % 2 === 0) {
      const tip = compoundLeafTip(at.x, at.y, angle, length);
      parts.push(`<path class="bloom-leaf-yellow" d="${bladePath(tip.x, tip.y, length * 0.22, angle, length * 0.12)}" />`);
    }
    parts.push('</g>');
  });

  // 卷须
  WIST_TENDRILS[leaf].forEach(([segIndex, t, r, dir]) => {
    const at = cubicAt(...segments[segIndex], t);
    parts.push(`<path class="bloom-tendril" d="${tendrilPath(at.x, at.y, r, dir)}" />`);
  });

  // 花穗：结穗 → 初绽 → 垂瀑，随心动档位变长、变密
  const scale = WIST_BLOOM_SCALE[leaf];
  const racemes: Array<{ x: number; y: number; length: number; openRatio: number; sway: number; delay: number }> = [];
  if (bloom === 1) {
    racemes.push({ x: top.x - 1, y: top.y + 3, length: 12, openRatio: 0, sway: 1.6, delay: 700 });
  } else if (bloom === 2) {
    racemes.push({ x: top.x - 1, y: top.y + 3, length: 21, openRatio: 0.45, sway: 1.8, delay: 700 });
    if (leaf >= 2) racemes.push({ x: top.x + 8, y: top.y + 5, length: 11, openRatio: 0.3, sway: 1.2, delay: 950 });
  } else if (bloom === 3) {
    racemes.push({ x: top.x - 1, y: top.y + 3, length: 30, openRatio: 0.85, sway: 2, delay: 700 });
    racemes.push({ x: top.x + 8, y: top.y + 5, length: 23, openRatio: 0.8, sway: 1.8, delay: 900 });
    if (leaf >= 3) racemes.push({ x: top.x - 9, y: top.y + 6, length: 16, openRatio: 0.7, sway: 1.6, delay: 1080 });
  }
  racemes.forEach(({ x, y, length, openRatio, sway, delay }) => {
    parts.push(
      `<g transform="translate(${f(x)}, ${f(y)}) scale(${f(scale)})">` +
        `<g class="bloom-open" style="--d:${delay}ms"><g class="bloom-head">${racemeSvg(length, openRatio, sway)}</g></g>` +
        '</g>',
    );
  });

  const fallen = wisteriaFallenSvg(heartDown);
  const plant = `<g class="bloom-plant">${parts.join('')}</g>`;
  const overlay = weatherOverlaySvg(weather, 100, 120, 'bloom');
  return `<svg class="bloom-svg" viewBox="0 0 100 120" aria-hidden="true">${defs}${GROUND_SVG}${plant}${fallen}${overlay}</svg>`;
}

/* ── 花期元数据与统一出口 ─────────────────────────────── */

export type FlowerMeta = {
  leafStages: readonly string[];
  bloomStages: readonly string[];
  /** 空态图注（尚未播种时显示的「XX花期」） */
  period: string;
  /** [植株档][开花档] 的 16 个花期名 */
  names: ReadonlyArray<readonly string[]>;
};

const LILY_META: FlowerMeta = {
  leafStages: ['嫩芽', '抽茎', '展叶', '繁茂'],
  bloomStages: ['无苞', '青苞', '半开', '盛放'],
  period: '百合花期',
  names: [
    ['一粒种子', '芽尖藏苞', '细茎微绽', '早开的花'],
    ['新茎初长', '含苞', '半掩花颜', '单枝独放'],
    ['叶影婆娑', '绿里含羞', '花叶相映', '倚叶盛开'],
    ['青叶满枝', '满枝待放', '枝头半开', '并蒂百合'],
  ],
};

const WISTERIA_META: FlowerMeta = {
  leafStages: ['嫩藤', '初攀', '展叶', '满架'],
  bloomStages: ['无苞', '结穗', '初绽', '垂瀑'],
  period: '紫藤花期',
  names: [
    ['一粒种子', '藤芽藏梦', '细藤初探', '早开一簇'],
    ['新藤初引', '垂穗初结', '半帘紫雾', '单穗垂紫'],
    ['青叶绕架', '穗影含羞', '藤花相映', '倚架垂花'],
    ['满架青藤', '满架垂穗', '紫瀑初成', '紫藤垂瀑'],
  ],
};

const FLOWER_META: Record<FlowerId, FlowerMeta> = {
  lily: LILY_META,
  wisteria: WISTERIA_META,
};

export function flowerMeta(flower: FlowerId): FlowerMeta {
  return FLOWER_META[flower];
}

export function flowerName(flower: FlowerId, leaf: number, bloom: number): string {
  return FLOWER_META[flower].names[leaf][bloom];
}

/** 星图标记 / 地图图钉上的花徽：百合是六瓣花，紫藤是三粒垂坠的小花穗 */
export function flowerMarkPath(flower: FlowerId, radius: number): string {
  if (flower === 'wisteria') {
    return [
      bladePath(radius * 0.06, -radius * 0.82, radius * 0.6, 86, radius * 0.3),
      bladePath(-radius * 0.4, -radius * 0.08, radius * 0.56, 100, radius * 0.28),
      bladePath(radius * 0.3, radius * 0.42, radius * 0.5, 78, radius * 0.25),
    ].join(' ');
  }
  return [0, 1, 2, 3, 4, 5].map(index => bladePath(0, 0, radius, index * 60 - 90, radius * 0.34)).join(' ');
}

export function flowerSvg(flower: FlowerId, options: FlowerSvgOptions | null): string {
  return flower === 'wisteria' ? wisteriaSvg(options) : lilySvg(options);
}
