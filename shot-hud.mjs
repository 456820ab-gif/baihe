#!/usr/bin/env node
/**
 * shot-hud.mjs —— 驱动容器内 chromium 渲染状态栏预览页，点开面板、切到指定场景后截图。
 *
 * 为什么不用 `chromium --screenshot`：那条路只是加载页面，点不了按钮，
 * 截出来面板是收起的、天气层也不在你要看的场景里。
 * 这里走 CDP（Chrome DevTools Protocol）：Node 22 自带 WebSocket 与 fetch，
 * 不需要装 puppeteer。
 *
 * 用法：
 *   node shot-hud.mjs [场景名] [输出png] [页签] [角色名]
 * 例：
 *   node shot-hud.mjs 清晨薄雾 /tmp/mist.png 城市地图
 *   node shot-hud.mjs 雨夜酒吧 /tmp/rain.png 林清
 *   node shot-hud.mjs 日常白昼 /tmp/sy.png 角色 苏玥
 *
 * 依赖（容器重装后需重装）：apk add chromium chromium-swiftshader font-noto-cjk
 */
import { spawn } from 'node:child_process';
import { mkdtempSync, existsSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const PREVIEW = process.env.HUD_PREVIEW
  ?? resolve(process.env.HOME ?? '/root', 'workspace/cards/YuriOpening/预览/状态栏预览.html');

const scenario = process.argv[2] ?? '清晨薄雾';
const output = resolve(process.argv[3] ?? '/tmp/hud-shot.png');
const tabName = process.argv[4] ?? '';
const charName = process.argv[5] ?? '';
const width = Number(process.env.HUD_W ?? 390);
const height = Number(process.env.HUD_H ?? 900);
const scale = Number(process.env.HUD_S ?? 2);
const settle = Number(process.env.HUD_SETTLE ?? 1800);

if (!existsSync(PREVIEW)) {
  console.error(`找不到预览页: ${PREVIEW}\n先跑 build-preview.mjs 生成。`);
  process.exit(1);
}

const profile = mkdtempSync(join(tmpdir(), 'hud-cdp-'));
const port = 9500 + (process.pid % 400);

const browser = spawn('chromium', [
  '--headless=new',
  '--no-sandbox',
  '--disable-gpu',
  '--disable-dev-shm-usage',
  '--use-gl=angle',
  '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader',
  '--hide-scrollbars',
  '--disable-lcd-text',
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
    } catch {
      // 浏览器还没起来，继续等
    }
    await sleep(200);
  }
  throw new Error('等不到 chromium 调试端口，渲染器可能没启动');
}

function connect(url) {
  return new Promise((ready, fail) => {
    const socket = new WebSocket(url);
    socket.addEventListener('open', () => ready(socket), { once: true });
    socket.addEventListener('error', () => fail(new Error('CDP 连接失败')), { once: true });
  });
}

let nextId = 1;
function send(socket, method, params = {}) {
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
}

async function evaluate(socket, expression) {
  const result = await send(socket, 'Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description ?? '页面脚本执行出错');
  }
  return result.result.value;
}

let socket;
try {
  const wsUrl = await waitForTarget();
  socket = await connect(wsUrl);

  await send(socket, 'Page.enable');
  await send(socket, 'Runtime.enable');
  await send(socket, 'Emulation.setDeviceMetricsOverride', {
    width, height, deviceScaleFactor: scale, mobile: true,
  });

  // 页面可能已在 about:blank，直接导航到预览页
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
  await sleep(600);

  const hasRoot = await evaluate(socket, `Boolean(document.querySelector('#statusbar-root .hud-shell'))`);
  if (!hasRoot) throw new Error('状态栏没挂载，预览页可能变了结构');

  // 点场景会整体重建 HUD，元素会被换掉；等重建完再操作，否则点到的是已销毁的节点
  const report = await evaluate(socket, `(() => {
    const scene = '${scenario}';
    const buttons = Array.from(document.querySelectorAll('#scene-bar button'));
    const button = buttons.find(item => item.textContent.trim() === scene);
    if (!button) return { ok: false, reason: '找不到场景按钮 ' + scene, buttons: buttons.map(b => b.textContent.trim()) };
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    return { ok: true };
  })()`);

  if (!report.ok) throw new Error(`${report.reason}；可选：${report.buttons?.join('、')}`);
  await sleep(700);

  // 展开面板，并轮询确认抽屉真的打开了（重建后 aria-expanded 会回到 false）
  let weather = '?';
  let opened = false;
  for (let attempt = 0; attempt < 12 && !opened; attempt += 1) {
    const state = await evaluate(socket, `(() => {
      const shell = document.querySelector('#statusbar-root .hud-shell');
      const bar = document.querySelector('#statusbar-root .snapshot-bar');
      const drawer = document.querySelector('#statusbar-root .hud-drawer');
      if (!bar) return { mounted: false };
      if (bar.getAttribute('aria-expanded') !== 'true' || drawer?.hidden) {
        bar.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      }
      return {
        mounted: true,
        expanded: bar.getAttribute('aria-expanded') === 'true',
        open: !drawer?.hidden,
        weather: shell?.dataset.weather,
        tabs: Array.from(document.querySelectorAll('#statusbar-root .hud-tab')).map(t => t.textContent.trim()),
      };
    })()`);
    if (state.mounted) weather = state.weather;
    opened = Boolean(state.open && state.expanded && state.tabs?.length);
    if (!opened) await sleep(300);
  }
  if (!opened) throw new Error('面板展开不了，预览页可能变了结构');

  if (tabName) {
    const tab = await evaluate(socket, `(() => {
      const target = Array.from(document.querySelectorAll('#statusbar-root .hud-tab'))
        .find(item => item.textContent.includes('${tabName}'));
      if (!target) return false;
      target.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      return true;
    })()`);
    if (!tab) {
      const tabs = await evaluate(socket, `Array.from(document.querySelectorAll('#statusbar-root .hud-tab')).map(t => t.textContent.trim())`);
      throw new Error(`找不到页签「${tabName}」；可选：${tabs?.join('、')}`);
    }
  }

  if (charName) {
    // 角色页签是两级导航：先点列表里的角色名进入她的面板
    await sleep(500);
    const picked = await evaluate(socket, `(() => {
      const target = Array.from(document.querySelectorAll('#statusbar-root .char-item'))
        .find(item => item.textContent.includes('${charName}'));
      if (!target) return false;
      target.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      return true;
    })()`);
    if (!picked) {
      const names = await evaluate(socket, `Array.from(document.querySelectorAll('#statusbar-root .char-item')).map(t => t.textContent.trim())`);
      throw new Error(`找不到角色「${charName}」；列表：${names?.join(' | ')}`);
    }
  }

  // 等动画首帧与过渡稳定，否则会截到展开动画中途
  await sleep(settle);

  const shot = await send(socket, 'Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
  writeFileSync(output, Buffer.from(shot.data, 'base64'));
  console.log(`${output}  ${width}x${height} @${scale}x  场景=${scenario}${tabName ? ` 页签=${tabName}` : ''}${charName ? ` 角色=${charName}` : ''}  weather=${weather}`);
} finally {
  try { socket?.close(); } catch {}
  browser.kill('SIGKILL');
}
