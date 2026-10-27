#!/usr/bin/env node
/**
 * 状态栏与地图动效审计（只读，不写任何文件）：
 *   1. 产物 CSS 审：地图呼吸（河流 12s、光晕 7s/0.14→0.20、涟漪 6s）、暖纸灯圈替换霓虹、
 *      盖章环与名字短线、抽屉 280ms、页签下划线 160ms、三处 overshoot 已删、
 *      reduced-motion 清 delay、844×390 一圈涟漪、高度 <560px 关萤火。
 *   2. 主界面 DOM 冒烟：真跑一遍打包产物，数一数地点灯圈、涟漪，点一个地点看盖章环。
 *   3. 独立状态栏产物：脚本里也换成了 node-lamp，涟漪延时跟着 6s 改成 3s。
 *
 * 两个产物都要查，因为 界面/状态栏/style.scss 同时被主界面 @use。
 * 断言按生产构建的压缩写法写（webpack --mode production）；
 * 这是无头近似验证，替代不了真机与 844×390 截图。
 */
import fs from 'node:fs';
import path from 'node:path';
import { JSDOM } from 'jsdom';
import * as Vue from 'vue';
import * as zodModule from 'zod';

const here = import.meta.dirname;
/* 可传入一份快照 dist，避免与其他构建任务抢同一个 dist */
const distRoot = process.argv[2] ? path.resolve(process.argv[2]) : path.join(here, 'dist');
const standalonePath = path.join(distRoot, 'YuriOpening/界面/状态栏/index.html');
const mainPath = path.join(distRoot, 'YuriOpening/脚本/主界面/index.js');
for (const file of [standalonePath, mainPath]) {
  if (!fs.existsSync(file)) throw new Error(`缺少产物：${file}`);
}

