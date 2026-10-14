/**
 * mist-defs.ts
 * 雾絮的径向渐变定义。
 *
 * 单独成文件是因为 SVG 的 url(#id) 不能跨元素引用：地图与花期是两张独立画布，
 * 各自都要带一份同样的 <defs>。写在 icons.ts 里会与 index.ts 形成循环依赖。
 */
export const HUD_MIST_GRADIENT_ID = 'hud-mist-blob';

/**
 * 白心向边缘透明，叠起来才像能见度下降，而不是几条实心横条。
 *
 * 中段停靠点用 65%/0.8 而不是 50%/0.55：原曲线的有效不透明区太窄，
 * 乘上每团 0.26~0.34 的 opacity 后，在近白的纸面上会变成看不见。
 * 这个浓度是拿真渲染图 A/B 对比调出来的（实测可见且不盖住地图标签）。
 */
export function mistDefsSvg(): string {
  return (
    `<defs><radialGradient id="${HUD_MIST_GRADIENT_ID}">` +
    '<stop offset="0%" stop-color="#fff" stop-opacity="1" />' +
    '<stop offset="65%" stop-color="#fff" stop-opacity="0.8" />' +
    '<stop offset="100%" stop-color="#fff" stop-opacity="0" />' +
    '</radialGradient></defs>'
  );
}
