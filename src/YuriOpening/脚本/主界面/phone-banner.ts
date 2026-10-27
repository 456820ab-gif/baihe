/**
 * phone-banner.ts — 手机通知横幅队列
 *
 * 手机上她的回复落盘、手机收起时，主应用在画布右上角弹一条横幅：
 * 头像 + 角色名 + 预览。最多同时 3 条，4 秒自动消失，悬停暂停计时，
 * 点击打开对应聊天（打开聊天即已读）。
 *
 * 只显示手机模块推来的 PhoneNotice——主线叙事不经过这里。
 */

import { characterById } from '../../characters';
import { avatarLQ } from '../../界面/手机/phone-icons';
import type { PhoneNotice } from '../../界面/手机';

const MAX_VISIBLE = 3;
const DWELL_MS = 4000;
const LEAVE_MS = 140;
const STAGGER_MS = 40;
const STAGGER_WINDOW_MS = 160;

const KIND_LABEL: Record<PhoneNotice['kind'], string> = {
  message: '微信',
  moment: '朋友圈',
  system: '手机',
};

type Entry = {
  el: HTMLElement;
  timeout: number | null;
  remaining: number;
  deadline: number;
};

export type BannerOptions = {
  onOpen: (notice: PhoneNotice) => void;
};

export function mountBanner(host: HTMLElement, options: BannerOptions) {
  const doc = host.ownerDocument;
  const win = doc.defaultView ?? window;

  const stack = doc.createElement('div');
  stack.className = 'phone-banner-stack';
  stack.setAttribute('role', 'log');
  stack.setAttribute('aria-live', 'polite');
  stack.setAttribute('aria-relevant', 'additions');
  host.append(stack);

  const entries: Entry[] = [];
  const exitTimers = new Set<number>();
  let lastPushAt = 0;
  let batch = 0;

  /* 离场先挂 .is-leaving 跑 140ms 右滑，再摘 DOM */
  function dismiss(entry: Entry) {
    if (entry.timeout !== null) {
      win.clearTimeout(entry.timeout);
      entry.timeout = null;
    }
    const index = entries.indexOf(entry);
    if (index >= 0) entries.splice(index, 1);
    if (entry.el.classList.contains('is-leaving')) return;
    entry.el.classList.add('is-leaving');
    const timer = win.setTimeout(() => {
      exitTimers.delete(timer);
      entry.el.remove();
    }, LEAVE_MS);
    exitTimers.add(timer);
  }

  function arm(entry: Entry) {
    entry.deadline = Date.now() + entry.remaining;
    entry.timeout = win.setTimeout(() => dismiss(entry), entry.remaining);
  }

  function pause(entry: Entry) {
    if (entry.timeout === null) return;
    win.clearTimeout(entry.timeout);
    entry.timeout = null;
    entry.remaining = Math.max(0, entry.deadline - Date.now());
  }

  function resume(entry: Entry) {
    if (entry.timeout !== null) return;
    arm(entry);
  }

  function build(notice: PhoneNotice) {
    const def = characterById(notice.charId);
    const el = doc.createElement('button');
    el.className = 'phone-banner';
    el.type = 'button';
    el.setAttribute('aria-label', `${notice.charName}：${notice.preview}`);

    const avatar = doc.createElement('span');
    avatar.className = 'phone-banner-avatar';
    avatar.setAttribute('aria-hidden', 'true');
    avatar.innerHTML = avatarLQ({
      key: notice.charId,
      stops: def?.phone.avatarStops ?? ['#c97490', '#b8627f', '#8f6a97'],
      glyph: def?.glyph ?? '·',
    });

    const copy = doc.createElement('span');
    copy.className = 'phone-banner-copy';
    const name = doc.createElement('strong');
    name.className = 'phone-banner-name';
    name.textContent = notice.charName;
    const preview = doc.createElement('span');
    preview.className = 'phone-banner-preview';
    preview.textContent = notice.preview;
    copy.append(name, preview);

    const kind = doc.createElement('span');
    kind.className = 'phone-banner-kind';
    kind.textContent = KIND_LABEL[notice.kind] ?? '手机';

    el.append(avatar, copy, kind);
    return el;
  }

  function push(notice: PhoneNotice) {
    const el = build(notice);
    const entry: Entry = { el, timeout: null, remaining: DWELL_MS, deadline: 0 };

    /* 同一批进来的横幅按 40ms 递增错开，单条就是 0 */
    const now = Date.now();
    batch = now - lastPushAt < STAGGER_WINDOW_MS ? batch + 1 : 0;
    lastPushAt = now;
    if (batch > 0) el.style.animationDelay = `${Math.min(batch, MAX_VISIBLE) * STAGGER_MS}ms`;

    el.addEventListener('click', () => {
      dismiss(entry);
      options.onOpen(notice);
    });
    el.addEventListener('pointerenter', () => pause(entry));
    el.addEventListener('pointerleave', () => resume(entry));

    stack.prepend(el);
    entries.unshift(entry);
    while (entries.length > MAX_VISIBLE) {
      const oldest = entries[entries.length - 1];
      if (!oldest) break;
      dismiss(oldest);
    }
    arm(entry);
  }

  function destroy() {
    entries.forEach(entry => {
      if (entry.timeout !== null) {
        win.clearTimeout(entry.timeout);
        entry.timeout = null;
      }
    });
    entries.length = 0;
    exitTimers.forEach(id => win.clearTimeout(id));
    exitTimers.clear();
    stack.remove();
  }

  return { push, destroy };
}

export type BannerHandle = ReturnType<typeof mountBanner>;