const failures = [];
const notes = [];
function check(label, condition, detail = '') {
  if (condition) notes.push(`  ✓ ${label}`);
  else failures.push(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`);
}

/* 压缩产物里空白可能被折叠，先压成单空格并去掉引号，断言就能照源码写法读 */
const norm = text => text.replace(/\s+/g, ' ').replace(/["']/g, '');

/* 取 head 之后第一个声明块的正文（head 只写选择器前缀，不必写全） */
function block(css, head) {
  const at = css.indexOf(head);
  if (at < 0) return '';
  let i = css.indexOf('{', at + head.length);
  if (i < 0) return '';
  const start = i + 1;
  let depth = 1;
  for (i = start; i < css.length; i += 1) {
    if (css[i] === '{') depth += 1;
    else if (css[i] === '}') {
      depth -= 1;
      if (depth === 0) return css.slice(start, i);
    }
  }
  return '';
}

const EASE = 'cubic-bezier(0.22,1,0.36,1)';

const standaloneHtml = fs.readFileSync(standalonePath, 'utf8');
const standaloneCss = norm(
  [...standaloneHtml.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(match => match[1]).join('\n')
);
const standaloneScript = norm(
  [...standaloneHtml.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(match => match[1]).join('\n')
);
const mainJs = norm(fs.readFileSync(mainPath, 'utf8'));

const targets = [
  { name: '独立状态栏', css: standaloneCss, js: standaloneScript },
  { name: '主界面', css: mainJs, js: mainJs },
];

for (const { name, css, js } of targets) {
  notes.push(`【${name}】`);

  /* ── 地图呼吸 ── */
  check(`${name} · 河流虚线 12s 顺流`, css.includes('animation:hud-water-flow 12s linear infinite'));
  check(`${name} · 河流只走一个虚线周期`, block(css, '@keyframes hud-water-flow').includes('stroke-dashoffset:-12'));
  check(`${name} · 涟漪 6s 扩散`, css.includes('animation:hud-ripple 6s ease-out infinite'));
  check(`${name} · 当前地点光晕 7s`, css.includes('animation:hud-halo-pulse 7s ease-in-out infinite'));
  const halo = block(css, '@keyframes hud-halo-pulse');
  check(`${name} · 光晕透明度 0.14→0.20`, halo.includes('opacity:.14') && halo.includes('opacity:.2;'), halo);

  /* ── 暖纸灯圈替换霓虹 ── */
  check(`${name} · 不再有 node-neon`, !css.includes('node-neon'));
  check(`${name} · 不再有 hud-neon-flicker`, !css.includes('hud-neon-flicker'));
  const lamp = block(css, '.map-node .node-lamp');
  check(`${name} · 灯圈是低透明度填充`, lamp.includes('fill:#e9bd72') && lamp.includes('opacity:0'), lamp);
  check(`${name} · 灯圈不描边不发光`, !lamp.includes('stroke:') && !lamp.includes('filter:'), lamp);
  check(`${name} · 夜间灯圈低透明度 0.18`, block(css, '[data-daypart=night] .node-lamp').includes('opacity:.18'));
  check(`${name} · 灯圈 9s 呼吸`, css.includes('animation:hud-lamp-breathe 9s ease-in-out infinite'));
  check(`${name} · 灯圈呼吸关键帧`, /opacity/.test(block(css, '@keyframes hud-lamp-breathe')));
  check(`${name} · 彩色 drop-shadow 已删`, !css.includes('drop-shadow(0 0 3px var(--hud-accent))'));

  /* ── 地点盖章 ── */
  check(`${name} · 悬停底座描边加粗`, block(css, '.map-node:hover .node-ground').includes('stroke-width:2'));
  check(`${name} · 悬停光晕略暖`, block(css, '.map-node:hover .node-halo').includes('fill:#e9bd72'));
  const ring = block(css, '.map-node .node-select-ring');
  check(`${name} · 盖章环 pathLength 适配`, ring.includes('stroke-dasharray:1') && ring.includes('stroke-dashoffset:0'), ring);
  check(`${name} · 盖章环 360ms`, css.includes(`animation:hud-seal-ring 360ms ${EASE}`));
  const seal = block(css, '@keyframes hud-seal-ring');
  check(`${name} · 盖章环 dashoffset 1→0`, seal.includes('stroke-dashoffset:1') && seal.includes('stroke-dashoffset:0'), seal);
  check(`${name} · 名字下短线`, block(css, '.map-node .node-select-line').includes('stroke:var(--hud-accent)'));
  check(`${name} · 短线 360ms`, css.includes(`animation:hud-seal-line 360ms ${EASE}`));

  /* ── 状态栏抽屉与页签 ── */
  check(`${name} · 抽屉 280ms`, css.includes(`animation:hud-drawer-unfold 280ms ${EASE}`));
  check(`${name} · 页签下划线 160ms 滑动`, block(css, '.hud-tab-ink').includes('transition:transform 160ms'));
  check(`${name} · tab-pop 无 overshoot`, css.includes(`animation:hud-tab-pop .36s ${EASE}`));
  check(`${name} · node-pop 无 overshoot`, css.includes(`animation:hud-node-pop .5s ${EASE} backwards`));
  check(`${name} · bloom-open 无 overshoot`, css.includes(`animation:hud-bloom-open .7s ${EASE} backwards`));
  check(`${name} · 页签图标悬停过渡无过冲`, block(css, '.hud-tab svg').includes(`transition:transform .3s ${EASE}`));
  check(`${name} · 数值浮起无过冲`, css.includes(`animation:hud-delta-float .7s ${EASE} 1.2s backwards`));
  check(`${name} · tab-pop 关键帧不再放大过头`, !block(css, '@keyframes hud-tab-pop').includes('scale(1.15)'));
  check(
    `${name} · 盖章/叶片/浮动三处改无过冲`,
    css.includes(`animation:hud-seal-press .6s ${EASE} .1s backwards`)
      && css.includes(`animation:hud-leaf-unfurl .55s ${EASE} backwards`)
      && css.includes(`transition:transform .35s ${EASE}`)
  );
  check(
    `${name} · 样式表里已无过冲缓动`,
    !['cubic-bezier(0.3,1.4', 'cubic-bezier(0.3,1.5', 'cubic-bezier(0.3,1.6', 'cubic-bezier(0.5,0,0.2,1.15']
      .some(pattern => css.includes(pattern))
  );
  const reduced = block(css, '@media (prefers-reduced-motion:reduce)');
  check(
    `${name} · reduced-motion 清 delay`,
    reduced.includes('animation-delay:0s !important') && reduced.includes('transition-delay:0s !important'),
    reduced
  );

  /* ── 视口 ── */
  const shortLandscape = block(css, '(max-height:560px)');
  check(
    `${name} · 844×390 只留一圈涟漪`,
    shortLandscape.includes('.node-ripple+.node-ripple{display:none}'),
    shortLandscape
  );
  const lowHeight = block(css, '@media (max-height:559px)');
  check(`${name} · 高度 <560px 关萤火`, lowHeight.includes('.map-firefly{display:none}'), lowHeight);

  /* ── 脚本跟着换 ── */
  check(`${name} · 脚本输出 node-lamp`, js.includes('class:node-lamp'));
  check(`${name} · 脚本不再输出 node-neon`, !js.includes('node-neon'));
  check(`${name} · 涟漪延时对齐 6s 周期`, js.includes('animationDelay') && (js.includes('* 3}s') || /animationDelay=\d+\*/.test(js)));
}

/* ── 地图数据没被改动 ── */
const mapSource = fs.readFileSync(path.join(here, 'src/YuriOpening/界面/状态栏/map.ts'), 'utf8');
const nodesAt = mapSource.indexOf('export const MAP_NODES');
const nodesBody = mapSource.slice(nodesAt, mapSource.indexOf('\n];', nodesAt));
const nodeCount = (nodesBody.match(/^\s{4}id: '/gm) ?? []).length;
const lampCount = (nodesBody.match(/nightGlow: true/g) ?? []).length;
check('地图地点仍是 19 处', nodeCount === 19, String(nodeCount));
check('夜生活地点仍是 4 处', lampCount === 4, String(lampCount));

/* ── 主界面 DOM 冒烟 ── */
const source = fs.readFileSync(mainPath, 'utf8');
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

async function smoke() {
  const dom = new JSDOM(
    `<!DOCTYPE html><html><head></head><body>
      <div id="chat"><div id="chat_history"></div></div>
      <form id="send_form"><textarea id="send_textarea"></textarea><button id="send_but" type="button">发送</button></form>
    </body></html>`,
    { runScripts: 'outside-only', pretendToBeVisual: true, url: 'https://local.test/' }
  );
  const { window } = dom;
  const doc = window.document;
  const errors = [];
  window.addEventListener('error', event => errors.push(String(event.error ?? event.message)));
  window.matchMedia = () => ({
    matches: true,
    media: '(orientation: landscape)',
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
  });
  Object.defineProperty(doc, 'fullscreenElement', { configurable: true, get: () => null });
  doc.documentElement.requestFullscreen = () => Promise.resolve();
  const state = {
    玩家: { _姓名: '测试玩家', _年龄: 24, _职业: { _方向: '设计', _具体: '自由职业' } },
    玩家状态: { 心情: '放松', 精力: 71, 身体状态: '健康', 当前行动: '靠在沙发上', 关系姿态: '自然相处', 当前穿着: '浅色针织衫' },
    环境: {
      日期: '2026-10-21', 时间: '21:40', 天气: '小雨',
      地点: { 城市: '百合市', 区域: '中心城区', 具体地点: '铃兰公寓·客厅' },
    },
    林清: {
      亲近: 66, 心动: 58, 欲望: 48, 心情: '微醺', 关系身份: '暧昧',
      所在地点: '铃兰公寓·客厅', 当前行动: '把外套搭在椅背上', 当前穿着: '浅色针织衫',
      心声: '今晚的雨很适合留人。',
      亲密事件: { 阶段: '未开始', 当前尺度: '无', 具体场景: '铃兰公寓·客厅', 与角色同场: true, 第三方在场: false, 同意状态: '未确认', 首次事件已完成: false },
    },
    苏玥: { 亲近: 42, 心动: 30, 欲望: 22, 心情: '愉快', 关系身份: '朋友', 所在地点: '绣球路步行街', 当前行动: '在花店收最后一束花' },
    地图: { 当前地点: '蔷薇文化传媒', 地点状态: {} },
  };
  const messages = [
    { message_id: 0, role: 'user', message: '先看看窗外的雨。', is_hidden: false },
    { message_id: 1, role: 'assistant', message: '她把杯子推到你面前，杯壁还留着温度。', is_hidden: false },
  ];
  const handlers = new Map();
  window.getLastMessageId = () => 1;
  window.getCurrentMessageId = () => 1;
  window.getChatMessages = () => messages;
  window.getVariables = () => ({ stat_data: state });
  window.SillyTavern = { characterId: 'verify', name1: '测试玩家', name2: '林清' };
  window.Vue = Vue;
  window.z = zodModule;
  window.initializeGlobal = () => {};
  window.waitGlobalInitialized = () => Promise.resolve();
  window.eventOn = (name, handler) => {
    if (!handlers.has(name)) handlers.set(name, new Set());
    handlers.get(name).add(handler);
    return { stop() { handlers.get(name)?.delete(handler); } };
  };
  window.errorCatched = fn => () => {
    try {
      const result = fn();
      if (result && typeof result.catch === 'function') result.catch(error => errors.push(String(error)));
      return result;
    } catch (error) {
      errors.push(String(error));
    }
  };
  window.triggerSlash = () => Promise.resolve('');
  window.Mvu = { events: { VARIABLE_INITIALIZED: 'mvu-init', VARIABLE_UPDATE_ENDED: 'mvu-ended' }, getMvuData: () => ({ stat_data: state }) };
  window.tavern_events = {
    MESSAGE_RECEIVED: 'message_received', MESSAGE_UPDATED: 'message_updated', MESSAGE_EDITED: 'message_edited',
    MESSAGE_DELETED: 'message_deleted', MESSAGE_SWIPED: 'message_swiped', CHAT_CHANGED: 'chat_changed',
  };
  window.iframe_events = { GENERATION_STARTED: 'generation_started', GENERATION_ENDED: 'generation_ended' };
  window.$ = arg => {
    if (typeof arg === 'function') { arg(); return window.$; }
    return { one() { return this; }, on() { return this; }, off() { return this; } };
  };
  window._ = { get: (object, key) => object?.[key], clamp: (value, lower, upper) => Math.min(Math.max(value, lower), upper) };

  const factory = new Function('window', 'document', 'globalThis', `with (window) { (function(){ ${source}\n})(); }`);
  factory(window, window.document, window);
  await wait(80);
  await wait(80);

  const root = doc.getElementById('yuri-front');
  check('主界面 · 挂载成功', Boolean(root), String(root));
  doc.querySelector('[data-action="enter"]')?.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await wait(60);
  doc.querySelector('.obs-handle')?.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  doc.querySelector('.obs-tab[data-tab="map"]')?.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));

  check('主界面 · 地图已渲染', Boolean(doc.querySelector('.map-canvas')));
  check(
    '主界面 · 地点数 19',
    doc.querySelectorAll('.map-canvas .map-node').length === 19,
    String(doc.querySelectorAll('.map-canvas .map-node').length)
  );
  check(
    '主界面 · 夜里四处暖纸灯圈',
    doc.querySelectorAll('.map-canvas .node-lamp').length === 4,
    String(doc.querySelectorAll('.map-canvas .node-lamp').length)
  );
  check('主界面 · 无霓虹圈残留', doc.querySelectorAll('.map-canvas .node-neon').length === 0);
  const current = doc.querySelector('.map-canvas .map-node.is-current');
  check(
    '主界面 · 当前地点两圈涟漪',
    current?.querySelectorAll('.node-ripple').length === 2,
    String(current?.querySelectorAll('.node-ripple').length)
  );

  const target =
    [...doc.querySelectorAll('.map-canvas .map-node')].find(node => !node.classList.contains('is-current')) ?? current;
  target?.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await wait(40);
  const ring = doc.querySelector('.map-canvas .node-select-ring');
  check('主界面 · 选中后出现盖章环', Boolean(ring));
  check('主界面 · 盖章环带 pathLength=1', ring?.getAttribute('pathLength') === '1', String(ring?.getAttribute('pathLength')));
  check('主界面 · 名字下出现短线', Boolean(doc.querySelector('.map-canvas .node-select-line')));
  check('主界面 · 只有一个地点带盖章环', doc.querySelectorAll('.map-canvas .node-select-ring').length === 1);
  check('主界面 · 选中地点有详情卡', Boolean(doc.querySelector('.node-detail')));
  check('主界面 · 运行期无异常', errors.length === 0, errors.join(' / '));
}

await smoke();

for (const line of notes) console.log(line);
if (failures.length) {
  console.log('');
  for (const line of failures) console.log(line);
  console.log(`\n${failures.length} 项未通过`);
  process.exit(1);
}
console.log(`\n全部 ${notes.filter(line => line.startsWith('  ✓')).length} 项通过`);
