#!/usr/bin/env node
/**
 * 用 jsdom 把开局表单构建产物真跑一遍，断言：
 * - 兴趣多选：最多三项、自定义占一个名额、到上限后其余芯片禁用；
 * - 提交：写入酒馆变量 `_兴趣` 数组、生成玩家发言、写入世界书条目「user设定」
 *   （常量蓝灯 / 角色定义之后 / 顺序 25），既有条目走更新而非重建；
 * - 降级：未绑定世界书时警告提示但不阻断开局；
 * - 兼容：旧存档的字符串兴趣可以回填。
 * 这是无头近似验证：能抓住运行时异常、API 误用、写入 payload 与交互逻辑缺陷，
 * 但不能替代真机上的视觉与真实酒馆环境确认。
 */
import fs from 'node:fs';
import path from 'node:path';
import { JSDOM } from 'jsdom';
import lodash from 'lodash';
import * as zod from 'zod';

const here = import.meta.dirname;
const dist = path.join(here, 'dist/YuriOpening/界面/开局表单/index.html');
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
window.z = zod;
window._ = lodash;

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
const chip = text =>
  Array.from(doc().querySelectorAll('.interest-block .talent-chip')).find(node => node.textContent.trim() === text);
const countText = () => doc().querySelector('.interest-count')?.textContent ?? '';
const selectedChips = () =>
  Array.from(doc().querySelectorAll('.interest-block .talent-chip.selected')).map(node => node.textContent.trim());
const click = node => node?.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
const setInput = (node, value) => {
  node.value = value;
  node.dispatchEvent(new window.Event('input', { bubbles: true }));
};

async function submitForm(waitMs = 360) {
  doc().querySelector('form')?.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await wait(waitMs);
}

/** 无需校对页：当前谱系提交后直接锁定 */

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
  window.getVariables = () => ({ stat_data: structuredClone(scenario.state) });
  window.getCurrentMessageId = () => 0;
  window.updateVariablesWith = updater => {
    const variables = { stat_data: structuredClone(scenario.state) };
    const result = updater(variables);
    scenario.state = structuredClone(result.stat_data);
    scenario.calls.variables.push(structuredClone(result.stat_data));
    return result;
  };
  window.waitGlobalInitialized = () => Promise.resolve();
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
  window.createChatMessages = messages => {
    scenario.calls.messages.push(structuredClone(messages));
    return Promise.resolve([]);
  };
  window.triggerSlash = command => {
    scenario.calls.slash.push(command);
    return Promise.resolve('');
  };
  window.generateRaw = config => {
    scenario.calls.generate.push(structuredClone(config));
    if (scenario.generateFails) return Promise.reject(new Error('mock generate failure'));
    const n = scenario.calls.generate.length;
    return Promise.resolve(`${scenario.generateText ?? '窗边的光斜斜落在桌角。林清抬起头，话尾轻轻停住：“你……要不要一起？”'}#${n}`);
  };
  window.toastr = {
    success: (message, title) => scenario.calls.toasts.push({ type: 'success', message, title }),
    info: (message, title) => scenario.calls.toasts.push({ type: 'info', message, title }),
    warning: (message, title) => scenario.calls.toasts.push({ type: 'warning', message, title }),
    error: (message, title) => scenario.calls.toasts.push({ type: 'error', message, title }),
  };
  window.getCharWorldbookNames = () => structuredClone(scenario.bind);
  window.getWorldbook = async () => structuredClone(scenario.worldbook);
  window.createWorldbookEntries = async (name, entries) => {
    scenario.calls.worldbookCreate.push({ name, entries: structuredClone(entries) });
    const created = entries.map((entry, index) => ({ ...structuredClone(entry), uid: 900 + index }));
    scenario.worldbook.push(...created);
    return { worldbook: structuredClone(scenario.worldbook), new_entries: structuredClone(created) };
  };
  window.updateWorldbookWith = async (name, updater) => {
    const next = await updater(structuredClone(scenario.worldbook));
    scenario.calls.worldbookUpdate.push({ name, entries: structuredClone(next) });
    scenario.worldbook = structuredClone(next);
    return structuredClone(scenario.worldbook);
  };
}

