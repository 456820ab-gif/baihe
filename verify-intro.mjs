#!/usr/bin/env node
/**
 * 用 jsdom 把「介绍页」构建产物真跑一遍（独立开场白），断言：
 * - 双环境检测：酒馆助手 / 提示词模板的绿灯红灯与重新检测；
 * - 两个 Discord 跳转链接、四步引导、划动提示齐备；
 * - 清理旧微信记录：两段式确认、本地记录清空、保留接口配置、
 *   世界书「微信记录」清空停用；
 * - 开新档自动清「user设定」（未提交态才动手；已提交档不误清）；
 * - 「开始创建角色」通过 /swipe 切到下一个开场白；未装助手时落回手动滑动。
 * 这是无头近似验证：能抓住运行时异常、API 误用与交互逻辑缺陷，
 * 但不能替代真机上的视觉与真实酒馆环境确认。
 */
import fs from 'node:fs';
import path from 'node:path';
import { JSDOM } from 'jsdom';

const here = import.meta.dirname;
const dist = path.join(here, 'dist/YuriOpening/界面/介绍页/index.html');
const built = fs.readFileSync(dist, 'utf8');

const scriptMatch = built.match(/<script type="module">([\s\S]*?)<\/script>/);
const styleText = [...built.matchAll(/<style>([\s\S]*?)<\/style>/g)].map(match => match[1]).join('\n');
const bodyHtml = built.match(/<body>([\s\S]*?)<\/body>/)?.[1] ?? '<div id="app"></div>';
if (!scriptMatch) throw new Error('未找到内联 module 脚本');

// Vue 在模块加载时就捕获 document，因此先把 jsdom 的 DOM 装进 Node 全局，再动态导入 Vue。
const dom = new JSDOM(`<!DOCTYPE html><html><head><style>${styleText}</style></head><body>${bodyHtml}</body></html>`, {
  runScripts: 'outside-only',
  pretendToBeVisual: true,
  url: 'https://local.test/',
});
const { window } = dom;
try {
  window.scrollTo = () => {};
} catch {
  // jsdom 的 scrollTo 未实现，覆盖失败也不影响断言
}

globalThis.window = window;
globalThis.document = window.document;
globalThis.requestAnimationFrame = window.requestAnimationFrame.bind(window);
globalThis.cancelAnimationFrame = window.cancelAnimationFrame.bind(window);
for (const name of ['Element', 'SVGElement', 'HTMLElement', 'Node']) {
  globalThis[name] = window[name];
}

const Vue = await import('vue');
window.Vue = Vue;

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const tick = () => wait(25);
const errors = [];
window.addEventListener('error', event => errors.push(String(event.error ?? event.message)));

