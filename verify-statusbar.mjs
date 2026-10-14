#!/usr/bin/env node
/**
 * 用 jsdom 把状态栏构建产物真跑一遍，断言它确实渲染出了预期 DOM。
 * 这是无头近似验证：能抓住运行时异常、空指针、API 误用与结构缺失，
 * 但不能替代真机上的视觉确认。
 */
import fs from 'node:fs';
import path from 'node:path';
import { JSDOM } from 'jsdom';

const here = import.meta.dirname;
const dist = path.join(here, 'dist/YuriOpening/界面/状态栏/index.html');
const built = fs.readFileSync(dist, 'utf8');

const scriptMatch = built.match(/<script type="module">([\s\S]*?)<\/script>/);
const styleText = built.match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? '';
const bodyHtml = built.match(/<body>([\s\S]*?)<\/body>/)?.[1] ?? '<div id="statusbar-root"></div>';
if (!scriptMatch) throw new Error('未找到内联 module 脚本');

const scenarios = {
  日常白昼: {
    环境: {
      日期: '2025-05-16', 时间: '14:20', 天气: '晴', 主题覆盖: '自动',
      地点: { 城市: '百合市', 区域: '中心城区', 具体地点: '花信大厦 17 层' },
    },
    玩家状态: {
      心情: '平静', 精力: 68, 身体状态: '健康', 当前行动: '工作',
      关系姿态: '自然相处', 当前穿着: '浅灰西装外套与白色内搭',
    },
    林清: {
      亲近: 62, 心动: 38, 心情: '愉快', 当前行动: '在万花汇谈合作',
      当前穿着: '深色衬衫与西装长裤，袖口挽起', 关系身份: '朋友', 所在地点: '万花汇',
      心声: '她点的还是那杯不加糖的美式。我记性向来不错。',
    },
    苏玥: {
      亲近: 52, 心动: 34, 心情: '愉快', 当前行动: '在花店挑藤苗',
      当前穿着: '米白色针织裙，帆布鞋', 关系身份: '朋友', 所在地点: '绣球路步行街',
      心声: '藤苗要挑根系舒展的……不知道她会不会觉得我烦。',
    },
    地图: {
      当前地点: '蔷薇文化传媒',
      地点状态: { 万花汇: { 状态: '正常', 备注: '顶楼的包间今天全满' } },
    },
  },
  刚开局: {
    环境: {
      日期: '待设定', 时间: '待设定', 天气: '待设定', 主题覆盖: '自动',
      地点: { 城市: '待设定', 区域: '待设定', 具体地点: '待设定' },
    },
    玩家状态: {
      心情: '待设定', 精力: '待设定', 身体状态: '待设定',
      当前行动: '待设定', 关系姿态: '待设定', 当前穿着: '待设定',
    },
    林清: {
      亲近: 0, 心动: 0, 心情: '平静', 当前行动: '在办公室审阅项目材料',
      当前穿着: '衬衫、西装外套、直筒西裤', 关系身份: '初识', 所在地点: '蔷薇文化传媒', 心声: '',
    },
    地图: { 当前地点: '待设定', 地点状态: {} },
  },
  旧档未初始化: {
    环境: {
      日期: '待设定', 时间: '待设定', 天气: '待设定', 主题覆盖: '自动',
      地点: { 城市: '待设定', 区域: '待设定', 具体地点: '待设定' },
    },
    玩家状态: {
      心情: '待设定', 精力: '待设定', 身体状态: '待设定',
      当前行动: '待设定', 关系姿态: '待设定', 当前穿着: '待设定',
    },
    林清: {
      亲近: '待设定', 心动: '待设定', 心情: '待设定', 当前行动: '待设定',
      当前穿着: '待设定', 关系身份: '待设定', 所在地点: '待设定', 心声: '',
    },
    地图: { 当前地点: '待设定', 地点状态: {} },
  },
};

function withHeroine(base, heroine) {
  return { ...base, 林清: { ...base.林清, ...heroine } };
}
const daily = scenarios.日常白昼;
scenarios.并蒂足迹 = withHeroine(daily, { 亲近: 80, 心动: 82, 心情: '心动', 关系身份: '暧昧' });
scenarios.早开落花 = withHeroine(daily, { 亲近: 15, 心动: 80, 心情: '吃醋', 关系身份: '熟人' });
scenarios.藤瀑 = { ...daily, 苏玥: { ...daily.苏玥, 亲近: 78, 心动: 82, 心情: '心动', 关系身份: '暧昧' } };

/** 天气场景：只换 环境.天气，其余沿用日常白昼 */
function withWeather(base, 天气Value) {
  return { ...base, 环境: { ...base.环境, 天气: 天气Value } };
}
scenarios.大雨 = withWeather(daily, '大雨');
scenarios.下雪 = withWeather(daily, '雪');
scenarios.浓雾 = withWeather(daily, '雾');
scenarios.雷雨 = withWeather(daily, '雷雨');
const { 林清: _omit, ...oldSave } = daily;
// 历史楼层按 message_id 升序；当前楼层 id = history.length
const histories = {
  并蒂足迹: [
    oldSave,
    withHeroine(daily, { 亲近: 30, 心动: 20 }),
    withHeroine(daily, { 亲近: 30, 心动: 20 }),
    withHeroine(daily, { 亲近: 55, 心动: 60 }),
    withHeroine(daily, { 亲近: 78, 心动: 75 }),
  ],
  早开落花: [withHeroine(daily, { 亲近: 20, 心动: 86 })],
};

