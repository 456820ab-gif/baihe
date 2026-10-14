#!/usr/bin/env node
/**
 * shot.mjs —— 用容器内的 chromium 把自检页面渲成 PNG，供 AI 直接看图。
 *
 * 为什么需要它：jsdom 只算 DOM 不绘制，布局、模糊、渐变叠加、
 * 中文字体、元素遮挡这些只有真渲染才看得出来。
 *
 * 用法：
 *   node shot.mjs <html路径> [输出png] [宽] [高] [缩放]
 *
 * 依赖：apk add chromium chromium-swiftshader font-noto-cjk
 *   - swiftshader：容器无 GPU，靠它软件渲染 WebGL/ANGLE
 *   - font-noto-cjk：缺了中文会渲成方块，截图会误判成样式问题
 *
 * 注意：容器重装后 rootfs 清空，这三个包要重装一次。
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const run = promisify(execFile);

const [, , inputArg, outputArg, widthArg, heightArg, scaleArg] = process.argv;
if (!inputArg) {
  console.error('用法: node shot.mjs <html路径> [输出png] [宽] [高] [缩放]');
  process.exit(1);
}

const input = resolve(inputArg);
if (!existsSync(input)) {
  console.error(`找不到文件: ${input}`);
  process.exit(1);
}

const output = resolve(outputArg ?? '/tmp/hud-shot.png');
const width = Number(widthArg ?? 390);
const height = Number(heightArg ?? 780);
const scale = Number(scaleArg ?? 2);

// 容器里没有 DBus 与音频设备，这些报错无害；真正的失败要看 chromium 是否产出文件。
const args = [
  '--headless',
  '--no-sandbox',
  '--disable-gpu',
  '--disable-dev-shm-usage',
  '--use-gl=angle',
  '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader',
  '--hide-scrollbars',
  '--disable-lcd-text',
  `--window-size=${width},${height}`,
  `--force-device-scale-factor=${scale}`,
  // 给 Vue 挂载、动画首帧、字体加载留时间；不够会截到半成品
  '--virtual-time-budget=4000',
  `--screenshot=${output}`,
  `file://${input}`,
];

try {
  await run('chromium', args, { timeout: 120_000, maxBuffer: 4 * 1024 * 1024 });
} catch (error) {
  // chromium 非零退出但已写出文件时仍可用，只在确实没产物时报错
  if (!existsSync(output)) {
    console.error('渲染失败:', error.stderr?.slice(0, 1200) ?? error.message);
    process.exit(1);
  }
}

if (!existsSync(output)) {
  console.error('渲染结束但没有产出 PNG');
  process.exit(1);
}

console.log(`${output}  ${width}x${height} @${scale}x`);