const failures = [];
const notes = [];
function check(label, condition, detail = '') {
  if (condition) notes.push(`  ✓ ${label}`);
  else failures.push(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`);
}

const doc = () => window.document;
const click = node => node?.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
const cards = () => [...doc().querySelectorAll('.check-card')];

function installStubs(scenario) {
  const pagehide = [];
  scenario.pagehide = pagehide;

  window.$ = arg => {
    if (typeof arg === 'function') {
      arg();
      return window.$;
    }
    return {
      one(event, handler) {
        pagehide.push(handler);
        return this;
      },
      on() {
        return this;
      },
      off() {
        return this;
      },
    };
  };
  window.errorCatched = fn => () => {
    try {
      const result = fn();
      if (result && typeof result.catch === 'function') {
        result.catch(error => errors.push(String(error)));
      }
      return result;
    } catch (error) {
      errors.push(String(error));
    }
  };
  if (scenario.stubSlash === false) {
    delete window.triggerSlash;
  } else {
    window.triggerSlash = command => {
      scenario.calls.slash.push(command);
      return Promise.resolve('');
    };
  }
  if (scenario.worldbook) {
    window.getCharWorldbookNames = () => structuredClone(scenario.bind);
    window.getWorldbook = async () => structuredClone(scenario.worldbook);
    window.updateWorldbookWith = async (name, updater) => {
      const next = await updater(structuredClone(scenario.worldbook));
      scenario.calls.worldbookUpdate.push({ name, entries: structuredClone(next) });
      scenario.worldbook = structuredClone(next);
      return structuredClone(scenario.worldbook);
    };
  } else {
    delete window.getCharWorldbookNames;
    delete window.getWorldbook;
    delete window.updateWorldbookWith;
  }
  // MVU 状态：场景给了就用（未给＝未提交档）；新档自动清「user设定」靠它判断
  window.getVariables = () => ({ stat_data: structuredClone(scenario.statData ?? {}) });
  // 每个场景从干净的宿主信号开始，红灯/绿灯由场景自己补
  delete window.SillyTavern;
}

const scenarios = [
  {
    name: '介绍页：链接、环境检测、清理旧记录与进入表单',
    bind: { primary: '百合花期', additional: [] },
    worldbook: [
      { name: '微信记录', enabled: true, content: '旧存档的聊天记录', uid: 7 },
      { name: 'user设定', enabled: true, content: '上一档的玩家档案', uid: 8 },
    ],
    statData: { 开场: { $已提交: false } },
    async play(scenario) {
      const calls = scenario.calls;
      check('介绍页渲染', Boolean(doc().querySelector('.intro-shell')));
  check('动效：补上了 prefers-reduced-motion', /prefers-reduced-motion:\s*reduce/.test(styleText));
  check('动效：危险确认不再无限 breathe', !/cleanup-button\.is-confirm[^}]*breathe/.test(styleText));
  check('动效：按钮与链接卡按压只落 1px', /link-card[^{]*:active[^{]*\{[^}]*translateY\(1px\)/.test(styleText) && /primary-button[^{]*:active[^{]*\{[^}]*translateY\(1px\)/.test(styleText));

      // 开新档：上一档遗留的「user设定」应被自动清空停用
      const resetEntry = calls.worldbookUpdate
        .flatMap(call => call.entries ?? [])
        .find(entry => entry.name === 'user设定');
      check('新档自动清空停用「user设定」', resetEntry?.content === '' && resetEntry?.enabled === false, JSON.stringify(resetEntry ?? null));

      const links = [...doc().querySelectorAll('.link-card')];
      check('两个跳转链接都在', links.length === 2, String(links.length));
      check('社区链接指向 discord.gg/bxglyj', links[0]?.getAttribute('href') === 'https://discord.gg/bxglyj', links[0]?.getAttribute('href') ?? '无');
      check(
        '帖子链接指向频道链接',
        links[1]?.getAttribute('href') === 'https://discord.com/channels/1380075940285124724/1558070474104377364',
        links[1]?.getAttribute('href') ?? '无',
      );
      check('链接新窗口打开', links.every(link => link.getAttribute('target') === '_blank'));

      check('四步引导齐备', doc().querySelectorAll('.guide-list li').length === 4);
      check('有划动切换提示', (doc().querySelector('.swipe-hint')?.textContent ?? '').includes('滑动'));

      check('两行环境检测', cards().length === 2, String(cards().length));
      check('助手信号在时亮绿灯', cards()[0]?.classList.contains('is-ok') === true);
      check('提示词模板缺失时亮红灯', cards()[1]?.classList.contains('is-missing') === true);
      check('红灯文案提示安装', (cards()[1]?.textContent ?? '').includes('未安装'));

      // 补齐两个扩展的宿主信号后重新检测 → 双绿灯
      window.SillyTavern = {
        getContext: () => ({
          extensions: [
            { name: 'JS-Slash-Runner', display_name: '酒馆助手' },
            { name: 'ST-Prompt-Template', display_name: 'Prompt Template/提示词模板' },
          ],
        }),
      };
      click(doc().querySelector('.mini-button'));
      await tick();
      check('补上扩展后双绿灯', cards().every(card => card.classList.contains('is-ok')));
      check('绿灯文案确认已安装', (cards()[0]?.textContent ?? '').includes('已安装'));

      // 清理按钮：两段式确认 + 本地记录清空 + 世界书条目清空停用
      window.localStorage.setItem('YuriOpening:phone:old-chat:chat-history:v1', '[]');
      window.localStorage.setItem('YuriOpening:phone:ai-config:v1', '{"baseUrl":"x"}');
      const cleanup = doc().querySelector('.cleanup-button');
      check('有清理按钮', Boolean(cleanup));
      const writesBeforeCleanup = calls.worldbookUpdate.length;
      click(cleanup);
      await tick();
      check('第一次点击进入确认态', cleanup?.classList.contains('is-confirm') === true);
      check('确认前不再写入世界书', calls.worldbookUpdate.length === writesBeforeCleanup, String(calls.worldbookUpdate.length));
      click(cleanup);
      await wait(120);
      check('第二次点击后才执行世界书更新', calls.worldbookUpdate.length === writesBeforeCleanup + 1, String(calls.worldbookUpdate.length));
      const clearedCall = calls.worldbookUpdate.find(call =>
        call.entries?.some(entry => entry.name === '微信记录' && entry.content === '' && entry.enabled === false),
      );
      check('微信记录被清空并停用', Boolean(clearedCall), JSON.stringify(calls.worldbookUpdate.at(-1)?.entries ?? null));
      check('旧存档本地记录被清掉', window.localStorage.getItem('YuriOpening:phone:old-chat:chat-history:v1') === null);
      check('接口配置被保留', window.localStorage.getItem('YuriOpening:phone:ai-config:v1') !== null);
      check('清理结果有反馈', (doc().querySelector('.cleanup-status')?.textContent ?? '').includes('清理完成'));

      // 进入下一个开场白：/swipe 切换
      const start = doc().querySelector('.intro-start');
      check('有「开始创建角色」按钮', Boolean(start));
      click(start);
      await tick();
      check('点按钮触发 /swipe 切换开场白', calls.slash.includes('/swipe'), JSON.stringify(calls.slash));
      check('等待进入时按钮置灰', start?.hasAttribute('disabled') === true && (start?.textContent ?? '').includes('正在进入'));
    },
  },
  {
    name: '未装任何扩展：双红灯与手动滑动兜底',
    bind: { primary: '百合花期', additional: [] },
    stubSlash: false,
    async play(scenario) {
      const calls = scenario.calls;
      check('助手缺失亮红灯', cards()[0]?.classList.contains('is-missing') === true);
      check('模板缺失亮红灯', cards()[1]?.classList.contains('is-missing') === true);

      // 未装助手时清理按钮不炸，如实反馈跳过世界书
      window.localStorage.setItem('YuriOpening:phone:old-chat:chat-history:v1', '[]');
      const cleanup = doc().querySelector('.cleanup-button');
      click(cleanup);
      await tick();
      click(cleanup);
      await wait(120);
      const status = doc().querySelector('.cleanup-status')?.textContent ?? '';
      check('清理给出未装助手的反馈', status.includes('未检测到酒馆助手'), status);
      check('本地记录仍然清掉', window.localStorage.getItem('YuriOpening:phone:old-chat:chat-history:v1') === null);

      // 没有 /swipe 时按钮恢复可点，提示手动滑动
      const start = doc().querySelector('.intro-start');
      click(start);
      await wait(60);
      check('无 /swipe 时不发起切换命令', calls.slash.length === 0, JSON.stringify(calls.slash));
      check('按钮恢复可点', start?.hasAttribute('disabled') === false);
      check('划动提示仍在', Boolean(doc().querySelector('.swipe-hint')));
    },
  },
  {
    name: '已提交的存档：不误清「user设定」',
    bind: { primary: '百合花期', additional: [] },
    worldbook: [{ name: 'user设定', enabled: true, content: '本档已提交的玩家档案', uid: 9 }],
    statData: { 开场: { $已提交: true } },
    async play(scenario) {
      const calls = scenario.calls;
      const touched = calls.worldbookUpdate.some(call =>
        call.entries.some(entry => entry.name === 'user设定' && (entry.content === '' || entry.enabled === false)),
      );
      check('已提交档不误清「user设定」', !touched, JSON.stringify(calls.worldbookUpdate));
      check('介绍页仍正常渲染', Boolean(doc().querySelector('.intro-shell')));
    },
  },
];

let previous = null;
async function runScenario(scenario) {
  if (previous) {
    previous.pagehide.forEach(handler => handler());
    previous.pagehide.length = 0;
  }
  scenario.calls = { slash: [], worldbookUpdate: [] };
  installStubs(scenario);
  const container = window.document.querySelector('#app');
  container.innerHTML = '';
  const factory = new Function(
    'window',
    'document',
    'globalThis',
    `with (window) { (function(){ ${scriptMatch[1]}\n})(); }`,
  );
  factory(window, window.document, window);
  await wait(120);
  await scenario.play(scenario);
  previous = scenario;
}

console.log('介绍页产物无头验证\n');
for (const scenario of scenarios) {
  console.log(`【${scenario.name}】`);
  const before = failures.length;
  await runScenario(scenario);
  notes.forEach(line => console.log(line));
  notes.length = 0;
  if (failures.length === before) console.log('  全部通过');
  console.log();
}

if (errors.length) failures.push(...errors.map(error => `  ✗ 运行时异常: ${error}`));

if (failures.length) {
  console.log('失败项:');
  failures.forEach(line => console.log(line));
  process.exitCode = 1;
} else {
  console.log('结论: 所有断言通过，介绍页在 DOM 环境下可正常渲染、检测与清理。');
}
