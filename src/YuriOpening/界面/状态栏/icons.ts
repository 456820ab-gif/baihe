const SUN_FULL = `
  <g data-part="sun">
    <circle cx="20" cy="20" r="6.5" />
    <path d="M20,10.5 L20,6 M20,29.5 L20,34 M10.5,20 L6,20 M29.5,20 L34,20 M13.3,13.3 L10.1,10.1 M26.7,13.3 L29.9,10.1 M13.3,26.7 L10.1,29.9 M26.7,26.7 L29.9,29.9" />
  </g>`;

const SUN_SMALL = `
  <g data-part="sun">
    <circle cx="15" cy="14" r="5" />
    <path d="M15,7 L15,4 M22,14 L25,14 M10.5,7.5 L8.5,5.5 M19.5,7.5 L21.5,5.5" />
  </g>`;

const CLOUD = `
  <g data-part="cloud">
    <path d="M9.5,29 C5.5,29 3,26 3,23.3 C3,20.4 5.6,18.3 8.7,18.9 C9.8,14.3 13.8,11 18.4,11 C23.5,11 27.6,14.7 28.5,19.4 C31.6,19.6 34,22 34,24.8 C34,27.2 32,29 29.6,29 Z" />
  </g>`;

const RAIN_LIGHT = `
  <g data-part="drop">
    <path d="M14,32 L12.8,35.4 M20.5,32 L19.3,35.4" />
  </g>`;

const RAIN_HEAVY = `
  <g data-part="drop">
    <path d="M12,31.5 L10,36.5 M18.5,31.5 L16.5,36.5 M25,31.5 L23,36.5" />
  </g>`;

const BOLT = `
  <g data-part="bolt">
    <path d="M21.5,29.5 L17.5,35 L20.5,35 L18.5,38.8" />
  </g>`;

const SNOW = `
  <g data-part="flake">
    <path d="M12,31.5 L12,35.5 M10.3,32.5 L13.7,34.5 M13.7,32.5 L10.3,34.5" />
    <path d="M20,32.5 L20,36.5 M18.3,33.5 L21.7,35.5 M21.7,33.5 L18.3,35.5" />
    <path d="M28,31.5 L28,35.5 M26.3,32.5 L29.7,34.5 M29.7,32.5 L26.3,34.5" />
  </g>`;

const MIST = `
  <g data-part="mist">
    <path d="M6,15 q4,-2.6 8,0 t8,0 t8,0" />
    <path d="M6,21 q4,-2.6 8,0 t8,0 t8,0" />
    <path d="M6,27 q4,-2.6 8,0 t8,0 t8,0" />
  </g>`;

const UNKNOWN = `
  <g>
    <circle cx="20" cy="21" r="13" stroke-dasharray="2.5 3.5" />
    <path d="M13.5,26 C11,26 9.5,24.2 9.5,22.3 C9.5,20.2 11.3,18.8 13.3,19.2 C14.1,16 16.8,13.8 19.9,13.8 C23.4,13.8 26.2,16.3 26.8,19.5 C28.9,19.7 30.5,21.2 30.5,23.2 C30.5,24.9 29.1,26 27.5,26 Z" />
  </g>`;

const WEATHER_MARKS: Record<string, string> = {
  晴: SUN_FULL,
  多云: SUN_SMALL + CLOUD,
  阴: CLOUD,
  小雨: CLOUD + RAIN_LIGHT,
  大雨: CLOUD + RAIN_HEAVY,
  雷雨: CLOUD + BOLT,
  雾: MIST,
  雪: CLOUD + SNOW,
};

const WEATHER_TONES: Record<string, string> = {
  待设定: 'unknown',
  晴: 'clear',
  多云: 'cloudy',
  阴: 'overcast',
  小雨: 'rain',
  大雨: 'storm',
  雷雨: 'storm',
  雾: 'mist',
  雪: 'snow',
};

export function weatherLabel(weather: string): string {
  return weather === '待设定' ? '天气待设定' : weather;
}

export function weatherTone(weather: string): string {
  return WEATHER_TONES[weather] ?? 'cloudy';
}