const scenarios = [
  {
    name: '全新开局：三项兴趣 + 写入 user设定',
    bind: { primary: '百合花期', additional: [] },
    state: {},
    worldbook: [],
    async play(scenario) {
      const calls = scenario.calls;
      check('表单渲染', Boolean(doc().querySelector('.opening-shell')));

      setInput(doc().querySelector('input[placeholder="例如：林栖"]'), '林栖');
      await submitForm();
      await submitForm();
      await submitForm();
      check('到达第 4 步（兴趣所在步骤）', Boolean(doc().querySelector('.interest-block')));
      check('初始默认选中「阅读」', chip('阅读')?.classList.contains('selected') === true);
      check('计数显示 1/3', countText().includes('1/3'), countText());

      click(chip('音乐'));
      click(chip('旅行'));
      await tick();
      check('三项选择生效', selectedChips().join('、') === '阅读、音乐、旅行', selectedChips().join('、'));
      check('计数显示 3/3', countText().includes('3/3'), countText());
      const gameChip = chip('游戏');
      check('到上限后未选中芯片禁用', gameChip?.disabled === true);
      click(gameChip);
      await tick();
      check('点击禁用芯片不越界', selectedChips().length === 3, String(selectedChips().length));

      click(chip('旅行'));
      await tick();
      check('再次点击可取消', selectedChips().join('、') === '阅读、音乐', selectedChips().join('、'));
      click(chip('旅行'));
      await tick();
      check('取消后可以补回', selectedChips().join('、') === '阅读、音乐、旅行', selectedChips().join('、'));

      await submitForm();
      check('到达确认页', Boolean(doc().querySelector('.preview-content')));
      const note = doc().querySelector('.profile-write-note')?.textContent ?? '';
      check('确认页写明写入世界书', note.includes('user设定') && note.includes('自动补全'), note);
      const details = doc().querySelector('.profile-preview');
      check('档案预览默认收起', details?.open === false);
      const preview = details?.querySelector('pre')?.textContent ?? '';
      check('预览含基础信息标签', preview.includes('<林栖_基础信息>'), preview.slice(0, 80));
      check('预览含三兴趣', preview.includes('- 兴趣：阅读、音乐、旅行。'));
      check('未填自我呈现时按选项补全', preview.includes('林栖希望以清爽的样子被看见。'));
      check('生活落点取表单字段', preview.includes('- 现在的生活落点：专业/办公室。'));
      check('未填特征时不编造', preview.includes('- 穿衣：简约通勤。\n</林栖_基础信息>'));
      check(
        '未照抄林清档案字段',
        !preview.includes('所属世界与时代') && !preview.includes('长期生活区域') && !preview.includes('主要关系'),
        preview.slice(0, 80),
      );

      await submitForm(400);
      check('提交后直接锁定面板', Boolean(doc().querySelector('.locked-panel')));
      check('当前谱系没有校对页', !doc().querySelector('.proof-panel'));

      const statData = calls.variables.at(-1);
      check(
        '变量写入 _兴趣 为数组',
        JSON.stringify(statData?.玩家?._兴趣) === '["阅读","音乐","旅行"]',
        JSON.stringify(statData?.玩家?._兴趣),
      );
      check(
        '玩家发言作为首条消息落地',
        calls.messages.length === 1 &&
          calls.messages[0][0].role === 'user' &&
          calls.messages[0][0].message.includes('我叫林栖'),
        JSON.stringify(calls.messages[0] ?? null).slice(0, 140),
      );
      check('首条消息带情境氛围', calls.messages[0][0].message.includes('温和日常'));
      check('开场交给 /trigger 由主线生成', calls.slash.includes('/trigger'), JSON.stringify(calls.slash));
      check('未直接调用额外模型', calls.generate.length === 0, String(calls.generate.length));
      check('没有任何警告提示', calls.toasts.length === 0, JSON.stringify(calls.toasts));

      check('世界书未走更新路径', calls.worldbookUpdate.length === 0);
      const created = calls.worldbookCreate[0];
      check('写入角色卡绑定世界书', created?.name === '百合花期', created?.name);
      const entry = created?.entries?.[0];
      check('条目名为 user设定', entry?.name === 'user设定');
      check('蓝灯常驻', entry?.strategy?.type === 'constant');
      check('插入位置为角色定义之后', entry?.position?.type === 'after_character_definition');
      check('顺序 25', entry?.position?.order === 25, String(entry?.position?.order));
      check('概率 100', entry?.probability === 100);
      check(
        '正文与预览一致',
        typeof entry?.content === 'string' &&
          entry.content.includes('<林栖_基础信息>') &&
          entry.content.includes('- 兴趣：阅读、音乐、旅行。'),
      );
      check('回读后世界书仅一条', scenario.worldbook.length === 1 && scenario.worldbook[0]?.name === 'user设定');
    },
  },
  {
    name: '再次提交：更新既有条目 + 自定义兴趣',
    bind: { primary: '百合花期', additional: [] },
    state: { 玩家: { _兴趣: ['阅读', '影视', '游戏'] } },
    worldbook: [
      {
        uid: 42,
        name: 'user设定',
        enabled: true,
        content: '（旧档案）',
        probability: 100,
        strategy: { type: 'constant', keys: [], keys_secondary: { logic: 'and_any', keys: [] }, scan_depth: 'same_as_global' },
        position: { type: 'after_character_definition', role: 'system', depth: 0, order: 0 },
        recursion: { prevent_incoming: true, prevent_outgoing: true, delay_until: null },
        effect: { sticky: null, cooldown: null, delay: null },
      },
    ],
    async play(scenario) {
      const calls = scenario.calls;
      setInput(doc().querySelector('input[placeholder="例如：林栖"]'), '林栖');
      setInput(doc().querySelector('textarea'), '我想被看见得慢一点。');
      await submitForm();
      setInput(doc().querySelector('input[maxlength="80"]'), '左耳有一颗很小的痣');
      setInput(doc().querySelector('input[maxlength="60"]'), '品牌公司的初级策划');
      await submitForm();
      await submitForm();
      check('旧数组回填 3/3', countText().includes('3/3'), countText());
      check('旧数组回填选中项', selectedChips().join('、') === '阅读、影视、游戏', selectedChips().join('、'));
      check('满额时其他芯片禁用', chip('摄影')?.disabled === true);

      click(chip('阅读'));
      click(chip('影视'));
      click(chip('游戏'));
      await tick();
      check('全部取消后计数 0/3', countText().includes('0/3'), countText());
      await submitForm();
      check('空兴趣拦截提交', (doc().querySelector('.form-alert')?.textContent ?? '').includes('至少一项兴趣'));
      check('拦截后仍停在第 4 步', Boolean(doc().querySelector('.interest-block')));

      click(chip('自定义'));
      await tick();
      check('自定义占一个名额', countText().includes('1/3'), countText());
      await submitForm();
      check('自定义为空时拦截', (doc().querySelector('.form-alert')?.textContent ?? '').includes('自定义兴趣'));

      setInput(doc().querySelector('input[placeholder="例如：收集城市里的旧招牌"]'), '  收集城市里的旧招牌  ');
      await submitForm();
      check('到达确认页', Boolean(doc().querySelector('.preview-content')));
      const preview = doc().querySelector('.profile-preview pre')?.textContent ?? '';
      check('自我呈现逐字写入', preview.includes('我想被看见得慢一点。'));
      check('特征逐字写入', preview.includes('- 左耳有一颗很小的痣\n</林栖_基础信息>'));
      check('生活落点含具体职位', preview.includes('- 现在的生活落点：专业/办公室，品牌公司的初级策划。'));
      check('自定义兴趣写入', preview.includes('- 兴趣：收集城市里的旧招牌。'));

      await submitForm(400);
      check('提交后直接锁定', Boolean(doc().querySelector('.locked-panel')));
      check(
        '走更新而非重建',
        calls.worldbookUpdate.length === 1 && calls.worldbookCreate.length === 0,
        `update=${calls.worldbookUpdate.length} create=${calls.worldbookCreate.length}`,
      );
      const updated = calls.worldbookUpdate[0]?.entries?.[0];
      check('更新保留 uid', updated?.uid === 42, String(updated?.uid));
      check('更新后顺序 25', updated?.position?.order === 25);
      check('更新内容含自定义兴趣', (updated?.content ?? '').includes('收集城市里的旧招牌'));
      check('世界书仍只有一条', scenario.worldbook.length === 1);
      const statData = calls.variables.at(-1);
      check(
        '_兴趣 数组被整体覆盖',
        JSON.stringify(statData?.玩家?._兴趣) === '["收集城市里的旧招牌"]',
        JSON.stringify(statData?.玩家?._兴趣),
      );
      check('首条消息含自定义兴趣', (calls.messages[0]?.[0]?.message ?? '').includes('收集城市里的旧招牌'));
    },
  },
  {
    name: '未绑定世界书：警告但不阻断',
    bind: { primary: null, additional: [] },
    state: {},
    worldbook: [],
    async play(scenario) {
      const calls = scenario.calls;
      setInput(doc().querySelector('input[placeholder="例如：林栖"]'), '林栖');
      await submitForm();
      await submitForm();
      await submitForm();
      await submitForm();
      await submitForm(400);
      check('仍写入了首条消息', calls.messages.length === 1);
      check('更新流程继续（锁定面板）', Boolean(doc().querySelector('.locked-panel')));
      check(
        '给出写入失败警告',
        calls.toasts.some(t => t.type === 'warning' && t.message.includes('用户设定未能写入世界书') && t.message.includes('没有绑定世界书')),
        JSON.stringify(calls.toasts),
      );
      check('未触碰世界书接口', calls.worldbookCreate.length === 0 && calls.worldbookUpdate.length === 0);
    },
  },
  {
    name: '旧存档兼容：字符串兴趣回填',
    bind: { primary: '百合花期', additional: [] },
    state: { 玩家: { _姓名: '旧栖', _兴趣: '音乐' } },
    worldbook: [],
    async play() {
      check(
        '旧存档姓名回填',
        doc().querySelector('input[placeholder="例如：林栖"]')?.value === '旧栖',
        doc().querySelector('input[placeholder="例如：林栖"]')?.value,
      );
      await submitForm();
      await submitForm();
      await submitForm();
      check('旧字符串兴趣转为选中「音乐」', chip('音乐')?.classList.contains('selected') === true);
      check('计数 1/3', countText().includes('1/3'), countText());
    },
  },
];

