#!/usr/bin/env node
/**
 * shot-phone.mjs —— 驱动容器内 chromium 打开手机预览页，截「全屏 / 小窗」两种模式，
 * 并顺带验证：切换按钮真实可点、模式写入 localStorage、重新加载后保持。
 *
 * 用法：
 *   node shot-phone.mjs [输出前缀]
 * 默认输出 /tmp/phone-full.png 与 /tmp/phone-mini.png。
 *
 * 依赖（容器重装后需重装）：apk add chromium chromium-swiftshader font-noto-cjk
 */
import { spawn } from 'node:child_process';
import { mkdtempSync, existsSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const PREVIEW = process.env.PHONE_PREVIEW
  ?? resolve(process.env.HOME ?? '/root', 'workspace/cards/YuriOpening/预览/手机预览.html');
const prefix = process.argv[2] ?? '/tmp/phone';
const width = Number(process.env.PHONE_W ?? 390);
const height = Number(process.env.PHONE_H ?? 844);
const scale = Number(process.env.PHONE_S ?? 2);

if (!existsSync(PREVIEW)) {
  console.error(`找不到预览页: ${PREVIEW}\n先跑 build-preview.mjs 生成。`);
  process.exit(1);
}

const profile = mkdtempSync(join(tmpdir(), 'phone-cdp-'));
const port = 9600 + (process.pid % 300);

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

/** 真实命中测试点击：目标中心点按下抬起，走浏览器的命中管线 */
async function clickAt(socket, sel) {
  const rect = await evaluate(socket, `(()=>{
    const el = document.querySelector(${JSON.stringify(sel)});
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width, h: r.height };
  })()`);
  if (!rect) throw new Error(`找不到元素 ${sel}`);
  await send(socket, 'Input.dispatchMouseEvent', { type: 'mousePressed', x: rect.x, y: rect.y, button: 'left', clickCount: 1 });
  await send(socket, 'Input.dispatchMouseEvent', { type: 'mouseReleased', x: rect.x, y: rect.y, button: 'left', clickCount: 1 });
  return rect;
}

const shot = async (socket, path) => {
  const result = await send(socket, 'Page.captureScreenshot', { format: 'png' });
  writeFileSync(path, Buffer.from(result.data, 'base64'));
};

let socket;
try {
  const wsUrl = await waitForTarget();
  socket = await connect(wsUrl);
  await send(socket, 'Page.enable');
  await send(socket, 'Runtime.enable');
  await send(socket, 'Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: scale, mobile: true });

  const load = async () => {
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
    await send(socket, 'Page.navigate', { url: `file://${PREVIEW}` });
    await loaded;
    await sleep(700);
  };

  await load();
  if (!(await evaluate(socket, `Boolean(document.querySelector('.phone-fab'))`))) {
    throw new Error('找不到悬浮按钮，预览页可能变了结构');
  }

  // 打开手机（真实点击）
  await clickAt(socket, '.phone-fab');
  await sleep(700);
  const openedFull = await evaluate(socket, `document.querySelector('.phone-shell')?.classList.contains('is-open')`);
  const fullRect = await evaluate(socket, `(()=>{const r=document.querySelector('.phone-shell')?.getBoundingClientRect();return r?{x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width),h:Math.round(r.height)}:null})()`);
  console.log(`打开手机: is-open=${openedFull} 外壳=${JSON.stringify(fullRect)}`);
  await shot(socket, `${prefix}-full.png`);

  // 切到小窗
  await clickAt(socket, '.phone-mode-btn');
  await sleep(500);
  const miniState = await evaluate(socket, `(()=>{
    const shell = document.querySelector('.phone-shell');
    const r = shell?.getBoundingClientRect();
    return {
      mini: shell?.classList.contains('is-mini'),
      rect: r ? {x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width),h:Math.round(r.height)} : null,
      stored: localStorage.getItem('YuriOpening:phone:shell-mode:v1'),
      label: document.querySelector('.phone-mode-btn')?.getAttribute('aria-label'),
    };
  })()`);
  console.log(`切到小窗: mini=${miniState.mini} 外壳=${JSON.stringify(miniState.rect)} 已存=${miniState.stored} 提示=${miniState.label}`);
  await shot(socket, `${prefix}-mini.png`);

  // 按住顶部状态栏拖动：+40 / +24（分两步移动，模拟真实拖拽轨迹）
  const beforeDrag = await evaluate(socket, `(()=>{const r=document.querySelector('.phone-shell')?.getBoundingClientRect();return r?{x:Math.round(r.x),y:Math.round(r.y)}:null})()`);
  const barCenter = await evaluate(socket, `(()=>{const r=document.querySelector('.phone-status-bar')?.getBoundingClientRect();return r?{x:r.x+r.width/2,y:r.y+r.height/2}:null})()`);
  await send(socket, 'Input.dispatchMouseEvent', { type: 'mousePressed', x: barCenter.x, y: barCenter.y, button: 'left', buttons: 1, clickCount: 1 });
  await send(socket, 'Input.dispatchMouseEvent', { type: 'mouseMoved', x: barCenter.x + 20, y: barCenter.y + 12, button: 'none', buttons: 1 });
  await send(socket, 'Input.dispatchMouseEvent', { type: 'mouseMoved', x: barCenter.x + 40, y: barCenter.y + 24, button: 'none', buttons: 1 });
  await send(socket, 'Input.dispatchMouseEvent', { type: 'mouseReleased', x: barCenter.x + 40, y: barCenter.y + 24, button: 'left', buttons: 0, clickCount: 1 });
  await sleep(300);
  const afterDrag = await evaluate(socket, `(()=>{
    const r = document.querySelector('.phone-shell')?.getBoundingClientRect();
    return { x: r?Math.round(r.x):null, y: r?Math.round(r.y):null, stored: localStorage.getItem('YuriOpening:phone:shell-pos:v1') };
  })()`);
  const dragDx = afterDrag.x - beforeDrag.x;
  const dragDy = afterDrag.y - beforeDrag.y;
  console.log(`拖动: Δx=${dragDx} Δy=${dragDy} 已存=${afterDrag.stored}`);
  await shot(socket, `${prefix}-dragged.png`);

  // 重载后保持小窗与位置
  await load();
  await clickAt(socket, '.phone-fab');
  await sleep(700);
  const persisted = await evaluate(socket, `(()=>{
    const shell = document.querySelector('.phone-shell');
    const r = shell?.getBoundingClientRect();
    return { mini: shell?.classList.contains('is-mini'), rect: r ? {x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width),h:Math.round(r.height)} : null };
  })()`);
  console.log(`重载后重开: mini=${persisted.mini} 外壳=${JSON.stringify(persisted.rect)}`);
  await shot(socket, `${prefix}-persist.png`);

  const ok = openedFull === true
    && miniState.mini === true && miniState.stored === 'mini'
    && miniState.rect?.w === 255 && miniState.rect?.h === 480
    && Math.abs(dragDx - 40) <= 2 && Math.abs(dragDy - 24) <= 2
    && typeof afterDrag.stored === 'string' && afterDrag.stored.includes('left')
    && persisted.mini === true && persisted.rect?.w === 255 && persisted.rect?.h === 480
    && Math.abs((persisted.rect?.x ?? -9999) - afterDrag.x) <= 2
    && Math.abs((persisted.rect?.y ?? -9999) - afterDrag.y) <= 2;
  console.log(ok ? '✅ 双模式、拖动与持久化验证通过' : '❌ 验证未通过，检查上面的读数');
  process.exitCode = ok ? 0 : 1;
} finally {
  try { socket?.close(); } catch { /* 忽略 */ }
  browser.kill('SIGKILL');
}
