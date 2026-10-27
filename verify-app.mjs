#!/usr/bin/env node
/**
 * 一体化前端验证：一张画布、一个观景窗（角色/地图/设置页签）、
 * 玩家栏、聊天、原生输入、全屏/手机/原生视图。
 */
import fs from 'node:fs';
import path from 'node:path';
import { JSDOM } from 'jsdom';
import * as Vue from 'vue';
import * as zodModule from 'zod';

const here = import.meta.dirname;
const dist = path.join(here, 'dist/YuriOpening/脚本/主界面/index.js');
if (!fs.existsSync(dist)) throw new Error(`缺少主界面产物：${dist}`);
const source = fs.readFileSync(dist, 'utf8');

const failures = [];
const notes = [];
function check(label, condition, detail = '') {
  if (condition) notes.push(`  ✓ ${label}`);
  else failures.push(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`);
}

async function run() {
  const dom = new JSDOM(
    `<!DOCTYPE html><html><head></head><body>
      <div id="chat"><div id="chat_history"></div></div>
      <form id="send_form"><textarea id="send_textarea"></textarea><button id="send_but" type="button">发送</button></form>
    </body></html>`,
    { runScripts: 'outside-only', pretendToBeVisual: true, url: 'https://local.test/' },
  );
  const { window } = dom;
  const doc = window.document;
  // 手机本地状态：预置林清 2 条未读 + 已加好友，供角标与「点横幅进聊天」断言使用
  window.localStorage.setItem('YuriOpening:phone:default:notify:v1', JSON.stringify({
    unread: { linqing: 2 }, notices: [], cursor: {}, seen: [],
  }));
  window.localStorage.setItem('YuriOpening:phone:default:hasAdded:v1', 'true');
  const errors = [];
  window.addEventListener('error', event => errors.push(String(event.error ?? event.message)));

  let landscape = true;
  window.matchMedia = () => ({
    matches: landscape,
    media: '(orientation: landscape)',
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
  });
  let fullscreenElement = null;
  Object.defineProperty(doc, 'fullscreenElement', { configurable: true, get: () => fullscreenElement });
  doc.documentElement.requestFullscreen = () => {
    fullscreenElement = doc.documentElement;
    return Promise.resolve();
  };
  doc.exitFullscreen = () => {
    fullscreenElement = null;
    return Promise.resolve();
  };
  window.screen.orientation = { lock: () => Promise.resolve() };

  let lastId = 2;
  let messages = [
    { message_id: 0, role: 'user', message: '先看看窗外的雨。', is_hidden: false },
    { message_id: 1, role: 'assistant', message: '她把杯子推到你面前，杯壁还留着温度。', is_hidden: false, extra: { gen_started: '2026-10-21T13:40:00.000Z', gen_finished: '2026-10-21T13:40:03.400Z' } },
    { message_id: 2, role: 'assistant', message: '林清在沙发另一头坐下，外套搭在椅背上。', is_hidden: false, name: '林清', extra: { gen_started: '2026-10-21T13:41:00.000Z', gen_finished: '2026-10-21T13:41:08.200Z' } },
  ];
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
    苏玥: {
      亲近: 42, 心动: 30, 欲望: 22, 心情: '愉快', 关系身份: '朋友',
      所在地点: '绣球路步行街', 当前行动: '在花店收最后一束花',
    },
    地图: { 当前地点: '蔷薇文化传媒', 地点状态: {} },
  };
  const handlers = new Map();
  const eventOn = (name, handler) => {
    if (!handlers.has(name)) handlers.set(name, new Set());
    handlers.get(name).add(handler);
    return { stop() { handlers.get(name)?.delete(handler); } };
  };
  const emit = (name, payload) => handlers.get(name)?.forEach(handler => handler(payload));

  window.__flowerArt = { 'lily-22': 'data:image/webp;base64,AAAA' };
  window.getLastMessageId = () => lastId;
  window.getCurrentMessageId = () => lastId;
  window.getChatMessages = () => messages;
  window.getVariables = () => ({ stat_data: state });
  window.SillyTavern = { characterId: 'verify', name1: '测试玩家', name2: '林清' };
  window.Vue = Vue;
  window.z = zodModule;
  let sharedFront = null;
  window.initializeGlobal = (name, api) => {
    if (name === 'YuriFront') sharedFront = api;
  };
  window.waitGlobalInitialized = () => Promise.resolve();
  window.eventOn = eventOn;
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
  window.Mvu = {
    events: { VARIABLE_INITIALIZED: 'mvu-init', VARIABLE_UPDATE_ENDED: 'mvu-ended' },
    getMvuData: () => ({ stat_data: state }),
  };
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
  let nativeClicks = 0;
  doc.getElementById('send_but')?.addEventListener('click', () => { nativeClicks += 1; });

  const factory = new Function('window', 'document', 'globalThis',
    `with (window) { (function(){ ${source}\n})(); }`);
  factory(window, window.document, window);
  await new Promise(resolve => setTimeout(resolve, 80));
  await new Promise(resolve => setTimeout(resolve, 80));

  const root = doc.getElementById('yuri-front');
  const shell = doc.querySelector('.front-shell');
  const gate = doc.querySelector('.front-gate');
  const enter = gate?.querySelector('[data-action="enter"]');
  const handle = doc.querySelector('.obs-handle');

  check('一体化画布根节点', Boolean(root));
  check('初始不遮挡原生聊天', root?.dataset.mode === 'closed' && root?.style.display === 'none', `${root?.dataset.mode}/${root?.style.display}`);
  check('全屏入口已共享到全局', typeof sharedFront?.openOpening === 'function');
  check('新设计样式注入', Boolean(doc.getElementById('yuri-front-style')));
  check('没有旧状态栏快照条', !doc.querySelector('.snapshot-bar') && !doc.querySelector('.hud-drawer'));
  check('顶部天气/日期/时间/地点', (doc.querySelector('.front-head')?.textContent ?? '').includes('小雨')
    && (doc.querySelector('.front-head')?.textContent ?? '').includes('2026-10-21')
    && (doc.querySelector('.front-head')?.textContent ?? '').includes('21:40')
    && (doc.querySelector('.front-head')?.textContent ?? '').includes('铃兰公寓'));
  check('玩家栏为独立画布栏', doc.querySelectorAll('.front-row').length === 6,
    String(doc.querySelectorAll('.front-row').length));
  check('观景窗默认收起且小箭头在顶部', Boolean(handle) && handle.classList.contains('is-docked'));

  landscape = false;
  window.dispatchEvent(new window.Event('resize'));
  check('竖屏时禁止进入', enter?.textContent === '请旋转设备横屏游玩' && enter.disabled === true);
  landscape = true;
  window.dispatchEvent(new window.Event('resize'));
  enter?.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await new Promise(resolve => setTimeout(resolve, 60));
  check('进入全屏后画布展开', root?.dataset.open === 'true' && shell);
  check('全屏后按钮为退出全屏', doc.querySelector('.front-action')?.textContent === '退出全屏');
  check('聊天楼层渲染', doc.querySelectorAll('.story-msg').length === 3,
    String(doc.querySelectorAll('.story-msg').length));
  const ids = [...doc.querySelectorAll('.story-meta .story-id')].map(node => node.textContent);
  check('楼层号与酒馆 message id 一致', ids.join('/') === '#0/#1/#2', ids.join('/'));
  const times = [...doc.querySelectorAll('.story-meta .story-time')].map(node => node.textContent);
  check('生成用时取自 gen_started/gen_finished', times.join('/') === '3.4s/8.2s', times.join('/'));
  check('AI 回复只显示角色名，不出现旁白', !(root?.textContent ?? '').includes('旁白'));

  handle?.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  check('顶部箭头打开唯一观景窗', doc.querySelector('.obs-layer')?.hidden === false);
  const tabs = Array.from(doc.querySelectorAll('.obs-tab')).map(tab => tab.textContent);
  check('观景窗三个页签', tabs.join('/') === '角色/地图/设置', tabs.join('/'));
  check('角色列表有两位', doc.querySelectorAll('.obs-char-item').length === 2);

  doc.querySelector('.obs-char-item[data-character="linqing"]')?.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  check('角色详情有花期图', Boolean(doc.querySelector('.obs-character .bloom-art')));
  check('角色详情有星图', Boolean(doc.querySelector('.obs-character .star-chart')));
  check('角色详情有心声', Boolean(doc.querySelector('.obs-voice')));
  check('角色详情仍在一张观景窗内', Boolean(doc.querySelector('.obs-window .obs-character')));
  doc.querySelector('.obs-close')?.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  check('收起观景窗后按钮悬浮', handle?.classList.contains('is-floating'));
  check('收起时先进 closing 退场', doc.querySelector('.obs-layer')?.dataset.state === 'closing');
  await new Promise(resolve => setTimeout(resolve, 3100));
  check('3 秒后箭头回到顶部边界', handle?.classList.contains('is-docked'));
  check('退场结束后观景窗隐藏', doc.querySelector('.obs-layer')?.hidden === true
    && doc.querySelector('.obs-layer')?.dataset.state === 'closed');

  handle?.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  doc.querySelector('.obs-tab[data-tab="map"]')?.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  check('同一观景窗切换到地图', doc.querySelector('.obs-window')?.dataset.tab === 'map' && Boolean(doc.querySelector('.map-canvas')));
  check('地图 19 个地点', doc.querySelectorAll('.map-node').length === 19,
    String(doc.querySelectorAll('.map-node').length));
  const travelNode = [...doc.querySelectorAll('.map-node')].find(node => !node.classList.contains('is-current'));
  travelNode?.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await new Promise(resolve => setTimeout(resolve, 20));
  doc.querySelector('.travel-button')?.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  check('地图前往写入主聊天输入', (doc.querySelector('.story-input')?.value ?? '').includes('我决定前往'),
    doc.querySelector('.story-input')?.value ?? '空');

  doc.querySelector('.obs-tab[data-tab="settings"]')?.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  check('同一观景窗切换到设置', doc.querySelector('.obs-window')?.dataset.tab === 'settings');
  check('设置不使用旧模块标题', !(doc.querySelector('.obs-settings')?.textContent ?? '').includes('状态栏设置'));
  const settingRows = [...doc.querySelectorAll('.obs-setting')];
  const toggleFor = label => settingRows.find(row => row.textContent?.includes(label))?.querySelector('input');
  const themeToggle = toggleFor('浅色模式');
  if (themeToggle) {
    themeToggle.checked = true;
    themeToggle.dispatchEvent(new window.Event('change', { bubbles: true }));
  }
  check('浅色模式写回画布主题', root?.dataset.theme === 'light', root?.dataset.theme ?? '无');
  const animateToggle = toggleFor('动态效果');
  if (animateToggle) {
    animateToggle.checked = false;
    animateToggle.dispatchEvent(new window.Event('change', { bubbles: true }));
  }
  check('设置写回画布动画属性', root?.dataset.animate === 'false', root?.dataset.animate ?? '无');
  doc.querySelector('.obs-close')?.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));

  const input = doc.querySelector('.story-input');
  if (input) input.value = '我坐到她旁边。';
  doc.querySelector('.story-send')?.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  check('原生输入代理写入', doc.getElementById('send_textarea')?.value === '我坐到她旁边。');
  check('原生发送按钮被点击', nativeClicks === 1, String(nativeClicks));
  check('发送后主输入清空', input?.value === '');

  messages = [...messages, { message_id: 3, role: 'assistant', message: '她侧过身，让出一点位置。', is_hidden: false }];
  lastId = 3;
  emit('message_received', messages[3]);
  check('楼层事件后聊天追加', doc.querySelectorAll('.story-msg').length === 4);

  // ── 内嵌手机：面板开合 / 横幅 / 角标 ──────────────────────
  const phoneLayer = doc.querySelector('.phone-layer');
  const phoneButton = doc.querySelector('.front-action:nth-child(2)');
  const phoneBadge = doc.querySelector('.front-action-badge');
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  const pushNotice = (id, preview) => sharedFront?.phone?.notify({
    id, charId: 'linqing', charName: '林清', preview, at: Date.now(), kind: 'message',
  });

  check('手机面板层建在主应用里', Boolean(phoneLayer) && phoneLayer.hidden === true);
  check('顶栏角标显示存量未读', phoneBadge?.hidden === false && phoneBadge?.textContent === '2',
    `${phoneBadge?.hidden}/${phoneBadge?.textContent}`);

  phoneButton?.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await wait(30);
  check('手机按钮打开内嵌面板', phoneLayer?.hidden === false && Boolean(doc.querySelector('.phone-mount .phone-shell.is-open')));
  phoneButton?.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await wait(30);
  check('再点手机按钮收起面板（closing 退场中）', phoneLayer?.dataset.state === 'closing' && !doc.querySelector('.phone-shell.is-open'));
  await wait(340);
  check('退场后手机面板隐藏', phoneLayer?.hidden === true && phoneLayer?.dataset.state === 'closed');

  pushNotice('n1', '今晚有空吗？');
  await wait(10);
  const firstBanner = doc.querySelector('.phone-banner');
  check('手机通知弹出横幅', Boolean(firstBanner) && (firstBanner?.textContent ?? '').includes('林清')
    && (firstBanner?.textContent ?? '').includes('今晚有空吗'));
  check('横幅带头像且容器是 live region', Boolean(doc.querySelector('.phone-banner-avatar svg'))
    && doc.querySelector('.phone-banner-stack')?.getAttribute('aria-live') === 'polite');

  firstBanner?.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await wait(40);
  check('点横幅打开对应聊天', phoneLayer?.hidden === false && Boolean(doc.querySelector('.phone-mount .wc-chatpage')));
  check('进聊天后角标清零', phoneBadge?.hidden === true, `${phoneBadge?.hidden}/${phoneBadge?.textContent}`);

  pushNotice('n2', '第二条');
  pushNotice('n3', '第三条');
  pushNotice('n4', '第四条');
  await wait(10);
  check('横幅最多同时 3 条', doc.querySelectorAll('.phone-banner:not(.is-leaving)').length === 3,
    String(doc.querySelectorAll('.phone-banner:not(.is-leaving)').length));

  const hovered = doc.querySelector('.phone-banner');
  hovered?.dispatchEvent(new window.MouseEvent('pointerenter'));
  await wait(4300);
  check('悬停暂停横幅计时', hovered?.isConnected === true && doc.querySelectorAll('.phone-banner').length === 1,
    String(doc.querySelectorAll('.phone-banner').length));
  hovered?.dispatchEvent(new window.MouseEvent('pointerleave'));
  await wait(4200);
  check('离开后恢复计时并自动消失', doc.querySelectorAll('.phone-banner').length === 0,
    String(doc.querySelectorAll('.phone-banner').length));

  doc.querySelector('.front-action-quiet')?.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  check('原生视图隐藏画布', root?.style.display === 'none');
  check('原生视图收起手机面板时先进 closing', phoneLayer?.dataset.state === 'closing');
  await wait(340);
  check('原生视图收起手机面板', phoneLayer?.hidden === true);
  const launcher = doc.querySelector('.front-launcher');
  check('原生视图保留启动按钮', Boolean(launcher) && launcher.hidden === false);
  launcher?.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await new Promise(resolve => setTimeout(resolve, 30));
  check('可从启动按钮返回画布', root?.style.display === '' && root?.dataset.open === 'true',
    `display=${root?.style.display} open=${root?.dataset.open} launcher=${launcher?.hidden}`);

  if (errors.length) failures.push(...errors.map(error => `  ✗ 运行时异常: ${error}`));
  window.dispatchEvent(new window.Event('pagehide'));
  dom.window.close();
}

console.log('一体化前端验证\n');
await run();
notes.forEach(line => console.log(line));
if (failures.length) {
  console.log('\n失败项:');
  failures.forEach(line => console.log(line));
  process.exitCode = 1;
} else {
  console.log('\n结论: 一张画布、单一观景窗、角色/地图/设置/聊天/输入全部通过。');
}
