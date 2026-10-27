/**
 * 嵌入标记。手机模块在**模块求值**时读取 __YURI_PHONE_EMBEDDED__ 决定是否自动启动 overlay，
 * 所以必须在它之前求值：ESM 按 import 顺序求值，phone-host.ts 第一个 import 就是本模块。
 */
(window as Window & { __YURI_PHONE_EMBEDDED__?: boolean }).__YURI_PHONE_EMBEDDED__ = true;