export function weatherMarkSvg(weather: string): string {
  return `<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${
    WEATHER_MARKS[weather] ?? UNKNOWN
  }</svg>`;
}

export function chevronSvg(): string {
  return `<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M2,4.2 L6,8.4 L10,4.2" /></svg>`;
}

export function stampFrameSvg(): string {
  return `<svg class="stamp-frame" viewBox="0 0 48 48" aria-hidden="true"><rect class="stamp-paper" x="3" y="3" width="42" height="42" /><rect class="stamp-perf" x="3" y="3" width="42" height="42" /><rect class="stamp-inner" x="7.5" y="7.5" width="33" height="33" /></svg>`;
}

export function postmarkSvg(): string {
  return `<svg viewBox="0 0 44 22" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" aria-hidden="true"><path d="M1,5 q5.5,-3.5 11,0 t11,0 t11,0 t10,0" /><path d="M1,11 q5.5,-3.5 11,0 t11,0 t11,0 t10,0" /><path d="M1,17 q5.5,-3.5 11,0 t11,0 t11,0 t10,0" /></svg>`;
}

export function lilySprigSvg(): string {
  return `<svg viewBox="0 0 48 64" aria-hidden="true">
  <g class="sprig-sway">
    <path class="sprig-stem" d="M24,63 C25.5,50 21,38 23,23 M23.4,33 C27,29 30.5,24 31,18" />
    <path class="sprig-leaf" d="M23.6,47 C16,45 11,39 10,31 C17,33 22,38 23.6,47 Z" />
    <path class="sprig-leaf" d="M23.2,39 C29,36.5 34,31 35,24.5 C29,26.5 24.5,31 23.2,39 Z" />
    <path class="sprig-bud" d="M31,18 C28.5,14 29.5,9 31.5,6.5 C33.5,9 34,14 31,18 Z" />
    <g class="sprig-bloom">
      <path class="sprig-petal" d="M23,24 C17,20.5 12,13.5 12.5,5 C17,10 21,15 23,24 Z" />
      <path class="sprig-petal" d="M23,24 C22.5,16 24.5,8 29.5,1.5 C30,10 27,17 23,24 Z" />
      <path class="sprig-petal" d="M23,24 C28,20.5 34.5,18.5 40,19 C35,22.5 29,24.5 23,24 Z" />
      <path class="sprig-stamen" d="M23,23 L18.5,12 M23,23 L24.5,10 M23,23 L28.5,13" />
      <circle class="sprig-anther" cx="18.5" cy="12" r="1.1" />
      <circle class="sprig-anther" cx="24.5" cy="10" r="1.1" />
      <circle class="sprig-anther" cx="28.5" cy="13" r="1.1" />
    </g>
  </g>
</svg>`;
}

export function placePinSvg(): string {
  return `<svg viewBox="0 0 12 14" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round" aria-hidden="true"><path d="M6,13 C3.5,9.8 1.5,7.6 1.5,5.2 A4.5,4.5 0 1,1 10.5,5.2 C10.5,7.6 8.5,9.8 6,13 Z" /><circle cx="6" cy="5.2" r="1.6" /></svg>`;
}