let previous = null;
async function runScenario(scenario) {
  if (previous) {
    previous.pagehide.forEach(handler => handler());
    previous.pagehide.length = 0;
  }
  scenario.calls = { variables: [], messages: [], slash: [], toasts: [], worldbookCreate: [], worldbookUpdate: [], generate: [] };
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

// 开卷动效：进场 260ms / 离场 140ms，字段 24ms 错开（最多四个），减少动效清掉 delay
const motionFailures = failures.length;
check('开卷：进场 260ms', /page-enter-active[^{]*\{[^}]*260ms/.test(styleText), styleText.slice(0, 80));
check('开卷：离场 140ms', /page-leave-active[^{]*\{[^}]*140ms/.test(styleText));
check('开卷：进场用 clip-path', /page-enter-from[^{]*\{[^}]*clip-path/.test(styleText));
check('开卷：字段 24ms 错开（最多四个）', /page-enter-active[^{]*\*[^{]*\{[^}]*field-rise/.test(styleText) && styleText.includes('24ms') && styleText.includes('48ms') && styleText.includes('72ms'));
check('开卷：减少动效清掉 delay', /prefers-reduced-motion:\s*reduce[\s\S]{0,400}?animation-delay:\s*0s/.test(styleText));

console.log('开局表单产物无头验证\n');
console.log('【开卷动效（产物 CSS）】');
notes.forEach(line => console.log(line));
notes.length = 0;
if (failures.length === motionFailures) console.log('  全部通过');
console.log();

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
  console.log('结论: 所有断言通过，开局表单在 DOM 环境下可正常渲染、交互与提交。');
}
