#!/usr/bin/env node
/**
 * 关系账本验证（JSDOM，加载主界面打包产物）：
 * 1. 没有「关系」→ 关系页签隐藏、私密区不渲染、全程零写回；
 * 2. 有「关系」→ 两列账本、四根轴、知情圈、痕迹、修罗场；
 * 3. 动作按钮只填输入框（带【标记】），不发送、不改数据；输入框非空时提示；
 * 4. 亲近/心动 100 时花期取到 3 档，不再越界崩溃。
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

const wait = () => new Promise(resolve => setTimeout(resolve, 60));
const click = (window, node) => node?.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));

function baseState() {
  return {
    玩家: {
      _姓名: '测试玩家',
      _年龄: 24,
      _职业: { _方向: '专业/办公室', _具体: '出版社编辑' },
      _主特长: '摄影',
      _兴趣: ['阅读', '夜跑'],
    },
    玩家状态: { 心情: '平静', 精力: 68, 身体状态: '健康', 当前行动: '休息', 关系姿态: '自然相处', 当前穿着: '米色风衣' },
    环境: {
      日期: '2026-10-27',
      时间: '21:10',
      天气: '小雨',
      地点: { 城市: '百合市', 区域: '月见河畔', 具体地点: '月见河滨公园' },
    },
    林清: {
      亲近: 66,
      心动: 58,
      心情: '愉快',
      关系身份: '暧昧',
      所在地点: '铃兰公寓·客厅',
      当前行动: '把外套搭在椅背上',
      当前穿着: '浅色针织衫',
      心声: '今晚的雨很适合留人。',
    },
    苏玥: {
      亲近: 42,
      心动: 30,
      心情: '吃醋',
      关系身份: '朋友',
      所在地点: '昙夜酒吧',
      当前行动: '擦杯子',
      当前穿着: '深色衬衫',
    },
    地图: { 当前地点: '月见河滨公园', 地点状态: {} },
  };
}

function relationFixture() {
  return {
    _启用: true,
    林清: {
      私密: 72,
      克制: 31,
      失控: 66,
      风险: 44,
      知情: { 周姐: '知道林清最近常去月见河', 苏玥: '不知情' },
      痕迹: [
        { 类型: '衣领', 内容: '衬衫领口有一道口红印', 时间: '昨晚', 可见性: '只有你们知道' },
        { 类型: '消息', 内容: '凌晨两点的一条未删记录', 时间: '今天凌晨', 可见性: '苏玥可能看到' },
      ],
      修罗场: '试探',
    },
    苏玥: {
      私密: 40,
      克制: 55,
      失控: 20,
      风险: 80,
      知情: { 阿棠: '知道你们见过面' },
      痕迹: [],
      修罗场: '撞见',
    },
  };
}

async function boot(state) {
  const dom = new JSDOM(
    `<!DOCTYPE html><html><head></head><body>
      <div id="chat"><div id="chat_history"></div></div>
      <form id="send_form"><textarea id="send_textarea"></textarea><button id="send_but" type="button">发送</button></form>
      <button class="phone-fab" type="button">手机</button>
    </body></html>`,
    { runScripts: 'outside-only', pretendToBeVisual: true, url: 'https://local.test/' },
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

  let lastId = 1;
  let messages = [
    { message_id: 0, role: 'user', message: '我把伞收起来。', is_hidden: false },
    { message_id: 1, role: 'assistant', message: '林清侧过身，让出一半沙发。', is_hidden: false, name: '林清' },
  ];
  const calls = { nativeSend: 0, replaceVariables: 0, mvuWrite: 0 };
  const before = JSON.stringify(state);

  const handlers = new Map();
  const eventOn = (name, handler) => {
    if (!handlers.has(name)) handlers.set(name, new Set());
    handlers.get(name).add(handler);
    return { stop() { handlers.get(name)?.delete(handler); } };
  };

  window.__flowerArt = {};
  window.getLastMessageId = () => lastId;
  window.getCurrentMessageId = () => lastId;
  window.getChatMessages = () => messages;
  window.setChatMessages = () => Promise.resolve();
  window.deleteChatMessages = () => Promise.resolve();
  window.getVariables = () => ({ stat_data: state });
  window.replaceVariables = () => {
    calls.replaceVariables += 1;
  };
  window.SillyTavern = { characterId: 'verify-relation', name1: '测试玩家', name2: '林清' };
  window.Vue = Vue;
  window.z = zodModule;
  window.initializeGlobal = () => {};
  window.waitGlobalInitialized = () => Promise.resolve();
  window.eventOn = eventOn;
  window.errorCatched = fn => fn;
  window.triggerSlash = () => Promise.resolve('');
  window.Mvu = {
    events: { VARIABLE_INITIALIZED: 'mvu-init', VARIABLE_UPDATE_ENDED: 'mvu-ended' },
    getMvuData: () => ({ stat_data: state }),
    setMvuData: () => {
      calls.mvuWrite += 1;
    },
  };
  window.tavern_events = {
    MESSAGE_RECEIVED: 'message_received',
    MESSAGE_SENT: 'message_sent',
    MESSAGE_UPDATED: 'message_updated',
    MESSAGE_EDITED: 'message_edited',
    MESSAGE_DELETED: 'message_deleted',
    MESSAGE_SWIPED: 'message_swiped',
    CHAT_CHANGED: 'chat_changed',
    USER_MESSAGE_RENDERED: 'user_message_rendered',
    CHARACTER_MESSAGE_RENDERED: 'character_message_rendered',
    GENERATION_STARTED: 'generation_started',
    GENERATION_ENDED: 'generation_ended',
    GENERATION_STOPPED: 'generation_stopped',
  };
  window.$ = arg => {
    if (typeof arg === 'function') {
      arg();
      return window.$;
    }
    return { one() { return this; }, on() { return this; }, off() { return this; } };
  };
  window._ = { get: (object, key) => object?.[key], clamp: (value, lower, upper) => Math.min(Math.max(value, lower), upper) };
  doc.getElementById('send_but')?.addEventListener('click', () => {
    calls.nativeSend += 1;
  });

  const factory = new Function('window', 'document', 'globalThis', `with (window) { (function(){ ${source}\n})(); }`);
  factory(window, window.document, window);
  await wait();
  await wait();

  const root = doc.getElementById('yuri-front');
  click(window, doc.querySelector('.front-gate [data-action="enter"]'));
  await wait();
  click(window, doc.querySelector('.obs-handle'));

  return {
    window,
    doc,
    root,
    state,
    calls,
    errors,
    messages: () => messages,
    unchanged: () => JSON.stringify(state) === before,
    visibleTabs: () => [...doc.querySelectorAll('.obs-tab')].filter(tab => !tab.hidden).map(tab => tab.textContent),
    close() {
      window.dispatchEvent(new window.Event('pagehide'));
      dom.window.close();
    },
  };
}

async function scenarioWithoutRelation() {
  const view = await boot(baseState());
  const { window, doc } = view;

  check('无关系：页签只剩角色/地图/设置', view.visibleTabs().join('/') === '角色/地图/设置', view.visibleTabs().join('/'));
  const relationTab = doc.querySelector('.obs-tab[data-tab="relation"]');
  check('无关系：关系页签不进 DOM', relationTab === null);

  click(window, doc.querySelector('.obs-char-item[data-character="linqing"]'));
  check('无关系：角色详情没有私密区', !doc.querySelector('.obs-private'));
  check('无关系：角色详情没有关系动作', !doc.querySelector('.obs-rel-actions'));

  click(window, doc.querySelector('.obs-tab[data-tab="map"]'));
  click(window, doc.querySelector('.obs-tab[data-tab="settings"]'));
  click(window, doc.querySelector('.obs-tab[data-tab="character"]'));
  await wait();

  check('无关系：全程没有写回变量', view.unchanged(), '变量被改动');
  check('无关系：未调用 replaceVariables', view.calls.replaceVariables === 0, String(view.calls.replaceVariables));
  check('无关系：未调用 Mvu.setMvuData', view.calls.mvuWrite === 0, String(view.calls.mvuWrite));
  check('无关系：没有运行时异常', view.errors.length === 0, view.errors.join(' / '));
  view.close();
}

async function scenarioLedger() {
  const state = baseState();
  state.关系 = relationFixture();
  const view = await boot(state);
  const { window, doc } = view;

  check('有关系：关系页签出现', view.visibleTabs().join('/') === '角色/关系/地图/设置', view.visibleTabs().join('/'));
  click(window, doc.querySelector('.obs-tab[data-tab="relation"]'));
  const ledger = doc.querySelector('.obs-relation');
  check('有关系：账本渲染', Boolean(ledger));
  check('有关系：两位女主各一列', doc.querySelectorAll('.obs-rel-col').length === 2);

  const linqing = doc.querySelector('.obs-rel-col[data-character="linqing"]');
  const text = ledger?.textContent ?? '';
  check('账本顶部：公开圈显示玩家职业', text.includes('出版社编辑'));
  check('账本顶部：私下圈显示主特长与兴趣', text.includes('摄影') && text.includes('阅读') && text.includes('夜跑'));
  check('林清公开身份来自关系身份', linqing?.textContent?.includes('暧昧') === true);
  check('林清四根轴齐全', linqing?.querySelectorAll('.obs-meter').length === 4, String(linqing?.querySelectorAll('.obs-meter').length));
  const axisText = linqing?.querySelector('.obs-rel-meters')?.textContent ?? '';
  check('轴值按契约读入', ['私密', '72', '克制', '31', '失控', '66', '风险', '44'].every(part => axisText.includes(part)), axisText);
  check('知情圈列出知情人', linqing?.querySelector('.obs-rel-known-chip')?.textContent === '周姐');
  check('知情圈过滤「不知情」', !(linqing?.querySelector('.obs-rel-known')?.textContent ?? '').includes('苏玥'));
  check('痕迹按条目渲染', linqing?.querySelectorAll('.obs-rel-trace').length === 2, String(linqing?.querySelectorAll('.obs-rel-trace').length));
  check('痕迹带可见性', (linqing?.textContent ?? '').includes('苏玥可能看到'));
  check('修罗场按档位显示', linqing?.querySelector('.obs-rel-arena')?.textContent === '她在试探', linqing?.querySelector('.obs-rel-arena')?.textContent ?? '无');

  const suyue = doc.querySelector('.obs-rel-col[data-character="suyue"]');
  check('苏玥修罗场撞见', suyue?.querySelector('.obs-rel-arena')?.textContent === '已经被撞见');
  check('无痕迹时给出空状态', (suyue?.textContent ?? '').includes('还没有留下痕迹'));

  check('有关系：读账本不写回', view.unchanged(), '变量被改动');
  check('有关系：没有运行时异常', view.errors.length === 0, view.errors.join(' / '));
  view.close();
}

async function scenarioActions() {
  const state = baseState();
  state.关系 = relationFixture();
  const view = await boot(state);
  const { window, doc } = view;

  click(window, doc.querySelector('.obs-tab[data-tab="relation"]'));
  const input = () => doc.querySelector('.story-input');
  check('动作前输入框为空', (input()?.value ?? '') === '');

  click(window, doc.querySelector('.obs-rel-col[data-character="linqing"] .obs-rel-action[data-action="约她"]'));
  check('约她只填入带标记的句子', input()?.value === '【约她】我想约林清今晚在「月见河滨公园」见面。', input()?.value ?? '空');
  check('动作不发送', view.calls.nativeSend === 0, String(view.calls.nativeSend));
  check('动作不产生新楼层', view.messages().length === 2, String(view.messages().length));
  check('动作不写关系字段', view.unchanged(), '变量被改动');

  if (input()) input().value = '我先说点什么。';
  click(window, doc.querySelector('.obs-rel-col[data-character="linqing"] .obs-rel-action[data-action="去见她"]'));
  check('输入框非空时给出提示', (doc.querySelector('.story-status')?.textContent ?? '').includes('输入框已有内容'), doc.querySelector('.story-status')?.textContent ?? '空');
  check('输入框非空时不覆盖原文', input()?.value === '我先说点什么。', input()?.value ?? '空');
  check('输入框非空时不发送', view.calls.nativeSend === 0, String(view.calls.nativeSend));

  if (input()) input().value = '';
  click(window, doc.querySelector('.obs-rel-col[data-character="linqing"] .obs-rel-action[data-action="去见她"]'));
  check('去见她带上她的所在地', input()?.value === '【去见她】我想现在去铃兰公寓·客厅找林清。', input()?.value ?? '空');

  if (input()) input().value = '';
  click(window, doc.querySelector('.obs-tab[data-tab="character"]'));
  click(window, doc.querySelector('.obs-char-item[data-character="linqing"]'));
  const privateActions = doc.querySelectorAll('.obs-private .obs-rel-action');
  check('角色私密区带同一组动作', privateActions.length === 8, String(privateActions.length));
  click(window, doc.querySelector('.obs-private .obs-rel-action[data-action="公开"]'));
  check('私密区动作同样只填输入框', (input()?.value ?? '').startsWith('【公开】我想把我和林清的关系公开出去。'), input()?.value ?? '空');
  check('私密区动作不发送', view.calls.nativeSend === 0, String(view.calls.nativeSend));
  check('动作链路没有运行时异常', view.errors.length === 0, view.errors.join(' / '));
  view.close();
}

async function scenarioHundred() {
  const state = baseState();
  state.关系 = relationFixture();
  state.林清 = { ...state.林清, 亲近: 100, 心动: 100 };
  const view = await boot(state);
  const { window, doc } = view;

  click(window, doc.querySelector('.obs-char-item[data-character="linqing"]'));
  const bloom = doc.querySelector('.obs-character .obs-bloom');
  const name = doc.querySelector('.obs-bloom-name')?.textContent ?? '';
  check('关系 100：花期图仍在', Boolean(bloom) && Boolean(doc.querySelector('.obs-character .bloom-svg')));
  check('关系 100：档位夹到 3', bloom?.dataset.leaf === '3' && bloom?.dataset.bloom === '3', `${bloom?.dataset.leaf}/${bloom?.dataset.bloom}`);
  check('关系 100：花期名有值', Boolean(name) && name !== 'undefined' && name !== 'null', name);
  check('关系 100：星图与心跳仍在', Boolean(doc.querySelector('.obs-character .star-chart')) && Boolean(doc.querySelector('.obs-pulse')));
  check('关系 100：没有运行时异常', view.errors.length === 0, view.errors.join(' / '));
  view.close();
}

console.log('关系账本验证\n');
await scenarioWithoutRelation();
await scenarioLedger();
await scenarioActions();
await scenarioHundred();
notes.forEach(line => console.log(line));
if (failures.length) {
  console.log('\n失败项:');
  failures.forEach(line => console.log(line));
  process.exitCode = 1;
} else {
  console.log('\n结论: 无关系隐藏与零写回、账本渲染、动作只填输入框、关系 100 花期不崩，全部通过。');
}