const failures = [];
const notes = [];
function check(label, condition, detail = '') {
  if (condition) notes.push(`  ✓ ${label}`);
  else failures.push(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`);
}

async function run(scenarioName, scenario) {
  const dom = new JSDOM(
    `<!DOCTYPE html><html><head><style>${styleText}</style></head><body>${bodyHtml}</body></html>`,
    { runScripts: 'outside-only', pretendToBeVisual: true, url: 'https://local.test/' },
  );
  const { window } = dom;
  const errors = [];
  window.addEventListener('error', event => errors.push(String(event.error ?? event.message)));

  // 酒馆助手运行时桩
  const history = histories[scenarioName] ?? [];
  window.getVariables = (options = {}) =>
    typeof options.message_id === 'number' && options.message_id < history.length
      ? { stat_data: history[options.message_id] }
      : { stat_data: scenario };
  window.getCurrentMessageId = () => history.length;
  window.waitGlobalInitialized = () => Promise.resolve();
  window.eventOn = () => ({ stop() {} });
  window.errorCatched = fn => () => {
    try {
      const result = fn();
      if (result && typeof result.catch === 'function') result.catch(error => errors.push(String(error)));
      return result;
    } catch (error) {
      errors.push(String(error));
    }
  };
  window.triggerSlash = () => Promise.resolve();
  window.Mvu = { events: { VARIABLE_INITIALIZED: 'init', VARIABLE_UPDATE_ENDED: 'ended' } };
  window.SillyTavern = { characterId: 'test' };
  window.$ = arg => {
    if (typeof arg === 'function') { arg(); return window.$; }
    return { one() { return this; }, on() { return this; }, off() { return this; } };
  };

  // lodash：产物依赖 _.get 与 _.has
  function get(object, path, fallback) {
    const parts = Array.isArray(path)
      ? path.map(String)
      : String(path).replace(/\[(\d+)\]/g, '.$1').split('.').filter(Boolean);
    let current = object;
    for (const part of parts) {
      if (current === null || current === undefined) return fallback;
      current = current[part];
    }
    return current === undefined ? fallback : current;
  }
  window._ = {
    get,
    has: (object, path) => get(object, path, undefined) !== undefined,
    clamp: (value, lower, upper) => Math.min(Math.max(value, lower), upper),
  };

  // 以函数包裹方式执行产物：产物本身无 import/export，可安全内联。
  // 末尾的 sourceMappingURL 是行注释，必须先换行，否则会吞掉包裹用的收尾括号。
  const source = scriptMatch[1];
  const factory = new Function('window', 'document', 'globalThis',
    `with (window) { (function(){ ${source}\n})(); }`);
  factory(window, window.document, window);

  // 产物用 $(() => ...) 同步调用 init()，其中第一个 await 已让出，需要冲刷微任务。
  await new Promise(resolve => setTimeout(resolve, 0));
  await new Promise(resolve => setTimeout(resolve, 30));

  const doc = window.document;
  const click = element => element?.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  const tick = () => new Promise(resolve => setTimeout(resolve, 10));
  const openTab = async label => {
    click(Array.from(doc.querySelectorAll('.hud-tab')).find(tab => tab.textContent === label));
    await tick();
  };
  const openPanel = async () => {
    if (doc.querySelector('.hud-drawer')?.hidden !== false) {
      click(doc.querySelector('.snapshot-bar'));
      await tick();
    }
  };
  const charIds = { 林清: 'linqing', 苏玥: 'suyue' };
  const openCharacter = async name => {
    await openPanel();
    await openTab('角色');
    const want = charIds[name] ?? name;
    if (doc.querySelector(`.char-panel[data-character="${want}"]`)) return;
    if (doc.querySelector('.char-panel')) {
      click(doc.querySelector('.char-back'));
      await tick();
    }
    click(Array.from(doc.querySelectorAll('.char-item')).find(item => item.dataset.character === want));
    await tick();
  };

  if (scenarioName === '日常白昼') {
    const shell = doc.querySelector('.hud-shell');
    check('渲染出状态栏外壳', Boolean(shell));
    check('外壳带 data-scene 与 data-daypart', shell?.dataset.daypart === 'day' && shell?.dataset.weather === 'clear',
      `daypart=${shell?.dataset.daypart} weather=${shell?.dataset.weather}`);
    // 晴天只改纸面颜色，不养天气动画层。
    // 注意：这里不能点快照条（会改变面板开合状态，扰乱后续断言），
    // 后面的地图部分已有展开面板的动作，所以把断言放到那里去。

    check('天气签显示「晴」', doc.querySelector('[data-role="weather-label"]')?.textContent === '晴');
    check('日期显示为 2025-05-16', doc.querySelector('[data-role="date"]')?.textContent === '2025-05-16');
    check('时间显示为 14:20', doc.querySelector('[data-role="time"]')?.textContent === '14:20');
    check('地点为三级拼接', (doc.querySelector('[data-role="place"]')?.textContent ?? '').includes('花信大厦'), doc.querySelector('[data-role="place"]')?.textContent ?? '');
    check('天气签绘制了 SVG 图标', Boolean(doc.querySelector('[data-role="weather-mark"] svg')));
    check('晴天图标含太阳分组', Boolean(doc.querySelector('[data-part="sun"]')));

    // 展开面板
    doc.querySelector('.snapshot-bar')?.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    await new Promise(resolve => setTimeout(resolve, 10));
    const drawer = doc.querySelector('.hud-drawer');
    check('点击后抽屉展开', drawer && drawer.hidden === false);

    const rows = doc.querySelectorAll('.status-row');
    check('玩家状态渲染 6 行', rows.length === 6, `实际 ${rows.length}`);
    const figures = Array.from(doc.querySelectorAll('.status-figure')).map(node => node.textContent);
    check('心情显示「平静」', figures.includes('平静'), figures.join('/'));
    const meter = doc.querySelector('.meter-fill');
    check('精力以进度条呈现且宽度为 68%', meter?.style.width === '68%', meter?.style.width ?? '无');
    check('精力数值显示 68', doc.querySelector('.meter-figure')?.textContent === '68');

    const tabNames = Array.from(doc.querySelectorAll('.hud-tab')).map(tab => tab.textContent);
    check('页签顺序为 玩家状态/角色/城市地图/设置', tabNames.join('/') === '玩家状态/角色/城市地图/设置', tabNames.join('/'));

    await openPanel();
    await openTab('角色');
    check('角色页签先给出角色列表', Boolean(doc.querySelector('.char-list')) && !doc.querySelector('.char-panel'));
    const charItems = Array.from(doc.querySelectorAll('.char-item'));
    check('列表两张角色卡（林清/苏玥）', charItems.length === 2
      && charItems.map(item => item.dataset.character).join('/') === 'linqing/suyue',
      charItems.map(item => item.dataset.character).join('/'));
    check('每张卡都有花徽', doc.querySelectorAll('.char-item-roundel svg').length === 2);
    check('每张卡两条迷你进度', doc.querySelectorAll('.char-stat-track').length === 4);
    check('苏玥卡不在未相遇态', doc.querySelector('.char-item[data-character="suyue"]')?.classList.contains('is-unmet') === false);
    click(charItems.find(item => item.dataset.character === 'suyue'));
    await tick();
    check('点名字进入苏玥面板', doc.querySelector('.char-panel')?.dataset.character === 'suyue');
    check('苏玥面板用藤紫身份色', (doc.querySelector('.char-panel')?.style.getPropertyValue('--hud-accent') ?? '') === '#7c63a9',
      doc.querySelector('.char-panel')?.style.getPropertyValue('--hud-accent') ?? '无');
    check('苏玥花期为「穗影含羞」（展叶 × 结穗）', doc.querySelector('.bloom-name')?.textContent === '穗影含羞',
      doc.querySelector('.bloom-name')?.textContent ?? '');
    check('苏玥画布是紫藤（有竹架、无百合花心）', Boolean(doc.querySelector('.bloom-trellis')) && !doc.querySelector('.bloom-center'));
    check('苏玥心声便签在', Boolean(doc.querySelector('.heroine-voice')));
    click(doc.querySelector('.char-back'));
    await tick();
    check('返回键回到角色列表', Boolean(doc.querySelector('.char-list')) && !doc.querySelector('.char-panel'));
    click(Array.from(doc.querySelectorAll('.char-item')).find(item => item.dataset.character === 'linqing'));
    await tick();
    check('林清面板渲染', Boolean(doc.querySelector('.heroine-section')));
    check('林清面板渲染 5 行字段', doc.querySelectorAll('.heroine-section .status-row').length === 5,
      String(doc.querySelectorAll('.heroine-section .status-row').length));
    check('亲近 62 / 心动 38 落在「知己」区', doc.querySelector('.chart-zone.is-active')?.classList.contains('is-confidant')
      && doc.querySelector('.heroine-zone')?.textContent === '知己', doc.querySelector('.heroine-zone')?.textContent ?? '无');
    check('星图上有且仅有一个林清标记', doc.querySelectorAll('.chart-marker').length === 1);
    check('花期为「绿里含羞」（展叶 × 青苞）', doc.querySelector('.bloom-name')?.textContent === '绿里含羞',
      doc.querySelector('.bloom-name')?.textContent ?? '');
    check('关系印章显示「朋友」', (doc.querySelector('.heroine-seal')?.textContent ?? '').includes('朋友'));
    check('心跳线显示 bpm', doc.querySelector('.pulse-figure')?.textContent === '心跳 83', doc.querySelector('.pulse-figure')?.textContent);
    check('无历史楼层时不画足迹', !doc.querySelector('.chart-trail') && !doc.querySelector('.heroine-delta'));
    const voice = doc.querySelector('.heroine-voice');
    check('心声便签默认折起', voice && !voice.classList.contains('is-open') && voice.getAttribute('aria-expanded') === 'false');
    click(voice);
    check('点击后心声便签翻开', voice?.classList.contains('is-open') && voice.getAttribute('aria-expanded') === 'true');
    click(doc.querySelector('.heroine-locate'));
    await tick();
    const locatedDetail = doc.querySelector('.node-detail');
    check('「在地图上找她」跳到地图并选中她所在地点',
      Boolean(doc.querySelector('svg.map-canvas')) && (locatedDetail?.textContent ?? '').includes('万花汇')
      && (locatedDetail?.textContent ?? '').includes('林清在这里 · 在万花汇谈合作'), locatedDetail?.textContent ?? '无');
    check('地图上两枚角色图钉（林清/苏玥）', doc.querySelectorAll('.heroine-pin').length === 2
      && Boolean(doc.querySelector('.heroine-pin[data-character="linqing"]'))
      && Boolean(doc.querySelector('.heroine-pin[data-character="suyue"]')),
      String(doc.querySelectorAll('.heroine-pin').length));
    check('苏玥图钉用藤紫身份色', (doc.querySelector('.heroine-pin[data-character="suyue"]')?.style.getPropertyValue('--pin-accent') ?? '') === '#7c63a9');
    click(locatedDetail?.querySelector('.node-close'));
    await tick();

    // 切到地图
    const mapTab = Array.from(doc.querySelectorAll('.hud-tab')).find(tab => tab.textContent === '城市地图');
    check('存在城市地图页签', Boolean(mapTab));
    mapTab?.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    await new Promise(resolve => setTimeout(resolve, 10));
    const canvas = doc.querySelector('svg.map-canvas');
    check('地图渲染为 SVG 画布', Boolean(canvas));
    check('地图含河道', doc.querySelectorAll('.map-water').length >= 1);
    check('地图含手绘道路', doc.querySelectorAll('.map-road').length >= 1);
    check('地图含区域标注', doc.querySelectorAll('.map-label').length >= 4, String(doc.querySelectorAll('.map-label').length));
    const nodes = doc.querySelectorAll('.map-node');
    check('19 个地点全部渲染', nodes.length === 19, `实际 ${nodes.length}`);
    check('地图全亮：无雾面/锁定/占位', !doc.querySelector('.is-unknown, .is-locked, .map-fog, .map-lock-ground'));
    check('晴天地图不生成天气层', !doc.querySelector('.map-canvas .weather-layer'));
    check('每个地点都有手绘建筑', doc.querySelectorAll('.map-node .node-art').length === 19,
      String(doc.querySelectorAll('.map-node .node-art').length));
    check('地图上没有家/公司等额外标记', !doc.querySelector('.map-node .node-tag'));
    const labels = Array.from(doc.querySelectorAll('.map-node .node-name')).map(node => node.textContent);
    check('地点名不重复', new Set(labels).size === labels.length);
    for (const need of ['铃兰公寓', '蔷薇文化传媒', '绣球路步行街', '樱华女子大学', '百合东站', '昙夜酒吧', '花火KTV', '汀兰公寓', '木槿拳馆']) {
      check(`必备地点「${need}」存在`, labels.includes(need));
    }
    check('地图画布为 640×400', canvas?.getAttribute('viewBox') === '0 0 640 400', canvas?.getAttribute('viewBox'));
    const currentNodes = doc.querySelectorAll('.map-node.is-current');
    check('当前地点（按地点名匹配）被唯一标记', currentNodes.length === 1
      && currentNodes[0].getAttribute('aria-label')?.startsWith('蔷薇文化传媒'),
      currentNodes[0]?.getAttribute('aria-label') ?? '无');
    check('地图提示写出当前位置', (doc.querySelector('.map-hint')?.textContent ?? '').includes('你在「蔷薇文化传媒」'));
    check('节点绘制了建筑图形', Boolean(doc.querySelector('.map-node .node-art')));

    const frame = doc.querySelector('.map-frame');
    const zoomButtons = doc.querySelectorAll('.map-zoom-button');
    const zoomLevel = () => doc.querySelector('.map-zoom-level')?.textContent;
    check('地图有放大/缩小两个按钮', zoomButtons.length === 2);
    check('默认缩放为 100%', zoomLevel() === '100%', zoomLevel());
    zoomButtons[1].dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    zoomButtons[1].dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    check('放大两次后为 170%', zoomLevel() === '170%' && frame.style.getPropertyValue('--map-zoom') === '1.7',
      `${zoomLevel()} / ${frame.style.getPropertyValue('--map-zoom')}`);
    check('放大到上限后按钮禁用', zoomButtons[1].disabled, zoomLevel());
    for (let i = 0; i < 9; i += 1) zoomButtons[0].dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    check('缩小到下限后按钮禁用', zoomLevel() === '50%' && zoomButtons[0].disabled, zoomLevel());
    zoomButtons[1].dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    zoomButtons[1].dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    zoomButtons[1].dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    check('地图容器可滚动', window.getComputedStyle(frame).overflow === 'auto', window.getComputedStyle(frame).overflow);

    // 点击地点出详情
    const target = Array.from(nodes).find(node => node.getAttribute('aria-label')?.startsWith('万花汇'));
    target?.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    await new Promise(resolve => setTimeout(resolve, 10));
    const detail = doc.querySelector('.node-detail');
    check('点击地点弹出详情', Boolean(detail));
    check('详情含地点状态备注（按地点名取）', (detail?.textContent ?? '').includes('顶楼的包间今天全满'), detail?.textContent ?? '');
    check('非当前地点给出前往按钮', Boolean(detail?.querySelector('.travel-button')));
    detail?.querySelector('.node-close')?.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    await new Promise(resolve => setTimeout(resolve, 10));
    check('关闭按钮收起详情', !doc.querySelector('.node-detail'));
    const taggedNode = Array.from(nodes).find(node => node.getAttribute('aria-label')?.startsWith('蔷薇文化传媒'));
    taggedNode?.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    await new Promise(resolve => setTimeout(resolve, 10));
    const taggedDetail = doc.querySelector('.node-detail');
    check('详情行不再拼接额外标记', taggedDetail?.querySelector('.section-kicker')?.textContent === '中心城区',
      taggedDetail?.querySelector('.section-kicker')?.textContent ?? '无');
    taggedDetail?.querySelector('.node-close')?.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    await new Promise(resolve => setTimeout(resolve, 10));
    check('地图重建后保留缩放倍数', doc.querySelector('.map-zoom-level')?.textContent === '130%',
      doc.querySelector('.map-zoom-level')?.textContent);

    // 设置页
    const settingsTab = Array.from(doc.querySelectorAll('.hud-tab')).find(tab => tab.textContent === '设置');
    settingsTab?.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    await new Promise(resolve => setTimeout(resolve, 10));
    await openCharacter('林清');
    check('切页再回来心声仍保持翻开', doc.querySelector('.heroine-voice')?.classList.contains('is-open'));
    await openTab('设置');
    check('设置页有 3 个开关', doc.querySelectorAll('.setting-row input').length === 3);

    // 关掉动效后应回到静态
    const animateInput = doc.querySelector('.setting-row input');
    animateInput.checked = false;
    animateInput.dispatchEvent(new window.Event('change', { bubbles: true }));
    await new Promise(resolve => setTimeout(resolve, 10));
    check('关闭动效后 data-animate 为 false', shell?.dataset.animate === 'false', shell?.dataset.animate ?? '');
  }

  if (scenarioName === '刚开局') {
    check('默认人设：天气签仍渲染', Boolean(doc.querySelector('.snapshot-bar')));
    await openPanel();
    await openTab('角色');
    check('刚开局：苏玥显示未相遇态', doc.querySelector('.char-item[data-character="suyue"]')?.classList.contains('is-unmet') === true);
    check('刚开局：苏玥进度显示占位', (doc.querySelector('.char-item[data-character="suyue"] .char-stat-figure')?.textContent ?? '') === '—');
    await openCharacter('林清');
    check('默认人设：区落在「萍水相逢」', doc.querySelector('.heroine-zone')?.textContent === '萍水相逢',
      doc.querySelector('.heroine-zone')?.textContent ?? '无');
    check('默认人设：花期显示「一粒种子」', doc.querySelector('.bloom-name')?.textContent === '一粒种子',
      doc.querySelector('.bloom-name')?.textContent ?? '');
    check('默认人设：关系印章显示「初识」', (doc.querySelector('.heroine-seal')?.textContent ?? '').includes('初识'));
    check('默认人设：心跳显示 60', doc.querySelector('.pulse-figure')?.textContent === '心跳 60',
      doc.querySelector('.pulse-figure')?.textContent);
    check('默认人设：星图有且仅有一个标记', doc.querySelectorAll('.chart-marker').length === 1);
    check('默认人设：无历史楼层时不画足迹', !doc.querySelector('.chart-trail'));
    check('默认人设：无心声便签', !doc.querySelector('.heroine-voice'));
    check('默认人设：可在地图上定位她', Boolean(doc.querySelector('.heroine-locate')));
    const mapTab = Array.from(doc.querySelectorAll('.hud-tab')).find(tab => tab.textContent === '城市地图');
    mapTab?.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    await new Promise(resolve => setTimeout(resolve, 10));
    check('默认人设：地图上有唯一林清图钉', doc.querySelectorAll('.heroine-pin').length === 1);
  }

  if (scenarioName === '旧档未初始化') {
    check('开局时天气签仍渲染', Boolean(doc.querySelector('.snapshot-bar')));
    check('未初始化时地点显示「地点待设定」', doc.querySelector('[data-role="place"]')?.textContent === '地点待设定');
    doc.querySelector('.snapshot-bar')?.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    await new Promise(resolve => setTimeout(resolve, 10));
    const mapTab = Array.from(doc.querySelectorAll('.hud-tab')).find(tab => tab.textContent === '城市地图');
    mapTab?.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    await new Promise(resolve => setTimeout(resolve, 10));
    check('未初始化时地图仍全亮渲染', doc.querySelectorAll('.map-node').length === 19);
    check('未初始化时没有当前地点', !doc.querySelector('.map-node.is-current'));
    check('未初始化时提示等待第一段正文', (doc.querySelector('.map-hint')?.textContent ?? '').includes('第一段正文结束后'));
    check('未初始化时地图上没有林清图钉', !doc.querySelector('.heroine-pin'));
    await openCharacter('林清');
    check('林清待设定：星图无标记', Boolean(doc.querySelector('.star-chart')) && !doc.querySelector('.chart-marker'));
    check('林清待设定：花期显示「尚未播种」', doc.querySelector('.bloom-name')?.textContent === '尚未播种');
    check('林清待设定：关系印章显示「未定」', (doc.querySelector('.heroine-seal')?.textContent ?? '').includes('未定'));
    check('林清待设定：心跳显示占位', doc.querySelector('.pulse-figure')?.textContent === '心跳 —');
    check('林清待设定：无心声便签与定位按钮', !doc.querySelector('.heroine-voice') && !doc.querySelector('.heroine-locate'));
    // 旧档里没有苏玥的数据，列表与面板都走兜底
    click(doc.querySelector('.char-back'));
    await tick();
    check('旧档：苏玥显示未相遇态', doc.querySelector('.char-item[data-character="suyue"]')?.classList.contains('is-unmet') === true);
    click(Array.from(doc.querySelectorAll('.char-item')).find(item => item.dataset.character === 'suyue'));
    await tick();
    check('旧档：苏玥面板兜底「尚未播种」', doc.querySelector('.bloom-name')?.textContent === '尚未播种');
    check('旧档：苏玥图注为「紫藤花期」', (doc.querySelector('.heroine-bloom-box figcaption')?.textContent ?? '').includes('紫藤花期'));
  }

  if (scenarioName === '大雨') {
    check('大雨时外壳 data-weather 为 storm', doc.querySelector('.hud-shell')?.dataset.weather === 'storm',
      doc.querySelector('.hud-shell')?.dataset.weather ?? '无');
    check('快照条天气层标出大雨', doc.querySelector('.snapshot-weather')?.dataset.weather === '大雨',
      doc.querySelector('.snapshot-weather')?.dataset.weather ?? '无');
    await openPanel();
    await openTab('城市地图');
    const layer = doc.querySelector('.map-canvas .weather-layer');
    check('大雨时地图生成天气层', Boolean(layer));
    // 天气层必须在第一个地点之前，叠层上才压不住地点；
    // 否则密集雨丝会抢走地图点击与拖动手势。
    const node = doc.querySelector('.map-canvas .map-node');
    check(
      '天气层排在地点层之前',
      Boolean(layer) && Boolean(node) && Boolean(layer.compareDocumentPosition(node) & 4),
    );
    const drops = doc.querySelectorAll('.map-canvas .weather-drop');
    check('大雨雨丝 34 条', drops.length === 34, `实际 ${drops.length}`);
    check('雨丝带固定时长与延迟', (drops[0]?.getAttribute('style') ?? '').includes('--dur'));
    check('下大雨时不出现雪花', doc.querySelectorAll('.map-canvas .weather-flake').length === 0);
    await openCharacter('林清');
    // 花期面板也是整块画面跟着天气，不是往花瓣上贴水珠
    check('下雨时花期画面里落雨', doc.querySelectorAll('.bloom-svg .weather-drop').length >= 8,
      String(doc.querySelectorAll('.bloom-svg .weather-drop').length));
    check('花期画布自带雾絮渐变定义', Boolean(doc.querySelector('.bloom-svg defs #hud-mist-blob')));
    check('下雨时花期不出现雪花', doc.querySelectorAll('.bloom-svg .weather-flake').length === 0);
  }

  if (scenarioName === '下雪') {
    check('下雪时快照条天气层标出雪', doc.querySelector('.snapshot-weather')?.dataset.weather === '雪');
    await openPanel();
    await openTab('城市地图');
    const flakes = doc.querySelectorAll('.map-canvas .weather-flake');
    check('下雪时地图飘雪花 26 片', flakes.length === 26, `实际 ${flakes.length}`);
    check('雪花带横向飘移量', (flakes[0]?.getAttribute('style') ?? '').includes('--dx'));
    check('下雪时没有雨丝', doc.querySelectorAll('.map-canvas .weather-drop').length === 0);
    await openCharacter('林清');
    check('下雪时花期画面里飘雪', doc.querySelectorAll('.bloom-svg .weather-flake').length === 14,
      String(doc.querySelectorAll('.bloom-svg .weather-flake').length));
    check('下雪时花期不落雨', doc.querySelectorAll('.bloom-svg .weather-drop').length === 0);
    check('花期与关系星图共存', Boolean(doc.querySelector('.star-chart')));
  }

  if (scenarioName === '浓雾') {
    await openPanel();
    await openTab('城市地图');
    check('雾天地图生成雾絮', doc.querySelectorAll('.map-canvas .weather-mist').length === 4,
      String(doc.querySelectorAll('.map-canvas .weather-mist').length));
    check('雾絮用径向渐变而非实心色块',
      Boolean(doc.querySelector('.map-canvas defs #hud-mist-blob')));
    check('雾天没有雨雪粒子',
      doc.querySelectorAll('.map-canvas .weather-drop').length === 0
      && doc.querySelectorAll('.map-canvas .weather-flake').length === 0);
    await openCharacter('林清');
    check('雾天花期画面也有雾絮', doc.querySelectorAll('.bloom-svg .weather-mist').length === 4,
      String(doc.querySelectorAll('.bloom-svg .weather-mist').length));
  }

  if (scenarioName === '雷雨') {
    await openPanel();
    await openTab('城市地图');
    check('雷雨同时有雨丝', doc.querySelectorAll('.map-canvas .weather-drop').length === 26,
      String(doc.querySelectorAll('.map-canvas .weather-drop').length));
    check('雷雨带闪电', doc.querySelectorAll('.map-canvas .weather-bolt').length === 2,
      String(doc.querySelectorAll('.map-canvas .weather-bolt').length));
  }

  if (scenarioName === '并蒂足迹') {
    await openCharacter('林清');
    check('双高落在「双向奔赴」区', doc.querySelector('.heroine-zone')?.textContent === '双向奔赴');
    check('花期为「并蒂百合」', doc.querySelector('.bloom-name')?.textContent === '并蒂百合', doc.querySelector('.bloom-name')?.textContent);
    check('繁茂档长出分枝', Boolean(doc.querySelector('.bloom-stem.is-branch')));
    check('百合画布不带竹架', !doc.querySelector('.bloom-trellis'));
    const steps = doc.querySelectorAll('.chart-step').length;
    check('足迹跳过老存档与重复楼层，共 3 个点', steps === 3, `实际 ${steps}`);
    check('足迹连线存在', Boolean(doc.querySelector('.chart-trail')));
    check('星图标题写出足迹数', (doc.querySelector('.heroine-chart-box figcaption')?.textContent ?? '').includes('近 3 次足迹'));
    const chips = Array.from(doc.querySelectorAll('.delta-chip')).map(chip => chip.textContent).join('/');
    check('变化浮标为 亲近 +2 / 心动 +7', chips === '亲近 +2/心动 +7', chips);
    check('标记从上一楼位置滑向当前位置', Boolean(doc.querySelector('.chart-marker[data-to]')));
    check('上涨时不落花、不黄叶', !doc.querySelector('.bloom-fallen') && !doc.querySelector('.bloom-leaf-yellow'));
  }

  if (scenarioName === '早开落花') {
    await openCharacter('林清');
    check('亲近低心动高落在「暗涌」区', doc.querySelector('.heroine-zone')?.textContent === '暗涌');
    check('花期为「早开的花」', doc.querySelector('.bloom-name')?.textContent === '早开的花', doc.querySelector('.bloom-name')?.textContent);
    const chips = Array.from(doc.querySelectorAll('.delta-chip')).map(chip => chip.textContent).join('/');
    check('变化浮标为 亲近 −5 / 心动 −6', chips === '亲近 −5/心动 −6', chips);
    check('下降浮标标为 is-down', doc.querySelectorAll('.delta-chip.is-down').length === 2);
    check('心动下降时花瓣飘落', doc.querySelectorAll('.bloom-fallen').length === 3);
    check('亲近下降时叶尖变黄', doc.querySelectorAll('.bloom-leaf-yellow').length >= 1);
  }

  if (scenarioName === '藤瀑') {
    await openCharacter('苏玥');
    check('藤瀑：双高落在「双向奔赴」区', doc.querySelector('.heroine-zone')?.textContent === '双向奔赴');
    check('藤瀑：花期名为「紫藤垂瀑」', doc.querySelector('.bloom-name')?.textContent === '紫藤垂瀑',
      doc.querySelector('.bloom-name')?.textContent ?? '');
    check('藤瀑：满架生出侧藤', Boolean(doc.querySelector('.bloom-stem.is-branch')));
    check('藤瀑：垂穗画成三串', doc.querySelectorAll('.bloom-head').length === 3,
      String(doc.querySelectorAll('.bloom-head').length));
    check('藤瀑：紫藤带竹架与卷须', doc.querySelectorAll('.bloom-trellis').length === 2 && doc.querySelectorAll('.bloom-tendril').length >= 1);
    check('藤瀑：不出现百合花心', !doc.querySelector('.bloom-center'));
    check('藤瀑：花穗有绽开的紫花与未开花苞', doc.querySelectorAll('.bloom-petal').length >= 6 && doc.querySelectorAll('.bloom-bud').length >= 2);
  }

  if (errors.length) failures.push(...errors.map(error => `  ✗ 运行时异常: ${error}`));

  // 产物里每层 iframe 都会挂 window.pagehide，这里手动触发一次释放路径
  window.dispatchEvent(new window.Event('pagehide'));
  dom.window.close();
}

console.log('状态栏产物无头验证\n');

// 手机界面验证
async function runPhone() {
  const phoneDist = path.join(here, 'dist/YuriOpening/界面/手机/index.html');
  check('手机界面产物存在', fs.existsSync(phoneDist), phoneDist);

  const phoneBuilt = fs.readFileSync(phoneDist, 'utf8');
  const phoneScriptMatch = phoneBuilt.match(/<script type="module">([\s\S]*?)<\/script>/);
  const phoneStyleText = phoneBuilt.match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? '';
  check('手机界面含内联脚本', Boolean(phoneScriptMatch));
  // 手机模块用 ?raw 导入 CSS，样式内嵌在 JS 字符串里运行时注入宿主 head，HTML 里不存在 <style> 标签。
  // 改为验证内联脚本里含有 phone-root-style 注入逻辑。
  check('手机界面样式已内嵌（phone-root-style）', (phoneScriptMatch?.[1] ?? '').includes('phone-root-style'));

  if (!phoneScriptMatch) return;

  const dom = new JSDOM(
    `<!DOCTYPE html><html><head><style>${phoneStyleText}</style></head><body><div id="phone-root"></div></body></html>`,
    { runScripts: 'outside-only', pretendToBeVisual: true, url: 'https://local.test/' },
  );
  const { window } = dom;
  const errors = [];
  window.addEventListener('error', event => errors.push(String(event.error ?? event.message)));

  const mockVars = {
    微信: { _已添加林清: false, _未读数: 0, _林清已知事件: '', _聊天摘要历史: [], _朋友圈: [] },
    林清: { 关系身份: '初识', 亲近: 10, 心动: 5 },
    玩家: { _名字: '测试用户' },
  };
  window.getVariables = () => ({ stat_data: mockVars });
  window.getCurrentMessageId = () => 0;
  window.waitGlobalInitialized = () => Promise.resolve();
  window.eventOn = () => ({ stop() {} });
  window.errorCatched = fn => () => {
    try {
      const result = fn();
      if (result && typeof result.catch === 'function') result.catch(e => errors.push(String(e)));
      return result;
    } catch (e) { errors.push(String(e)); }
  };
  window.triggerSlash = () => Promise.resolve('');
  window.setInterval = () => 0;
  window.clearInterval = () => {};
  const mvuState = {
    initialized_lorebooks: {},
    stat_data: {
      玩家: { _姓名: '测试用户' },
      林清: { 关系身份: '朋友', 亲近: 30, 心动: 10, 心情: '愉快', 所在地点: '蔷薇文化传媒' },
      微信: {
        _已添加林清: true,
        _未读数: 2,
       
        _林清已知事件: '',
        _聊天摘要历史: [],
        _朋友圈: [
          { 内容: '加班到深夜', 时间: '2026-10-07', 心情: '低落', 点赞数: 0 },
          { 内容: '今天的风很好', 时间: '2026-10-08', 心情: '愉快', 点赞数: 1 },
        ],
      },
    },
  };
  let replaceMvuCount = 0;
  window.Mvu = {
    events: { VARIABLE_INITIALIZED: 'init', VARIABLE_UPDATE_ENDED: 'ended' },
    getMvuData: () => mvuState,
    replaceMvuData: () => { replaceMvuCount += 1; return Promise.resolve(); },
  };
  window.SillyTavern = { characterId: 'test', getCurrentChatId: () => 'test-chat' };
  window.fetch = () => Promise.reject(new Error('mock: no network'));
  window.tavern_events = { CHAT_CHANGED: 'chat_id_changed' };
  window.$ = arg => {
    if (typeof arg === 'function') { arg(); return window.$; }
    return { one() { return this; }, on() { return this; }, off() { return this; } };
  };
  window._ = {
    get(obj, p, fallback) {
      const parts = Array.isArray(p) ? p.map(String) : String(p).replace(/\[(\d+)\]/g, '.$1').split('.').filter(Boolean);
      let cur = obj;
      for (const k of parts) { if (cur == null) return fallback; cur = cur[k]; }
      return cur === undefined ? fallback : cur;
    },
    has(obj, p) { return this.get(obj, p, undefined) !== undefined; },
    clamp: (v, lo, hi) => Math.min(Math.max(v, lo), hi),
  };

  const source = phoneScriptMatch[1];
  const factory = new Function('window', 'document', 'globalThis',
    `with (window) { (function(){ ${source}\n})(); }`);
  factory(window, window.document, window);

  await new Promise(r => setTimeout(r, 0));
  await new Promise(r => setTimeout(r, 30));

  const doc = window.document;
  const fab = doc.querySelector('.phone-fab');
  check('悬浮按鈕 .phone-fab 已挂载', Boolean(fab));
  // 外壳初始未添加 is-open class，表示隐藏状态（jsdom 不解析 CSS，用 class 判断）
  const shellEl = doc.querySelector('.phone-shell');
  check('初始状态手机外壳未展开', !shellEl?.classList.contains('is-open'));

  if (fab) {
    fab.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    await new Promise(r => setTimeout(r, 30));
    const shell = doc.querySelector('.phone-shell');
    check('点击 FAB 后外壳添加 is-open', shell?.classList.contains('is-open'));
    check('手机外壳含底部导航栏 .phone-navbar', Boolean(doc.querySelector('.phone-navbar')));
    check('内容区 .phone-content 已渲染内容', (doc.querySelector('.phone-content')?.children.length ?? 0) > 0);
  }

  // 悬浮按钮拖动能力：位置更新、持久化、拖动后不误触开合、微动仍算点击
  if (fab) {
    const storeKey = 'YuriOpening:phone:fab-pos:v1';
    const pd = new window.Event('pointerdown', { bubbles: true });
    pd.pointerId = 1; pd.clientX = 100; pd.clientY = 100; pd.button = 0; pd.pointerType = 'mouse';
    fab.dispatchEvent(pd);
    const pm = new window.Event('pointermove', { bubbles: true });
    pm.pointerId = 1; pm.clientX = 200; pm.clientY = 200;
    fab.dispatchEvent(pm);
    check('拖动中 FAB 带 is-dragging', fab.classList.contains('is-dragging'));
    check(
      '拖动后 FAB 位置更新（100,100）',
      fab.style.left === '100px' && fab.style.top === '100px',
      `${fab.style.left},${fab.style.top}`,
    );
    const pu = new window.Event('pointerup', { bubbles: true });
    pu.pointerId = 1;
    fab.dispatchEvent(pu);
    check('拖动结束移除 is-dragging', !fab.classList.contains('is-dragging'));
    let savedPos = null;
    try { savedPos = JSON.parse(window.localStorage.getItem(storeKey) ?? 'null'); } catch { /* ignore */ }
    check(
      '拖动位置已持久化',
      savedPos !== null && typeof savedPos.left === 'number' && typeof savedPos.top === 'number',
      JSON.stringify(savedPos),
    );

    const wasOpen = doc.querySelector('.phone-shell')?.classList.contains('is-open') ?? false;
    fab.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    check(
      '拖动后的 click 被抑制',
      (doc.querySelector('.phone-shell')?.classList.contains('is-open') ?? false) === wasOpen,
    );

    const posBefore = fab.style.left;
    const pd2 = new window.Event('pointerdown', { bubbles: true });
    pd2.pointerId = 2; pd2.clientX = 300; pd2.clientY = 300; pd2.button = 0; pd2.pointerType = 'mouse';
    fab.dispatchEvent(pd2);
    const pm2 = new window.Event('pointermove', { bubbles: true });
    pm2.pointerId = 2; pm2.clientX = 302; pm2.clientY = 301;
    fab.dispatchEvent(pm2);
    const pu2 = new window.Event('pointerup', { bubbles: true });
    pu2.pointerId = 2;
    fab.dispatchEvent(pu2);
    fab.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    await new Promise(r => setTimeout(r, 30));
    check(
      '微动（<5px）仍视为点击',
      (doc.querySelector('.phone-shell')?.classList.contains('is-open') ?? false) !== wasOpen,
    );
    check('微动不改变位置、无拖动残留', fab.style.left === posBefore && !fab.classList.contains('is-dragging'));
    // 恢复外壳开合状态，避免影响后续断言
    fab.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    await new Promise(r => setTimeout(r, 30));
  }

  // 全屏外壳 / 关闭按钮 / 表情面板
  check('脚本含全屏与键盘适配特征', source.includes('visualViewport') && source.includes('9200'));
  const closeBtnEl = doc.querySelector('.phone-close-btn');
  check('关闭按钮 .phone-close-btn 存在', Boolean(closeBtnEl));
  if (closeBtnEl && fab) {
    const wasOpenClose = doc.querySelector('.phone-shell')?.classList.contains('is-open') ?? false;
    closeBtnEl.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    check(
      '点击关闭按钮后外壳收起',
      wasOpenClose && !(doc.querySelector('.phone-shell')?.classList.contains('is-open') ?? false),
    );
    fab.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    await new Promise(r => setTimeout(r, 30));
    check('点击悬浮按钮重新打开外壳', doc.querySelector('.phone-shell')?.classList.contains('is-open') ?? false);
  }

  // 视口适配：窗口 resize 通道 + 聚焦轮询兜底
  const shellElVp = doc.querySelector('.phone-shell');
  if (shellElVp) {
    shellElVp.style.height = '';
    window.dispatchEvent(new window.Event('resize'));
    check('窗口 resize 触发外壳视口适配', shellElVp.style.height !== '', shellElVp.style.height);
    shellElVp.style.height = '';
    doc.dispatchEvent(new window.Event('focusin', { bubbles: true }));
    await new Promise(r => setTimeout(r, 200));
    check('聚焦触发视口轮询兜底', shellElVp.style.height !== '', shellElVp.style.height);
  }
  check('脚本含四通道视口适配特征', source.includes('visualViewport') && source.includes('focusin') && source.includes('focusout'));

  // 预置聊天历史：表情消息应放大渲染
  try {
    window.localStorage.setItem(
      'YuriOpening:phone:test-chat:chat-history:v1',
      JSON.stringify([
        { role: 'assistant', content: '😏' },
        { role: 'user', content: '哈哈哈哈' },
        { role: 'user', content: '(￣▽￣)' },
      ]),
    );
  } catch { /* ignore */ }

  const chatItems = doc.querySelectorAll('.wc-chat-item');
  check('聊天列表有可进入的会话', chatItems.length >= 1);
  chatItems[0]?.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await new Promise(r => setTimeout(r, 50));
  check('进入聊天页 .wc-chatpage', Boolean(doc.querySelector('.wc-chatpage')));
  const emojiBubbles = doc.querySelectorAll('.wc-bubble.is-emoji');
  check('表情消息放大渲染 ×2', emojiBubbles.length === 2, String(emojiBubbles.length));
  check(
    '纯文字消息不放大',
    ![...doc.querySelectorAll('.wc-bubble')].some(b => b.textContent === '哈哈哈哈' && b.classList.contains('is-emoji')),
  );
  const emojiBtnEl = doc.querySelector('.wc-emoji-btn');
  const chatInput = doc.querySelector('.wc-input');
  check('聊天页有表情按钮', Boolean(emojiBtnEl));
  check('聊天页有输入框', Boolean(chatInput));
  if (emojiBtnEl && chatInput) {
    emojiBtnEl.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    check('表情面板已打开', doc.querySelector('.wc-emoji-panel')?.classList.contains('is-open') ?? false);
    const firstEmoji = doc.querySelector('.wc-emoji-item');
    check('表情网格有内容', Boolean(firstEmoji), firstEmoji?.textContent ?? '');
    if (firstEmoji) {
      const emojiChar = firstEmoji.textContent ?? '';
      firstEmoji.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
      check('点选 emoji 插入输入框', emojiChar !== '' && chatInput.value.includes(emojiChar));
    }
    const kaoTab = [...doc.querySelectorAll('.wc-emoji-mode')].find(b => b.textContent === '颜文字');
    check('有颜文字切换按钮', Boolean(kaoTab));
    kaoTab?.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    await new Promise(r => setTimeout(r, 20));
    const kaoItem = doc.querySelector('.wc-emoji-item');
    check('颜文字网格有内容', Boolean(kaoItem), kaoItem?.textContent ?? '');
    if (kaoItem) {
      const kaoText = kaoItem.textContent ?? '';
      kaoItem.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
      check('点选颜文字插入输入框', kaoText !== '' && chatInput.value.includes(kaoText));
    }
  }
  try { window.localStorage.removeItem('YuriOpening:phone:test-chat:chat-history:v1'); } catch { /* ignore */ }

  // 通讯录：加好友状态（熟人可加 / 初识也会给按钮，拒绝发生在点击后；
  // 详细行为由 verify-phone.mjs 覆盖，这里只验证入口存在）
  const tabsAll = [...doc.querySelectorAll('.phone-tab')];
  const contactsTabBtn = tabsAll.find(b => b.textContent?.includes('通讯录'));
  const chatTabBtn = tabsAll.find(b => b.textContent?.includes('微信'));
  check('底部导航含微信/通讯录页签', Boolean(chatTabBtn) && Boolean(contactsTabBtn));
  mvuState.stat_data.微信._已添加林清 = false;
  try {
    window.localStorage.removeItem('YuriOpening:phone:test-chat:hasAdded:v1');
    window.localStorage.removeItem('YuriOpening:phone:test-chat:addRejected:v1');
  } catch { /* ignore */ }
  // 前面进过聊天页，模块内的 localHasAdded 已被置 true，本轮清存储也回不去；
  // 所以这里不断言按钮/徽标的形态，只验证入口渲染出来（具体行为见 verify-phone.mjs）。
  mvuState.stat_data.林清.关系身份 = '熟人';
  contactsTabBtn?.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await new Promise(r => setTimeout(r, 20));
  const search1 = doc.querySelector('.wc-search-input');
  check('通讯录搜索框存在', Boolean(search1));
  if (search1) {
    search1.value = '林清';
    search1.dispatchEvent(new window.Event('input', { bubbles: true }));
    await new Promise(r => setTimeout(r, 10));
    check('搜索后渲染出林清卡片', (doc.querySelector('.wc-search-card')?.textContent ?? '').includes('林清'));
    check(
      '好友入口为按钮或已添加徽标之一',
      Boolean(doc.querySelector('.wc-add-btn')) || Boolean(doc.querySelector('.wc-badge-added')),
      doc.querySelector('.wc-search-card')?.textContent ?? '无卡片',
    );
  } else {
    failures.push('  ✗ 通讯录搜索框缺失，无法验证加好友入口');
  }

  mvuState.stat_data.林清.关系身份 = '初识';
  chatTabBtn?.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await new Promise(r => setTimeout(r, 20));
  contactsTabBtn?.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await new Promise(r => setTimeout(r, 20));
  const search2 = doc.querySelector('.wc-search-input');
  if (search2) {
    search2.value = '林清';
    search2.dispatchEvent(new window.Event('input', { bubbles: true }));
    await new Promise(r => setTimeout(r, 10));
    // 关系不到位也给出可点按钮，拒绝发生在点击之后
    check(
      '初识关系下好友入口仍可用',
      Boolean(doc.querySelector('.wc-add-btn'))
        || Boolean(doc.querySelector('.wc-badge-added'))
        || (doc.querySelector('.wc-add-btn')?.disabled === false),
      doc.querySelector('.wc-search-card')?.textContent ?? '无卡片',
    );
  }
  // 恢复 mock 状态，避免影响后续断言
  mvuState.stat_data.微信._已添加林清 = true;
  mvuState.stat_data.林清.关系身份 = '朋友';

  // 朋友圈页：渲染已有动态 + 点赞写回
  const tabs = doc.querySelectorAll('.phone-tab');
  const settingsTabBtn = tabsAll.find(b => b.textContent?.includes('设置'));
  if (settingsTabBtn) {
    settingsTabBtn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    await new Promise(r => setTimeout(r, 20));
    const diagEl = doc.querySelector('.wc-viewport-diag');
    check('设置页渲染键盘诊断面板', Boolean(diagEl));
    check('键盘诊断面板含屏幕/可视信息', (diagEl?.textContent ?? '').includes('屏幕'));
  }
  tabs[2]?.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await new Promise(r => setTimeout(r, 30));
  const momentCards = doc.querySelectorAll('.wc-moment-card');
  check('朋友圈渲染已有动态', momentCards.length === 2);
  check('朋友圈最新动态排最前', momentCards[0]?.querySelector('.wc-moment-text')?.textContent === '今天的风很好');
  const likeBtn = momentCards[0]?.querySelector('.wc-action-btn');
  if (likeBtn) {
    likeBtn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    await new Promise(r => setTimeout(r, 10));
    check('点赞后 MVU 中点赞数 +1', mvuState.stat_data.微信._朋友圈[1]?.点赞数 === 2);
    check('点赞后界面数字更新', momentCards[0]?.querySelector('.wc-like-count')?.textContent === '2');
    check('点赞经 replaceMvuData 写回', replaceMvuCount >= 1);
    check('点赞后重渲仍显示 2', doc.querySelector('.wc-like-count')?.textContent === '2');
  }

  if (errors.length) failures.push(...errors.map(e => `  ✗ 手机界面运行时异常: ${e}`));
  window.dispatchEvent(new window.Event('pagehide'));
  dom.window.close();
}

console.log('【手机界面】');
const phoneFailBefore = failures.length;
await runPhone();
notes.forEach(line => console.log(line));
notes.length = 0;
if (failures.length === phoneFailBefore) console.log('  全部通过');
console.log();


for (const [name, scenario] of Object.entries(scenarios)) {
  console.log(`【${name}】`);
  const before = failures.length;
  await run(name, scenario);
  notes.forEach(line => console.log(line));
  notes.length = 0;
  if (failures.length === before) console.log('  全部通过');
  console.log();
}

if (failures.length) {
  console.log('失败项:');
  failures.forEach(line => console.log(line));
  process.exitCode = 1;
} else {
  console.log('结论: 所有断言通过，产物在 DOM 环境下可正常渲染与交互。');
}
