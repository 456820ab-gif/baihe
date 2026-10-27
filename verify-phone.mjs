#!/usr/bin/env node
/**
 * 用 jsdom 把手机构建产物真跑一遍。
 *
 * 两件事：
 *   1. 结构断言 —— 四个页签、聊天列表、对话页、表情面板、通讯录搜索、朋友圈、设置页
 *      是否按预期渲染出 DOM，以及有无运行时异常。
 *   2. 类名覆盖审查 —— 产物 JS 里出现的每个 wc- / phone- 类名，是否都能在产物
 *      CSS 里找到规则。美化重写 style.scss 时最容易出的错就是漏掉某个选择器，
 *      导致元素裸奔，这条断言专门盯它。
 *
 * 这是无头近似验证：抓得住结构缺失、空指针、API 误用与漏样式，
 * 但替代不了真机上的视觉确认。
 */
import fs from 'node:fs';
import path from 'node:path';
import { JSDOM } from 'jsdom';

const here = import.meta.dirname;
const dist = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(here, 'dist/YuriOpening/界面/手机/index.html');
const built = fs.readFileSync(dist, 'utf8');

const scriptMatch = built.match(/<script type="module">([\s\S]*?)<\/script>/);
if (!scriptMatch) throw new Error('未找到内联 module 脚本');

// 手机入口导出 mountPhone，产物是 <script type="module">；jsdom 的 eval 只能跑经典脚本，
// 验证时去掉末尾的导出语句（嵌入用例走 window.__YURI_PHONE_MOUNT__ 钩子）。
const scriptBody = scriptMatch[1].replace(/export\s*\{[^}]*\}\s*;?/g, '');

const CHAT_ID = 'verify';
const PKEY = 'YuriOpening:phone:' + CHAT_ID + ':';

const scenarios = {
  未加好友: {
    mvu: {
      玩家: { _姓名: '林栖' },
      林清: { 关系身份: '初识', 亲近: 8, 心动: 4, 心情: '平静' },
      微信: { _已添加林清: false, _未读数: 0, _朋友圈: [] },
      环境: { 日期: '2025-04-03', 时间: '16:10' },
    },
    history: [],
  },
  空会话: {
    mvu: {
      玩家: { _姓名: '林栖' },
      林清: { 关系身份: '熟人', 亲近: 22, 心动: 12, 心情: '平静' },
      微信: { _已添加林清: true, _未读数: 1, _朋友圈: [] },
      环境: { 日期: '2025-05-02', 时间: '20:15' },
    },
    history: [],
  },
  日常聊天: {
    mvu: {
      玩家: { _姓名: '林栖' },
      林清: { 关系身份: '朋友', 亲近: 58, 心动: 34, 心情: '愉快' },
      微信: {
        _已添加林清: true,
        _未读数: 0,
        _林清已知事件: '一起在昙夜酒吧躲雨',
        _聊天摘要历史: ['她问你周末有没有空。'],
        _朋友圈: [],
      },
      环境: { 日期: '2025-05-16', 时间: '19:40' },
    },
    history: [
      { role: 'assistant', content: '下班了？', date: '2025-05-16', time: '19:40' },
      { role: 'user', content: '刚出电梯，今天会开到七点半', date: '2025-05-16', time: '19:42' },
      { role: 'assistant', content: '谁让你不早退。我六点就跑了', date: '2025-05-16', time: '19:42' },
      {
        role: 'assistant', content: '刚才那段时间，我还想再留一点。汀兰公寓·卧室的事，先只给你看。',
        date: '2025-05-16', time: '19:46', kind: 'photo',
        photoId: 'linqing', photoEventId: 'verify-linqing-photo', photoScene: '汀兰公寓·卧室', photoVariant: 'bedroom',
      },
    ],
  },
  正文已加微信: {
    mvu: {
      玩家: { _姓名: '林栖' },
      // 关系还停在初识，但正文里真的加上了微信——手机应该直接同步
      林清: { 关系身份: '初识', 亲近: 20, 心动: 10, 心情: '平静' },
      微信: { _已添加林清: true, _未读数: 1, _朋友圈: [] },
      环境: { 日期: '2025-04-10', 时间: '21:05' },
    },
    history: [
      { role: 'assistant', content: '是我。别在电梯里喊我林总。', date: '2025-04-10', time: '21:05' },
    ],
  },
  预置拒绝态: {
    mvu: {
      玩家: { _姓名: '林栖' },
      林清: { 关系身份: '初识', 亲近: 12, 心动: 6, 心情: '平静' },
      微信: { _已添加林清: false, _未读数: 0, _朋友圈: [] },
      环境: { 日期: '2025-04-08', 时间: '18:30' },
    },
    history: [],
    // 上次被拒过：重开会话应该直接看到拒绝态，而不是重新可点
    seedRejected: true,
  },
  长消息与表情: {
    mvu: {
      玩家: { _姓名: '林栖' },
      林清: { 关系身份: '暧昧', 亲近: 76, 心动: 68, 心情: '心动' },
      微信: {
        _已添加林清: true,
        _未读数: 3,
        _林清已知事件: '你把伞落在了她车上',
        _聊天摘要历史: ['她假装随口问起你周末的安排。'],
        _朋友圈: [
          { 内容: '今天路过一家老书店。', 时间: '2025-05-14', 心情: '平静', 点赞数: 2 },
          { 内容: '雨太大，索性不走了。', 时间: '2025-05-16', 心情: '心动', 点赞数: 7 },
        ],
      },
      环境: { 日期: '2025-05-17', 时间: '22:40' },
    },
    history: [
      { role: 'assistant', content: '😏', date: '2025-05-17', time: '22:38' },
      { role: 'user', content: '？', date: '2025-05-17', time: '22:38' },
      {
        role: 'assistant',
        content: '没什么。就是想起来今天在会议室，你被总经理点名的时候，那个表情——我差点没绷住。下次记得提前把材料翻两遍。',
        date: '2025-05-17', time: '22:39',
      },
      { role: 'assistant', content: '(￣▽￣)', date: '2025-05-17', time: '22:40' },
    ],
  },
};