const TAB_ICONS: Record<string, string> = {
  player:
    '<path d="M8,14 C4,11 1.5,8.6 1.5,5.8 C1.5,3.6 3.2,2 5.2,2 C6.4,2 7.4,2.7 8,3.6 C8.6,2.7 9.6,2 10.8,2 C12.8,2 14.5,3.6 14.5,5.8 C14.5,8.6 12,11 8,14 Z" />',
  heroine:
    '<path d="M5.8,8.8 C4.3,6.9 3.9,4.4 5.8,1.9 C7.7,4.4 7.3,6.9 5.8,8.8 Z M5.8,8.8 C4.1,8.5 2.5,7.2 1.9,4.6 C4.6,4.7 6.1,6.3 5.8,8.8 Z M5.8,8.8 C7.5,8.5 9.1,7.2 9.7,4.6 C7,4.7 5.5,6.3 5.8,8.8 Z M5.8,10.2 L5.8,14.5" />' +
    '<path d="M11.4,7.4 C10.4,6.1 10.2,4.5 11.4,2.9 C12.6,4.5 12.4,6.1 11.4,7.4 Z M11.4,7.4 C10.3,7.2 9.3,6.4 8.9,4.8 C10.6,4.9 11.5,5.9 11.4,7.4 Z M11.4,7.4 C12.5,7.2 13.5,6.4 13.9,4.8 C12.2,4.9 11.3,5.9 11.4,7.4 Z M11.4,8.4 L11.4,12.6" />',
  map: '<path d="M1.5,3.5 L5.5,2 L10.5,3.5 L14.5,2 L14.5,12.5 L10.5,14 L5.5,12.5 L1.5,14 Z M5.5,2 L5.5,12.5 M10.5,3.5 L10.5,14" />',
  settings:
    '<path d="M2,4.5 L14,4.5 M2,11.5 L14,11.5" /><circle cx="10" cy="4.5" r="2" /><circle cx="6" cy="11.5" r="2" />',
};

export function tabIconSvg(tab: string): string {
  return `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${TAB_ICONS[tab] ?? ''}</svg>`;
}

export function garlandSvg(): string {
  return `<svg class="garland-wire" viewBox="0 0 100 20" preserveAspectRatio="none" aria-hidden="true"><path d="M-2,1 Q25,15 50,6 T102,4" /></svg>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// 天气动态层
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 坐标用固定种子生成，不用 Math.random：
 * 面板每次数据更新都会整体重建，随机坐标会让雨丝每次重渲都瞬移一下。
 */
function seeded(seed: number) {
  let state = (seed ^ 0x9e3779b9) >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

/** 把天气名折叠成种子，同一种天气每次得到同一套坐标 */
function weatherSeed(weather: string, salt: number) {
  let hash = salt;
  for (let i = 0; i < weather.length; i += 1) hash = (hash * 31 + weather.charCodeAt(i)) >>> 0;
  return hash;
}

/** 雨丝：长度、斜度、密度按调用方的画布尺寸给 */
function rainLayer(weather: string, width: number, height: number, count: number, slantRatio: number, lengthRatio: number) {
  const rand = seeded(weatherSeed(weather, 7));
  const slant = slantRatio * (width / 640);
  const parts: string[] = [];
  for (let i = 0; i < count; i += 1) {
    // 横向范围放宽到画布外，避免两侧出现明显的空白边界
    const x = rand() * (width + width * 0.2) - width * 0.1;
    const y = rand() * height;
    const length = (lengthRatio * (0.7 + rand() * 0.6)) * (height / 400);
    const duration = 0.55 + rand() * 0.45;
    const delay = -rand() * 2;
    const opacity = 0.5 + rand() * 0.5;
    parts.push(
      `<path class="weather-drop" d="M${x.toFixed(1)},${y.toFixed(1)} l${slant.toFixed(1)},${length.toFixed(1)}" ` +
        `style="--dur:${duration.toFixed(2)}s;--delay:${delay.toFixed(2)}s;--o:${opacity.toFixed(2)}" />`,
    );
  }
  return parts.join('');
}

/** 雪花：下落慢、横向飘移大 */
function snowLayer(weather: string, width: number, height: number, count: number) {
  const rand = seeded(weatherSeed(weather, 23));
  const parts: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const x = rand() * width;
    const y = rand() * height;
    const r = (0.9 + rand() * 1.5) * (width / 640);
    const duration = 6 + rand() * 6;
    const delay = -rand() * 8;
    const drift = (rand() * 24 - 12) * (width / 640);
    parts.push(
      `<circle class="weather-flake" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(2)}" ` +
        `style="--dur:${duration.toFixed(1)}s;--delay:${delay.toFixed(1)}s;--dx:${drift.toFixed(1)}px" />`,
    );
  }
  return parts.join('');
}

