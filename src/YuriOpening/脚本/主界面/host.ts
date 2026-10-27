/*
 * 前端有两种宿主：
 * - 楼层界面（正则渲染的 iframe）：界面就在自己的 document 里，和状态栏/开局表单一样；
 * - 全局脚本（手机那种）：脚本在 TH-script iframe，必须挂到 window.parent.document。
 * 默认按楼层界面处理，只有脚本入口显式切到 parent。
 */

export type HostMode = 'self' | 'parent';

let mode: HostMode = 'self';

export function setHostMode(next: HostMode) {
  mode = next;
}

export function hostWindow(): Window {
  if (mode === 'parent') {
    try {
      const parent = window.parent;
      if (parent && parent !== window) return parent;
    } catch {
      // 跨域时退回自身窗口
    }
  }
  return window;
}

export function hostDocument(): Document {
  if (mode === 'parent') {
    try {
      const parent = window.parent;
      if (parent && parent !== window && parent.document) return parent.document;
    } catch {
      // 跨域时退回自身文档
    }
  }
  return document;
}

const copiedStyles = new Set<string>();

/** 仅全局脚本模式需要：把脚本 iframe 里的样式复制到宿主文档 */
export function teleportStyles(target: Document = hostDocument()) {
  if (mode !== 'parent' || target === document) return;
  const head = target.head ?? target.body;
  if (!head) return;
  document.querySelectorAll('style').forEach(style => {
    const text = style.textContent ?? '';
    if (!text || copiedStyles.has(text)) return;
    copiedStyles.add(text);
    const clone = target.createElement('style');
    clone.setAttribute('data-yuri-style', '');
    clone.textContent = text;
    head.append(clone);
  });
}
