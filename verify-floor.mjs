import fs from 'node:fs';
import path from 'node:path';
import { JSDOM } from 'jsdom';
import * as zod from 'zod';

const html = fs.readFileSync(path.join(import.meta.dirname, 'dist/YuriOpening/界面/主界面/index.html'), 'utf8');
const script = html.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1];
if (!script) throw new Error('楼层页没有内联 module 脚本');

const dom = new JSDOM('<!DOCTYPE html><html><head></head><body><div id="app"></div></body></html>', {
  runScripts: 'outside-only',
  pretendToBeVisual: true,
  url: 'https://local.test/',
});
const { window } = dom;
const doc = window.document;

window.matchMedia = () => ({ matches: true, media: '(orientation: landscape)', addEventListener() {}, removeEventListener() {} });
window.screen.orientation = { lock: () => Promise.resolve() };
const vueGlobal = fs.readFileSync(path.join(import.meta.dirname, 'node_modules/vue/dist/vue.global.prod.js'), 'utf8');
window.eval(vueGlobal);
window.z = zod;
window.SillyTavern = { characterId: 'verify', name1: '测试玩家', name2: '林清' };
window.getLastMessageId = () => -1;
window.getCurrentMessageId = () => 0;
window.getChatMessages = () => [];
window.getVariables = () => ({ stat_data: {} });
window.waitGlobalInitialized = () => Promise.resolve();
let shared = null;
window.initializeGlobal = (name, api) => {
  if (name === 'YuriFront') shared = api;
};
window.eventOn = () => ({ stop() {} });
window.tavern_events = {
  MESSAGE_RECEIVED: 'message_received', MESSAGE_UPDATED: 'message_updated', MESSAGE_EDITED: 'message_edited',
  MESSAGE_DELETED: 'message_deleted', MESSAGE_SWIPED: 'message_swiped', CHAT_CHANGED: 'chat_changed',
};
window.iframe_events = { GENERATION_STARTED: 'generation_started', GENERATION_ENDED: 'generation_ended' };
window.Mvu = { events: { VARIABLE_INITIALIZED: 'mvu-init', VARIABLE_UPDATE_ENDED: 'mvu-ended' } };
window.$ = arg => {
  if (typeof arg === 'function') { arg(); return window.$; }
  return { one() { return this; }, on() { return this; }, off() { return this; } };
};
window._ = {
  get: (object, path, fallback) => {
    const parts = String(path).replace(/\[(\d+)\]/g, '.$1').split('.').filter(Boolean);
    let current = object;
    for (const part of parts) {
      if (current === null || current === undefined) return fallback;
      current = current[part];
    }
    return current === undefined ? fallback : current;
  },
  clamp: (value, lower, upper) => Math.min(Math.max(value, lower), upper),
};

const factory = new Function('window', 'document', 'globalThis',
  `with (window) { (function(){ ${script}\n})(); }`);
factory(window, doc, window);
await new Promise(resolve => setTimeout(resolve, 120));

const root = doc.getElementById('yuri-front');
const failures = [];
const check = (label, ok, detail = '') => {
  console.log(`${ok ? '  ✓' : '  ✗'} ${label}${ok || !detail ? '' : ` — ${detail}`}`);
  if (!ok) failures.push(label);
};
check('楼层页挂出前端', Boolean(root));
check('自动进入开局表单', root?.dataset.mode === 'opening', root?.dataset.mode);
check('开局表单已渲染', Boolean(doc.querySelector('.opening-shell')));
check('表单样式已注入', Boolean(doc.getElementById('yuri-front-style')));
check('全屏入口仍共享', typeof shared?.openOpening === 'function');

window.getVariables = () => ({ stat_data: { 开场: { $已提交: true } } });
shared?.openOpening();
await new Promise(resolve => setTimeout(resolve, 60));
check('提交后切到故事画布', root?.dataset.mode === 'main', root?.dataset.mode);
check('故事画布三块结构', Boolean(doc.querySelector('.front-head')) && Boolean(doc.querySelector('.front-player')) && Boolean(doc.querySelector('.front-chat')));

window.dispatchEvent(new window.Event('pagehide'));
dom.window.close();
if (failures.length) process.exitCode = 1;