/**
 * 雾：用径向渐变的大团云絮，而不是实心色带。
 * 实心矩形横杠看起来像画了几道线；云絮边缘透明，叠在一起才有能见度下降的感觉。
 * 每层用不同的长宽比与速度横移，避免整齐划一。
 *
 * 位置与尺寸的两个坑（真渲染图实测得出）：
 *   1. 地图框是可拖动的视口，手机宽度下横向只能看到画布 640 坐标系里约 240 单位。
 *      雾团若只排在画布中段，默认视口里一团都看不到。故横向铺满整张画布。
 *   2. 半径过大会让可见区里只剩渐变最边缘的透明尾巴，等于没画。
 *      直径控制在 0.36~0.56 倍画布宽，中心留在画布内。
 */
function mistLayer(width: number, height: number) {
  const rand = seeded(weatherSeed('雾', 91));
  const blobs = [
    { cy: 0.3, rx: 0.28, ry: 0.2, o: 0.34, dur: 34 },
    { cy: 0.52, rx: 0.22, ry: 0.15, o: 0.3, dur: 46 },
    { cy: 0.74, rx: 0.3, ry: 0.22, o: 0.32, dur: 40 },
    { cy: 0.42, rx: 0.18, ry: 0.13, o: 0.26, dur: 58 },
  ];
  return blobs
    .map((blob, index) => {
      // 铺满画布横向：每个雾团占 1/4 段，再加抖动，任何滚动位置都有雾可见
      const cx = width * ((index + 0.5) / blobs.length + (rand() - 0.5) * 0.24);
      return (
        `<ellipse class="weather-mist" cx="${cx.toFixed(0)}" cy="${(height * blob.cy).toFixed(1)}" ` +
        `rx="${(width * blob.rx).toFixed(0)}" ry="${(height * blob.ry).toFixed(1)}" ` +
        `style="--dur:${blob.dur}s;--delay:${(-index * 9).toFixed(0)}s;--o:${blob.o}" />`
      );
    })
    .join('');
}

/** 雷雨：在两处各闪一次，周期很长，避免频繁晃眼 */
function boltLayer(width: number, height: number) {
  return [0.24, 0.62]
    .map((ratio, index) => {
      const x = width * ratio;
      const top = height * 0.1;
      const bottom = height * 0.46;
      const seg = bottom - top;
      return (
        `<path class="weather-bolt" d="M${x.toFixed(0)},${top.toFixed(0)} ` +
        `l${(seg * 0.24).toFixed(0)},${(seg * 0.45).toFixed(0)} ` +
        `l${(-seg * 0.3).toFixed(0)},0 l${(seg * 0.2).toFixed(0)},${(seg * 0.55).toFixed(0)}" ` +
        `style="--delay:${(index * 5.5).toFixed(1)}s" />`
      );
    })
    .join('');
}

/** 各画布的粒子数：同样的天气，小块面板要少一些才不显拥挤 */
const WEATHER_COUNTS: Record<string, { 小雨: number; 大雨: number; 雷雨: number; 雪: number }> = {
  map: { 小雨: 14, 大雨: 34, 雷雨: 26, 雪: 26 },
  bloom: { 小雨: 8, 大雨: 18, 雷雨: 14, 雪: 14 },
};

/**
 * 天气动态层：按天气生成雨丝 / 雪花 / 雾絮 / 闪电。
 * 晴、多云、阴与待设定返回空串——这些天气只需纸面变色，不必再养一层动画。
 *
 * scale 决定粒子密度：状态栏地图用 640×400，百合花面板用 100×120。
 */
export function weatherOverlaySvg(
  weather: string,
  width: number,
  height: number,
  scale: 'map' | 'bloom' = 'map',
): string {
  const counts = WEATHER_COUNTS[scale];
  let body = '';
  if (weather === '小雨') body = rainLayer(weather, width, height, counts.小雨, 3.4, 18);
  else if (weather === '大雨') body = rainLayer(weather, width, height, counts.大雨, 5.6, 26);
  else if (weather === '雷雨') {
    body = rainLayer(weather, width, height, counts.雷雨, 5, 24) + boltLayer(width, height);
  } else if (weather === '雪') body = snowLayer(weather, width, height, counts.雪);
  else if (weather === '雾') body = mistLayer(width, height);
  if (!body) return '';
  return `<g class="weather-layer" aria-hidden="true">${body}</g>`;
}