const failures = [];
const notes = [];
function check(label, condition, detail = '') {
  if (condition) notes.push(`  ✓ ${label}`);
  else failures.push(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`);
}

/** 把产物脚本装进一个 jsdom 环境，返回 { window, errors } */
function boot(scenarioName) {
  const scenario = scenarios[scenarioName];
  const dom = new JSDOM(
    `<!DOCTYPE html><html><head></head><body><div id="phone-root"></div></body></html>`,
    { runScripts: 'outside-only', pretendToBeVisual: true, url: 'https://local.test/' },
  );
  const { window } = dom;
  const errors = [];
  window.addEventListener('error', e => errors.push(String(e.error ?? e.message)));

  window.SillyTavern = { getCurrentChatId: () => CHAT_ID, name1: '林栖', getContext: () => ({ name1: '林栖' }) };
  window.localStorage.clear();
  window.localStorage.setItem('YuriOpening:phone:ai-config:v1', JSON.stringify({
    baseUrl: '', apiKey: '', model: 'gpt-4o-mini', systemPromptPrefix: '',
  }));
  if (scenario.history.length) {
    window.localStorage.setItem(PKEY + 'chat-history:v1', JSON.stringify(scenario.history));
  }
  if (scenario.seedRejected) {
    window.localStorage.setItem(PKEY + 'addRejected:v1', 'true');
  }
  window.waitGlobalInitialized = () => Promise.resolve();
  window.errorCatched = fn => () => {
    try {
      const result = fn();
      if (result && typeof result.catch === 'function') result.catch(e => errors.push(String(e)));
      return result;
    } catch (e) {
      errors.push(String(e));
    }
  };
  window.eventOn = () => ({ stop() {} });
  window.tavern_events = { CHAT_CHANGED: 'chat_changed' };
  window.$ = arg => {
    if (typeof arg === 'function') { arg(); return window.$; }
    return { one() { return this; }, on() { return this; }, off() { return this; } };
  };
  // MVU：读写同一份内存数据
  window.Mvu = {
    events: { VARIABLE_INITIALIZED: 'mvu_init', VARIABLE_UPDATE_ENDED: 'mvu_ended' },
    getMvuData: () => ({ stat_data: scenario.mvu }),
    replaceMvuData: data => { scenario.mvu = data.stat_data; return Promise.resolve(); },
  };
  // 世界书接口不提供：wechat-log 会走「不支持则跳过」的分支
  window.eval(scriptBody);
  return { window, dom, errors, scenario };
}

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const q = (win, sel) => win.document.querySelector(sel);
const qa = (win, sel) => Array.from(win.document.querySelectorAll(sel));
const text = (win, sel) => (q(win, sel)?.textContent ?? '').trim();

function click(node) {
  if (!node) return false;
  node.dispatchEvent(new node.ownerDocument.defaultView.MouseEvent('click', { bubbles: true }));
  return true;
}

/** 搜索输入：被拒后会整页重渲，旧引用会脱离文档，故每次实时选取 */
function typeSearch(win, value) {
  const input = win.document.querySelector('.wc-search-input');
  if (!input) return false;
  input.value = value;
  input.dispatchEvent(new win.Event('input', { bubbles: true }));
  return true;
}

// ────────────────────────────────────────────────────────────────────────────
// 类名覆盖审查
// ────────────────────────────────────────────────────────────────────────────

console.log('手机产物验证\n');
console.log('【类名覆盖审查】');

// 宽松扫描：类名在产物里大多以模板串拼成（`wc-msg-row wc-msg-${out}`），
// 按引号切分只能拿到一部分，所以直接扫全部 wc-/phone- 前缀的 token。
// 排除项：容器 id、页面事件名，以及 dev 构建里 eval 包装带出的模块路径（./phone-icons）。
const PREFIX_TOKENS = new Set(['phone-root-host', 'phone-root-style', 'wc-dispose', 'phone-icons']);
const usedClasses = new Set();
for (const m of scriptBody.matchAll(/\b((?:wc|phone)-[a-z0-9-]+)/g)) {
  if (!PREFIX_TOKENS.has(m[1])) usedClasses.add(m[1]);
}

console.log(`  产物 JS 出现的类名 ${usedClasses.size} 个`);

// 收集每个场景里运行时注入的 CSS（手机的样式不在 <style> 标签里，
// 而是产物用 styleEl.textContent 注入，必须从 DOM 读）
const styleSamples = [];

// ────────────────────────────────────────────────────────────────────────────
// 各场景逐个跑
// ────────────────────────────────────────────────────────────────────────────

for (const name of Object.keys(scenarios)) {
  const { window, dom, errors } = boot(name);
  await wait(150);
  console.log(`\n【${name}】`);
  const before = failures.length;

  check('无运行时异常', errors.length === 0, errors.slice(0, 2).join(' | '));
  check('注入主容器', Boolean(q(window, '#phone-root-host')));
  check('注入样式', Boolean(q(window, '#phone-root-style')));
  check('悬浮按钮存在', Boolean(q(window, '.phone-fab')));
  check('手机外壳初始隐藏', q(window, '.phone-shell')?.classList.contains('is-open') === false);

  // 点悬浮按钮打开
  click(q(window, '.phone-fab'));
  await wait(120);
  check('点击后外壳展开', q(window, '.phone-shell')?.classList.contains('is-open') === true);
  check('状态栏在', Boolean(q(window, '.phone-status-bar')));
  check('四个页签', qa(window, '.phone-tab').length === 4, String(qa(window, '.phone-tab').length));

  // 小窗 / 全屏切换
  check('模式切换键存在', Boolean(q(window, '.phone-mode-btn')));
  check('默认全屏（无 is-mini）', q(window, '.phone-shell')?.classList.contains('is-mini') === false);
  check('全屏下提示切小窗', q(window, '.phone-mode-btn')?.getAttribute('aria-label') === '切换到小窗');
  click(q(window, '.phone-mode-btn'));
  await wait(60);
  check('点击后进入小窗', q(window, '.phone-shell')?.classList.contains('is-mini') === true);
  check('小窗收窄到 255px', q(window, '.phone-shell')?.style.width === '255px', q(window, '.phone-shell')?.style.width);
  check('小窗模式被记住', window.localStorage.getItem('YuriOpening:phone:shell-mode:v1') === 'mini');
  check('小窗下提示切全屏', q(window, '.phone-mode-btn')?.getAttribute('aria-label') === '切换到全屏');

  // 拖动：按住顶部状态栏（jsdom 无布局，getBoundingClientRect 全 0，位移即目标坐标）
  const shellEl = q(window, '.phone-shell');
  const barEl = q(window, '.phone-status-bar');
  barEl.setPointerCapture = () => {};
  barEl.releasePointerCapture = () => {};
  barEl.dispatchEvent(new window.PointerEvent('pointerdown', { bubbles: true, clientX: 200, clientY: 120, pointerId: 7, button: 0 }));
  barEl.dispatchEvent(new window.PointerEvent('pointermove', { bubbles: true, clientX: 260, clientY: 180, pointerId: 7 }));
  barEl.dispatchEvent(new window.PointerEvent('pointerup', { bubbles: true, clientX: 260, clientY: 180, pointerId: 7 }));
  check('小窗拖动写入新位置', shellEl?.style.left === '60px' && shellEl?.style.top === '60px', `${shellEl?.style.left}/${shellEl?.style.top}`);
  check('拖动结束清除拖动标记', shellEl?.classList.contains('is-dragging') === false);
  const savedPos = (() => { try { return JSON.parse(window.localStorage.getItem('YuriOpening:phone:shell-pos:v1') ?? 'null'); } catch { return null; } })();
  check('拖动位置已持久化', savedPos?.left === 60 && savedPos?.top === 60, JSON.stringify(savedPos));

  click(q(window, '.phone-mode-btn'));
  await wait(60);
  check('再点回全屏', q(window, '.phone-shell')?.classList.contains('is-mini') === false);
  check('全屏写回满宽', q(window, '.phone-shell')?.style.width === '100%');
  check('全屏清掉小窗定位', q(window, '.phone-shell')?.style.left === '', q(window, '.phone-shell')?.style.left);
  check('切回全屏后状态被更新', window.localStorage.getItem('YuriOpening:phone:shell-mode:v1') === 'full');

  // 聊天列表
  const hasAdded = scenarios[name].mvu.微信._已添加林清;
  if (!hasAdded) {
    check('未加好友时显示空态', Boolean(q(window, '.wc-empty')));
  } else {
    check('聊天列表出现会话项', Boolean(q(window, '.wc-chat-item')));
    const previewText = text(window, '.wc-item-preview');
    const expected = scenarios[name].history.length
      ? scenarios[name].history[scenarios[name].history.length - 1].content
      : '点击开始聊天 ♡';
    check('会话预览取最后一条记录', previewText.includes(expected.slice(0, 8)), previewText);
  }

  // 进对话页
  if (hasAdded) {
    click(q(window, '.wc-chat-item'));
    await wait(120);
    check('进入对话页', Boolean(q(window, '.wc-chatpage')));
    check('顶栏标题为林清', text(window, '.wc-chat-title') === '林清', text(window, '.wc-chat-title'));
    check('副标题含关系', text(window, '.wc-chat-subtitle').includes(scenarios[name].mvu.林清.关系身份));

    if (scenarios[name].history.length > 0) {
      const bubbles = qa(window, '.wc-bubble').filter(b => !b.classList.contains('is-streaming'));
      check(
        '气泡数量与记录一致',
        bubbles.length === scenarios[name].history.length,
        `${bubbles.length} vs ${scenarios[name].history.length}`,
      );
      const outCount = qa(window, '.wc-msg-row.wc-msg-out').length;
      const inCount = qa(window, '.wc-msg-row.wc-msg-in').length;
      const userCount = scenarios[name].history.filter(m => m.role === 'user').length;
      check('我方气泡数正确', outCount === userCount, `${outCount} vs ${userCount}`);
      check('对方气泡带头像', inCount > 0 && qa(window, '.wc-bubble-avatar').length === inCount);
      const photoCount = scenarios[name].history.filter(m => m.kind === 'photo').length;
      if (photoCount > 0) {
        const photoImages = qa(window, '.wc-photo-image');
      }
    } else {
      // 空会话下产物会自动发起一次打招呼流式请求；没有 AI 接口时请求失败，
      // 但气泡与头像已在失败前挂上，所以只断言结构存在。
      check('空会话给出打招呼气泡', qa(window, '.wc-msg-row.wc-msg-in').length >= 1);
      check('打招呼气泡带头像', qa(window, '.wc-bubble-avatar').length >= 1);
    }
    check('时间分割条存在', qa(window, '.wc-time-divider').length >= 1, String(qa(window, '.wc-time-divider').length));

    const emojiOnly = scenarios[name].history.filter(m =>
      /^(?:\p{Extended_Pictographic}|\u200d|\uFE0F|\s)+$/u.test(m.content.trim()) ||
      /[（(][^（）()]{1,18}[）)]/.test(m.content.trim()),
    ).length;
    if (emojiOnly > 0) {
      check('纯表情消息被放大标记', qa(window, '.wc-bubble.is-emoji').length === emojiOnly,
        `${qa(window, '.wc-bubble.is-emoji').length} vs ${emojiOnly}`);
    }

    // 表情面板
    check('表情面板默认收起', q(window, '.wc-emoji-panel')?.classList.contains('is-open') === false);
    click(q(window, '.wc-emoji-btn'));
    await wait(80);
    check('点表情按钮后面板展开', q(window, '.wc-emoji-panel')?.classList.contains('is-open') === true);
    check('表情模式两个按钮', qa(window, '.wc-emoji-mode').length === 2);
    check('表情格子非空', qa(window, '.wc-emoji-item').length > 20, String(qa(window, '.wc-emoji-item').length));
    const kaoTab = qa(window, '.wc-emoji-mode')[1];
    click(kaoTab);
    await wait(60);
    check('切颜文字后网格加 is-kaomoji', q(window, '.wc-emoji-grid')?.classList.contains('is-kaomoji') === true);
    check('颜文字格子非空', qa(window, '.wc-emoji-item').length > 5, String(qa(window, '.wc-emoji-item').length));
    // 点一个表情插到输入框（先取文本再点击，因为 re-render 会让旧引用脱离文档）
    const firstItem = q(window, '.wc-emoji-item');
    const itemText = firstItem?.textContent ?? '';
    click(firstItem);
    await wait(60);
    const inputValue = q(window, '.wc-input')?.value ?? '';
    check(
      '点表情后写入输入框',
      itemText.length > 0 && inputValue.includes(itemText),
      `${JSON.stringify(itemText)} → ${JSON.stringify(inputValue)}`,
    );

    // 输入框与发送键
    check('输入框在', Boolean(q(window, '.wc-input')));
    check('发送键在', Boolean(q(window, '.wc-send-btn')));

    // 返回
    click(q(window, '.wc-icon-btn'));
    await wait(120);
    check('返回聊天列表', Boolean(q(window, '.wc-chatlist')));
  }

  // 通讯录页
  click(qa(window, '.phone-tab')[1]);
  await wait(100);
  check('切到通讯录页', Boolean(q(window, '.wc-contacts')));
  check('搜索框在', Boolean(q(window, '.wc-search-input')));
  // 搜索输入框：被拒重渲后旧引用会脱离文档，故统一用实时选取
  typeSearch(window, '林清');
  await wait(80);
  check('搜索林清命中卡片', Boolean(q(window, '.wc-search-card')));
  if (hasAdded) {
    check('已添加时显示已添加标记', Boolean(q(window, '.wc-badge-added')));
  } else if (scenarios[name].seedRejected) {
    // 上次被拒过且关系仍未到位：重开会话应直接是拒绝态
    check('拒绝状态跨会话保留', q(window, '.wc-add-btn')?.classList.contains('is-rejected') === true,
      String(q(window, '.wc-add-btn')?.textContent ?? '无按钮'));
    check('保留拒绝态时按钮不可点', q(window, '.wc-add-btn')?.disabled === true);
  } else if (['熟人', '朋友', '挚友', '暧昧', '恋人'].includes(scenarios[name].mvu.林清.关系身份)) {
    check('关系足够时给出可点的添加按钮',
      q(window, '.wc-add-btn')?.disabled === false &&
      q(window, '.wc-add-btn')?.classList.contains('is-rejected') === false);
  } else {
    // 关系不到位也能点申请——她会当真拒绝，而不是界面上一开始就不让点
    check('关系不足时仍给出可点的添加按钮', q(window, '.wc-add-btn')?.disabled === false,
      String(q(window, '.wc-add-btn')?.textContent ?? '无按钮'));
  }

  // 点添加：关系足够则通过，不够则被拒，且拒绝会落盘
  // 被拒后界面会整页重渲（搜索框被清空），后续断言必须重新搜索
  const addBtn = q(window, '.wc-add-btn');
  if (!hasAdded && addBtn && !addBtn.disabled) {
    const relationOk = ['熟人', '朋友', '挚友', '暧昧', '恋人'].includes(scenarios[name].mvu.林清.关系身份);
    click(addBtn);
    await wait(60);
    check('点击后进入申请中', (addBtn.textContent ?? '').includes('申请中'), addBtn.textContent ?? '');
    await wait(1400);
    if (relationOk) {
      check('关系足够时申请通过',
        q(window, '.wc-add-btn.is-done') !== null || Boolean(q(window, '.wc-badge-added')));
      check('通过后本地标记落盘', window.localStorage.getItem(PKEY + 'hasAdded:v1') === 'true');
    } else {
      check('关系不足时申请被拒', (addBtn.textContent ?? '').includes('拒绝了'), addBtn.textContent ?? '');
      check('拒绝后按钮不可再点', addBtn.disabled === true);
      check('拒绝态加 is-rejected 类', addBtn.classList.contains('is-rejected'));
      check('拒绝状态已落盘', window.localStorage.getItem(PKEY + 'addRejected:v1') === 'true');
      check('被拒后未写入已添加标记', window.localStorage.getItem(PKEY + 'hasAdded:v1') !== 'true');
      // 拒绝是就地更新，不该把搜索框清掉——玩家要能看到刚发生的拒绝
      check('拒绝后就地提示，搜索框保留',
        q(window, '.wc-search-input')?.value === '林清', String(q(window, '.wc-search-input')?.value ?? '已清空'));
      check('给出“再走近一点”提示', Boolean(q(window, '.wc-lock-sub')));
    }
  }

  if (name === '未加好友') {
    // ── 苏玥：新角色，好友申请门槛是「朋友」（林清是「熟人」）──
    scenarios[name].mvu.苏玥 = { 关系身份: '熟人', 亲近: 30, 心动: 10, 心情: '平静' };
    click(qa(window, '.phone-tab')[0]);
    await wait(100);
    click(qa(window, '.phone-tab')[1]);
    await wait(100);
    typeSearch(window, '苏玥');
    await wait(80);
    check('搜索苏玥命中专属卡片', text(window, '.wc-search-card .wc-item-name') === '苏玥', text(window, '.wc-search-card .wc-item-name'));
    check('苏玥熟人时按钮可点（会真拒绝）', q(window, '.wc-add-btn')?.disabled === false);
    click(q(window, '.wc-add-btn'));
    await wait(1500);
    check('苏玥门槛为朋友：熟人被拒', (q(window, '.wc-add-btn')?.textContent ?? '').includes('拒绝了'), q(window, '.wc-add-btn')?.textContent ?? '');
    check('苏玥拒绝态落盘', window.localStorage.getItem(PKEY + 'addRejected:v1:suyue') === 'true');
    check('苏玥未被写入已添加', window.localStorage.getItem(PKEY + 'hasAdded:v1:suyue') !== 'true');

    // 关系升到朋友：拒绝态自动清除、可以添加
    scenarios[name].mvu.苏玥.关系身份 = '朋友';
    click(qa(window, '.phone-tab')[0]);
    await wait(100);
    click(qa(window, '.phone-tab')[1]);
    await wait(100);
    typeSearch(window, '苏玥');
    await wait(80);
    const suyueBtn = q(window, '.wc-add-btn');
    check('苏玥升到朋友后拒绝态清除', suyueBtn?.disabled === false && !(suyueBtn?.textContent ?? '').includes('拒绝了'), suyueBtn?.textContent ?? '');
    check('苏玥拒绝记录已随关系清除', window.localStorage.getItem(PKEY + 'addRejected:v1:suyue') === 'false');
    click(suyueBtn);
    await wait(1500);
    // 通过后整页重渲（搜索框清空），重搜确认徽标
    typeSearch(window, '苏玥');
    await wait(80);
    check('苏玥朋友级申请通过', Boolean(q(window, '.wc-badge-added')));
    check('苏玥通过后本地标记落盘', window.localStorage.getItem(PKEY + 'hasAdded:v1:suyue') === 'true');
    check('苏玥添加写回 MVU', scenarios[name].mvu.微信._已添加苏玥 === true);

    // 她的聊天线是独立的：预置一条记录 + 模拟 AI 接口，验证摘要与朋友圈生成
    window.localStorage.setItem(PKEY + 'chat-history:v1:suyue', JSON.stringify([
      { role: 'assistant', content: '刚打烊。', date: '2025-04-03', time: '02:10' },
    ]));
    window.localStorage.setItem('YuriOpening:phone:ai-config:v1', JSON.stringify({
      baseUrl: 'https://mock.test/v1', apiKey: '', model: 'mock', systemPromptPrefix: '',
    }));
    window.fetch = async () => ({
      ok: true,
      json: async () => ({ choices: [{ message: { content: '夜里风有点凉。' } }] }),
    });
    click(qa(window, '.phone-tab')[0]);
    await wait(120);
    check('聊天列表出现苏玥会话', qa(window, '.wc-chat-item').length === 1 && text(window, '.wc-chat-item .wc-item-name') === '苏玥', `${qa(window, '.wc-chat-item').length} / ${text(window, '.wc-chat-item .wc-item-name')}`);
    click(q(window, '.wc-chat-item'));
    await wait(150);
    check('苏玥会话页标题正确', text(window, '.wc-chat-title') === '苏玥', text(window, '.wc-chat-title'));
    check('苏玥会话渲染她的消息', qa(window, '.wc-msg-row.wc-msg-in').length >= 1);
    check('林清聊天记录未被占用', window.localStorage.getItem(PKEY + 'chat-history:v1') === null);
    // 离开她的会话：触发摘要（写入她的字段）→ 她的朋友圈生成（按角色独立）
    click(q(window, '.wc-icon-btn'));
    await wait(900);
    const suyueSummary = scenarios[name].mvu.微信._苏玥聊天摘要历史;
    check('苏玥摘要写入她的字段', Array.isArray(suyueSummary) && suyueSummary.length === 1, JSON.stringify(suyueSummary));
    const suyueMoments = (scenarios[name].mvu.微信._朋友圈 ?? []).filter(m => m.作者 === '苏玥');
    check('苏玥朋友圈已生成并署名', suyueMoments.length === 1 && suyueMoments[0].内容.length > 0, JSON.stringify(suyueMoments));
    check('苏玥朋友圈冷却日期已记录', window.localStorage.getItem(PKEY + 'moments-last:v1:suyue') === '2025-04-03', String(window.localStorage.getItem(PKEY + 'moments-last:v1:suyue')));
    delete window.fetch;
    window.localStorage.setItem('YuriOpening:phone:ai-config:v1', JSON.stringify({
      baseUrl: '', apiKey: '', model: 'gpt-4o-mini', systemPromptPrefix: '',
    }));
    // 回到通讯录页，后续「搜不到」断言依赖搜索框在场
    click(qa(window, '.phone-tab')[1]);
    await wait(100);
  }

  typeSearch(window, '不存在的人');
  await wait(60);
  check('搜不到时给出空结果', Boolean(q(window, '.wc-no-result')));
  // 朋友圈页
  click(qa(window, '.phone-tab')[2]);
  await wait(100);
  check('切到朋友圈页', Boolean(q(window, '.wc-moments')));
  check('封面在', Boolean(q(window, '.wc-moments-cover')));
  check('朋友圈横幅为玩家本人', text(window, '.wc-moments-name') === '林栖', text(window, '.wc-moments-name'));
  if (name === '未加好友') {
    // 名字兜底：表单姓名缺失/未命名时，退回酒馆用户设定名（{{user}} 等价物）
    delete scenarios[name].mvu.玩家._姓名;
    click(qa(window, '.phone-tab')[0]);
    await wait(100);
    click(qa(window, '.phone-tab')[2]);
    await wait(100);
    check('表单缺名时退回酒馆用户名', text(window, '.wc-moments-name') === '林栖', text(window, '.wc-moments-name'));
    scenarios[name].mvu.玩家._姓名 = '未命名';
    click(qa(window, '.phone-tab')[0]);
    await wait(100);
    click(qa(window, '.phone-tab')[2]);
    await wait(100);
    check('表单未命名时退回酒馆用户名', text(window, '.wc-moments-name') === '林栖', text(window, '.wc-moments-name'));
    scenarios[name].mvu.玩家._姓名 = '林栖';
  }
  const moments = scenarios[name].mvu.微信._朋友圈;
  const anyAdded = Boolean(scenarios[name].mvu.微信._已添加林清) || Boolean(scenarios[name].mvu.微信._已添加苏玥);
  if (!anyAdded) {
    check('未加好友时朋友圈锁定', Boolean(q(window, '.wc-moments-locked')));
  } else if (moments.length === 0) {
    check('无动态时给出空态', Boolean(q(window, '.wc-moments-locked')));
  } else {
    check('动态卡片数与数据一致', qa(window, '.wc-moment-card').length === moments.length,
      `${qa(window, '.wc-moment-card').length} vs ${moments.length}`);
    check('动态含心情标签', qa(window, '.wc-moment-mood').length === moments.length);
    check('动态含点赞按钮', qa(window, '.wc-action-btn').length === moments.length * 2);
    const likeBtn = q(window, '.wc-action-btn');
    const likeCountEl = q(window, '.wc-like-count');
    const before = Number(likeCountEl?.textContent ?? '0');
    click(likeBtn);
    await wait(80);
    check('点赞后计数 +1', Number(q(window, '.wc-like-count')?.textContent ?? '0') === before + 1,
      `${before} → ${q(window, '.wc-like-count')?.textContent}`);
  }

  // 设置页
  click(qa(window, '.phone-tab')[3]);
  await wait(100);
  check('切到设置页', Boolean(q(window, '.wc-settings-page')));
  check('有四个接口输入框（含高级设置的 System Prompt）', qa(window, '.wc-setting-input').length === 4,
    String(qa(window, '.wc-setting-input').length));
  check('测试连接按钮在', Boolean(q(window, '.wc-test-btn')));
  check('高级设置折叠在', Boolean(q(window, '.wc-advanced')));
  const advTa = q(window, '.wc-setting-ta');
  check('高级设置含 System Prompt 输入区', Boolean(advTa));

  const styleText = q(window, '#phone-root-style')?.textContent ?? '';
  if (!styleText) failures.push('  ✗ 产物没有注入样式元素 #phone-root-style');
  else styleSamples.push(styleText);

  notes.forEach(line => console.log(line));
  notes.length = 0;
  if (failures.length === before) console.log('  全部通过');

  // 产物里有常驻计时器（视口心跳 / 键盘诊断），jsdom 会一直吊住事件循环；
  // 每个场景跑完必须显式 close，否则脚本永不退出。
  dom.window.close();
}

// ────────────────────────────────────────────────────────────────────────────
// 嵌入模式（主应用面板）+ 通知与未读
// ────────────────────────────────────────────────────────────────────────────

async function runEmbedded() {
  console.log('\n【嵌入模式 · 通知与未读】');
  const before = failures.length;
  const mvu = {
    玩家: { _姓名: '林栖' },
    林清: { 关系身份: '朋友', 亲近: 58, 心动: 34, 心情: '愉快' },
    微信: { _已添加林清: true, _未读数: 0, _朋友圈: [] },
    环境: { 日期: '2025-06-01', 时间: '21:00' },
  };
  const dom = new JSDOM(
    '<!DOCTYPE html><html><head></head><body><div id="yuri-front"><div id="phone-slot"></div></div></body></html>',
    { runScripts: 'outside-only', pretendToBeVisual: true, url: 'https://local.test/' },
  );
  const { window } = dom;
  const errors = [];
  window.addEventListener('error', e => errors.push(String(e.error ?? e.message)));
  window.SillyTavern = { getCurrentChatId: () => 'embedded', name1: '林栖', getContext: () => ({ name1: '林栖' }) };
  window.localStorage.clear();
  window.localStorage.setItem('YuriOpening:phone:embedded:hasAdded:v1', 'true');
  window.localStorage.setItem('YuriOpening:phone:embedded:chat-history:v1', JSON.stringify([
    { role: 'assistant', content: '回来了？', date: '2025-06-01', time: '20:58' },
  ]));
  window.localStorage.setItem('YuriOpening:phone:ai-config:v1', JSON.stringify({
    baseUrl: 'https://mock.test/v1', apiKey: '', model: 'mock', systemPromptPrefix: '',
  }));
  window.waitGlobalInitialized = () => Promise.resolve();
  window.errorCatched = fn => () => fn();
  window.eventOn = () => ({ stop() {} });
  window.tavern_events = { CHAT_CHANGED: 'chat_changed' };
  window.$ = arg => {
    if (typeof arg === 'function') { arg(); return window.$; }
    return { one() { return this; }, on() { return this; }, off() { return this; } };
  };
  window.Mvu = {
    events: { VARIABLE_INITIALIZED: 'mvu_init', VARIABLE_UPDATE_ENDED: 'mvu_ended' },
    getMvuData: () => ({ stat_data: mvu }),
    replaceMvuData: data => {
      // 写入的 stat_data 就是这份内存对象（模拟真实 MVU 的原地更新）
      if (data.stat_data !== mvu) {
        for (const key of Object.keys(mvu)) delete mvu[key];
        Object.assign(mvu, data.stat_data);
      }
      return Promise.resolve();
    },
  };

  // 流式接口的最小替身：延迟返回一段 SSE，用来验证「回复落盘后才算未读」
  const replies = ['路上小心。', '到家了说一声。'];
  let replyIndex = 0;
  window.fetch = async () => {
    const content = replies[Math.min(replyIndex, replies.length - 1)];
    replyIndex += 1;
    await wait(180);
    const bytes = new TextEncoder().encode(
      `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\ndata: [DONE]\n\n`,
    );
    let served = false;
    return {
      ok: true,
      json: async () => ({ choices: [{ message: { content } }] }),
      body: {
        getReader: () => ({
          async read() {
            if (served) return { done: true, value: undefined };
            served = true;
            return { done: false, value: bytes };
          },
        }),
      },
    };
  };

  window.__YURI_PHONE_EMBEDDED__ = true;
  window.eval(scriptBody);
  await wait(40);
  check('嵌入标记下不自动挂载', q(window, '#phone-root-host') === null);

  const notices = [];
  const unreadLog = [];
  const phone = window.__YURI_PHONE_MOUNT__({
    embedded: true,
    host: window.document,
    hostWin: window,
    root: window.document.getElementById('phone-slot'),
    onNotify: n => notices.push(n),
    onUnread: n => unreadLog.push(n),
  });
  await wait(120);

  check('无运行时异常', errors.length === 0, errors.slice(0, 2).join(' | '));
  check('挂载进指定 root', window.document.querySelector('#phone-slot > #phone-root-host') !== null);
  check('容器标记 data-embedded', q(window, '#phone-root-host')?.getAttribute('data-embedded') === 'true');
  check('嵌入模式不建悬浮按钮', q(window, '.phone-fab') === null);
  check('嵌入模式不建小窗切换键', q(window, '.phone-mode-btn') === null);
  check('外壳初始隐藏', q(window, '.phone-shell')?.classList.contains('is-open') === false);
  check('外壳不写内联尺寸', !q(window, '.phone-shell')?.style.width, q(window, '.phone-shell')?.style.width);
  check('铃铛入口在', Boolean(q(window, '.phone-bell')));
  check('初始未读为 0', phone.getUnread() === 0, String(phone.getUnread()));

  phone.open();
  await wait(80);
  check('open() 展开外壳', q(window, '.phone-shell')?.classList.contains('is-open') === true);
  check('四个页签', qa(window, '.phone-tab').length === 4, String(qa(window, '.phone-tab').length));

  click(q(window, '.wc-chat-item'));
  await wait(120);
  check('进入对话页', Boolean(q(window, '.wc-chatpage')));

  // 发一条就立刻收起手机：回复落盘时手机已关，应记未读并通知宿主
  q(window, '.wc-input').value = '今天会晚一点';
  click(q(window, '.wc-send-btn'));
  await wait(40);
  phone.close();
  await wait(700);
  check('收起后外壳隐藏', q(window, '.phone-shell')?.classList.contains('is-open') === false);
  check('手机收起后回复仍记未读', phone.getUnread() === 1, String(phone.getUnread()));
  check('宿主收到 onNotify', notices.length === 1, String(notices.length));
  check('通知预览取自回复', notices[0]?.preview?.includes('路上小心') === true, JSON.stringify(notices[0]));
  check('通知角色与类型正确', notices[0]?.charId === 'linqing' && notices[0]?.kind === 'message');
  check('宿主收到 onUnread', unreadLog.includes(1), JSON.stringify(unreadLog));
  check('未读数防抖镜像回 MVU', mvu.微信._未读数 === 1, String(mvu.微信._未读数));
  check('铃铛未读点亮起', q(window, '.phone-bell-dot')?.classList.contains('is-on') === true);
  check('通知按存档落盘', (window.localStorage.getItem('YuriOpening:phone:embedded:notify:v1') ?? '').includes('路上小心'));

  // 通知中心：点条目进入对应聊天，只清这条聊天的未读
  phone.openNotifications();
  await wait(80);
  check('打开通知中心', Boolean(q(window, '.wc-notify-page')));
  check('通知条目标记未读', qa(window, '.wc-notify-item.is-unread').length === 1,
    String(qa(window, '.wc-notify-item.is-unread').length));
  click(q(window, '.wc-notify-item'));
  await wait(150);
  check('点通知进入对应聊天', Boolean(q(window, '.wc-chatpage')) && text(window, '.wc-chat-title') === '林清');
  check('进入聊天后未读清零', phone.getUnread() === 0, String(phone.getUnread()));
  check('铃铛未读点熄灭', q(window, '.phone-bell-dot')?.classList.contains('is-on') === false);

  // 正看着这条聊天时回复完成：不记未读，但通知留档（算已读）
  q(window, '.wc-input').value = '到楼下了';
  click(q(window, '.wc-send-btn'));
  await wait(500);
  check('正在看的聊天不记未读', phone.getUnread() === 0, String(phone.getUnread()));
  check('正在看的聊天不发 onNotify', notices.length === 1, String(notices.length));

  phone.openNotifications();
  await wait(80);
  check('通知留档两条', qa(window, '.wc-notify-item').length === 2, String(qa(window, '.wc-notify-item').length));
  check('已读条目不标未读', qa(window, '.wc-notify-item.is-unread').length === 0);

  phone.destroy();
  await wait(60);
  check('destroy() 移除容器', q(window, '#phone-root-host') === null);
  check('destroy() 后未读出异常', errors.length === 0, errors.slice(0, 2).join(' | '));

  notes.forEach(line => console.log(line));
  notes.length = 0;
  if (failures.length === before) console.log('  全部通过');
  dom.window.close();
}

await runEmbedded();

// ────────────────────────────────────────────────────────────────────────────
// 类名是否都有对应 CSS 规则
// ────────────────────────────────────────────────────────────────────────────

console.log('\n【类名→CSS 覆盖】');
const styleText = styleSamples[0] ?? '';
if (!styleText) {
  failures.push('  ✗ 没有取得任何运行时样式，无法校对类名覆盖');
} else {
  console.log(`  运行时 CSS 长度 ${styleText.length} 字符（取自 #phone-root-style）`);
  const missing = [];
  for (const cls of [...usedClasses].sort()) {
    // 产物 CSS 未压缩选择器中的类名，直接按 .cls 匹配即可；
    // 末尾用 (?![-\w]) 防止 wc-msg 误命中 wc-msg-area。
    const pattern = new RegExp('\\.' + cls + '(?![-\\w])');
    if (!pattern.test(styleText)) missing.push(cls);
  }
  // wc-msg- 是拼字符串的前缀（`wc-msg-${'out'}`），不是真实类名，不参与校对
  const real = missing.filter(cls => cls !== 'wc-msg-');
  if (real.length === 0) {
    console.log(`  ✓ 产物 JS 用到的 ${usedClasses.size} 个类名在运行时 CSS 里都有规则`);
  } else {
    failures.push(`  ✗ ${real.length} 个类名没有对应 CSS 规则：${real.join(', ')}`);
  }
}

if (failures.length) {
  console.log('\n失败项:');
  failures.forEach(line => console.log(line));
  console.log('\n结论: 存在失败项。');
  process.exit(1);
} else {
  console.log('\n结论: 所有断言通过，手机界面在 DOM 环境下可正常渲染、切页与交互。');
  // 显式退出：jsdom 里残留的计时器不应拖住进程
  process.exit(0);
}
