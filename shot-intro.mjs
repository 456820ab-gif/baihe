#!/usr/bin/env node
/**
 * shot-intro.mjs —— 驱动容器内 chromium 打开「介绍页预览」与「开局表单预览」，真实点击验证并截图。
 *
 * 验证：介绍页默认双绿灯、环境控制切红灯/回绿灯、清理走两段式确认并落到「清空停用」、
 * 开始按钮触发 /swipe 说明；开局表单预览默认直达表单本体（无介绍页）。
 * 截图：介绍页桌面 820 宽与手机 390 宽各一张，表单一张。
 *
 * 用法：node shot-intro.mjs [输出前缀]
 * 默认输出 /tmp/intro-desktop.png、/tmp/intro-mobile.png、/tmp/form-body.png。
 *
 * 依赖（容器重装后需重装）：apk add chromium chromium-swiftshader font-noto-cjk
 */
import { spawn } from 'node:child_process';
import { mkdtempSync, existsSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const previewsDir = resolve(process.env.HOME ?? '/root', 'workspace/cards/YuriOpening/预览');
const introPage = join(previewsDir, '介绍页预览.html');
const formPage = join(previewsDir, '开局表单预览.html');
const prefix = process.argv[2] ?? '/tmp/intro';

for (const file of [introPage, formPage]) {
  if (!existsSync(file)) {
    console.error(`找不到预览页: ${file}\n先跑 build-preview.mjs 生成。`);
    process.exit(1);
  }
}

const profile = mkdtempSync(join(tmpdir(), 'intro-cdp-'));
const port = 9600 + (process.pid % 300);
const width = 820;
const height = 2200;

const browser = spawn('chromium', [
  '--headless=new',
  '--no-sandbox',
  '--disable-gpu',
  '--disable-dev-shm-usage',
  '--use-gl=angle',
  '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader',
  '--hide-scrollbars',
  '--no-first-run',
  '--no-default-browser-check',
  `--user-data-dir=${profile}`,
  `--remote-debugging-port=${port}`,
  `--window-size=${width},${height}`,
], { stdio: ['ignore', 'pipe', 'pipe'] });
browser.stderr.on('data', () => {});

const sleep = ms => new Promise(done => setTimeout(done, ms));

async function waitForTarget(timeoutMs = 25_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`);
      const targets = await response.json();
      const page = targets.find(item => item.type === 'page');
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
    } catch { /* 等浏览器起来 */ }
    await sleep(200);
  }
  throw new Error('等不到 chromium 调试端口');
}

const connect = url => new Promise((ready, fail) => {
  const socket = new WebSocket(url);
  socket.addEventListener('open', () => ready(socket), { once: true });
  socket.addEventListener('error', () => fail(new Error('CDP 连接失败')), { once: true });
});

let nextId = 1;
const send = (socket, method, params = {}) => {
  const id = nextId++;
  return new Promise((done, fail) => {
    const onMessage = event => {
      const payload = JSON.parse(String(event.data));
      if (payload.id !== id) return;
      socket.removeEventListener('message', onMessage);
      if (payload.error) fail(new Error(`${method}: ${payload.error.message}`));
      else done(payload.result);
    };
    socket.addEventListener('message', onMessage);
    socket.send(JSON.stringify({ id, method, params }));
  });
};

const evaluate = async (socket, expression) => {
  const result = await send(socket, 'Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? '页面脚本执行出错');
  return result.result.value;
};

/** 真实命中测试点击：先滚到视口内，再在中心点按下抬起 */
async function clickAt(socket, sel) {
  await evaluate(socket, `(()=>{const el=document.querySelector(${JSON.stringify(sel)});if(el)el.scrollIntoView({block:'center'})})()`);
  await sleep(120);
  const rect = await evaluate(socket, `(()=>{
    const el = document.querySelector(${JSON.stringify(sel)});
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width, h: r.height };
  })()`);
  if (!rect) throw new Error(`找不到元素 ${sel}`);
  await send(socket, 'Input.dispatchMouseEvent', { type: 'mousePressed', x: rect.x, y: rect.y, button: 'left', clickCount: 1 });
  await send(socket, 'Input.dispatchMouseEvent', { type: 'mouseReleased', x: rect.x, y: rect.y, button: 'left', clickCount: 1 });
}

const shot = async (socket, path, canvasWidth) => {
  await evaluate(socket, `window.scrollTo(0,0)`);
  // 先把视口收矮，避免内容的 min-height:100vh 把滚动高度撑大（预览只在排版尺寸上做文章）
  await send(socket, 'Emulation.setDeviceMetricsOverride', {
    width: canvasWidth,
    height: 780,
    deviceScaleFactor: 2,
    mobile: canvasWidth < 500,
  });
  await sleep(300);
  const scrollHeight = await evaluate(socket, `document.documentElement.scrollHeight`);
  await send(socket, 'Emulation.setDeviceMetricsOverride', {
    width: canvasWidth,
    height: Math.min(2600, scrollHeight + 40),
    deviceScaleFactor: 2,
    mobile: canvasWidth < 500,
  });
  await sleep(350);
  const result = await send(socket, 'Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
  writeFileSync(path, Buffer.from(result.data, 'base64'));
  console.log(`  截图 ${path}（${canvasWidth}×${Math.min(2600, scrollHeight + 40)}）`);
};

const checks = [];
const check = (label, ok, detail = '') => {
  checks.push({ label, ok, detail });
  console.log(`  ${ok ? '✓' : '✗'} ${label}${detail && !ok ? ` — ${detail}` : ''}`);
};

let socket;
try {
  const wsUrl = await waitForTarget();
  socket = await connect(wsUrl);
  await send(socket, 'Page.enable');
  await send(socket, 'Runtime.enable');
  await send(socket, 'Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 2, mobile: false });

  const load = async url => {
    const loaded = new Promise(done => {
      const onMessage = event => {
        const payload = JSON.parse(String(event.data));
        if (payload.method === 'Page.loadEventFired') {
          socket.removeEventListener('message', onMessage);
          done();
        }
      };
      socket.addEventListener('message', onMessage);
    });
    await send(socket, 'Page.navigate', { url: `file://${url}` });
    await loaded;
    await sleep(900);
  };

  // ── 介绍页 ────────────────────────────────────────────────────────────
  console.log('介绍页预览：');
  await load(introPage);

  check('介绍页已挂载', await evaluate(socket, `Boolean(document.querySelector('.intro-shell'))`));
  const cardState = () => evaluate(socket, `[...document.querySelectorAll('.check-card')].map(c=>c.className)`);
  let cards = await cardState();
  check('默认双绿灯', cards.length === 2 && cards.every(name => name.includes('is-ok')), JSON.stringify(cards));
  const links = await evaluate(socket, `[...document.querySelectorAll('.link-card')].map(a=>a.getAttribute('href'))`);
  check('两个跳转链接', links[0] === 'https://discord.gg/bxglyj' && links[1] === 'https://discord.com/channels/1380075940285124724/1558070474104377364', JSON.stringify(links));

  await clickAt(socket, '.preview-bar button[data-env="none"]');
  await sleep(300);
  cards = await cardState();
  check('切「双红灯」后如实变红', cards.length === 2 && cards.every(name => name.includes('is-missing')), JSON.stringify(cards));
  await clickAt(socket, '.preview-bar button[data-env="half"]');
  await sleep(300);
  cards = await cardState();
  check('切「只装助手」一绿一红', cards[0]?.includes('is-ok') === true && cards[1]?.includes('is-missing') === true, JSON.stringify(cards));
  await clickAt(socket, '.preview-bar button[data-env="full"]');
  await sleep(300);
  cards = await cardState();
  check('切回双绿灯', cards.every(name => name.includes('is-ok')), JSON.stringify(cards));

  await clickAt(socket, '.cleanup-button');
  await sleep(250);
  check('清理第一次点击进入确认态', await evaluate(socket, `document.querySelector('.cleanup-button')?.classList.contains('is-confirm') === true`));
  await clickAt(socket, '.cleanup-button');
  await sleep(500);
  const cleanupStatus = await evaluate(socket, `document.querySelector('.cleanup-status')?.textContent ?? ''`);
  check('清理结果反馈', cleanupStatus.includes('清理完成') && cleanupStatus.includes('世界书「微信记录」已清空并停用'), cleanupStatus);
  const staleKeys = await evaluate(socket, `Object.keys(localStorage).filter(k=>k.startsWith('YuriOpening:phone:')&&k.includes('old-chat'))`);
  check('旧本地记录已清掉', Array.isArray(staleKeys) && staleKeys.length === 0, JSON.stringify(staleKeys));
  const keptConfig = await evaluate(socket, `localStorage.getItem('YuriOpening:phone:ai-config:v1') !== null`);
  check('接口配置被保留', keptConfig === true);

  await clickAt(socket, '.intro-start');
  await sleep(300);
  const swipeNote = await evaluate(socket, `(()=>{const n=document.getElementById('swipe-note');return {hidden:n?n.hidden:null,text:n?n.textContent:''}})()`);
  check('开始按钮触发划动说明', swipeNote.hidden === false && swipeNote.text.includes('/swipe'), JSON.stringify(swipeNote));
  const startState = await evaluate(socket, `(()=>{const b=document.querySelector('.intro-start');return {disabled:b?.hasAttribute('disabled'),text:b?.textContent}})()`);
  check('按钮进入「正在进入…」', startState.disabled === true && String(startState.text).includes('正在进入'), JSON.stringify(startState));

  await shot(socket, `${prefix}-desktop.png`, width);
  await shot(socket, `${prefix}-mobile.png`, 390);

  // ── 开局表单 ──────────────────────────────────────────────────────────
  console.log('开局表单预览：');
  await send(socket, 'Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 2, mobile: false });
  await load(formPage);

  check('表单直接渲染（无介绍页）', await evaluate(socket, `Boolean(document.querySelector('.stepper')) && !document.querySelector('.intro-panel')`));
  check('停在第一步 · 身份页', await evaluate(socket, `Boolean(document.querySelector('input[placeholder="例如：林栖"]'))`));
  check('未提交时不出现锁定面板', await evaluate(socket, `!document.querySelector('.locked-panel')`));

  await shot(socket, `${prefix}-form.png`, width);

  // 步进器只能回退，前进走表单的「继续」：先填名字再点提交式按钮
  await evaluate(socket, `(()=>{
    const input = document.querySelector('input[placeholder="例如：林栖"]');
    input.value = '林栖';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  })()`);
  await sleep(150);
  await clickAt(socket, '.form-actions .primary-button');
  await sleep(500);
  const stepIndex = await evaluate(socket, `[...document.querySelectorAll('.step-item')].findIndex(item=>item.classList.contains('active'))`);
  check('填名字后「继续」可进第二步', stepIndex === 1, String(stepIndex));

  const failed = checks.filter(item => !item.ok);
  console.log(failed.length ? `\n❌ ${failed.length}/${checks.length} 项未通过` : `\n✅ 全部 ${checks.length} 项通过`);
  process.exitCode = failed.length ? 1 : 0;
} finally {
  try { socket?.close(); } catch { /* 忽略 */ }
  browser.kill('SIGKILL');
}
