/*
 * 常驻动效的运行时：指针视差、时间擦线与页签下划线。
 * 循环与氛围本身都在 motion.ambient.scss / motion.interaction.scss 里，这里只做 CSS 做不到的部分。
 */

const TAP_SELECTOR =
  '.front-primary, .front-action, .story-send, .story-action, .obs-tab, .story-modal-cancel, .story-modal-save, .story-modal-confirm, .opening-shell .primary-button';
const SEAL_SELECTOR = '.front-primary, .story-send, .opening-shell .primary-button';
const TICK_COOLDOWN = 1200;
const SHIFT_LIMIT = 4;

export function isReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/** 触感只用于手势内的一次轻按，不参与任何循环动效。 */
export function tapHaptic(duration = 8): void {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') navigator.vibrate(duration);
  } catch {
    // 宿主禁用振动时静默
  }
}

/** 主操作成功后沿底边擦过一道细线，只播一次；减少动效时不做。 */
export function stampSeal(target: Element | null | undefined): void {
  const el = target as HTMLElement | null;
  if (!el || isReducedMotion()) return;
  el.classList.remove('is-sealed');
  void el.offsetWidth;
  el.classList.add('is-sealed');
  el.addEventListener('animationend', () => el.classList.remove('is-sealed'), { once: true });
}

const inkStamps = new WeakMap<Element, number>();

function inkTick(el: Element | null | undefined, now: number): void {
  if (!el) return;
  const last = inkStamps.get(el) ?? 0;
  if (now - last < TICK_COOLDOWN) return;
  inkStamps.set(el, now);
  el.classList.remove('is-ticking');
  void (el as HTMLElement).offsetWidth;
  el.classList.add('is-ticking');
  el.addEventListener('animationend', () => el.classList.remove('is-ticking'), { once: true });
}

export type MotionHandle = {
  setEnabled: (enabled: boolean) => void;
  /** 传入的哪一个变了就传哪一个，另一边传 null。 */
  tickTime: (time: Element | null, date: Element | null) => void;
  firstLight: () => void;
  destroy: () => void;
};

export function mountMotion(root: HTMLElement, options: { animate: boolean }): MotionHandle {
  const doc = root.ownerDocument;
  const win = doc.defaultView ?? window;
  const reduced = win.matchMedia('(prefers-reduced-motion: reduce)');
  const fine = win.matchMedia('(hover: hover) and (pointer: fine)');

  let animate = options.animate;
  let dawn = false;
  let px = 0.5;
  let py = 0.5;
  let pointerFrame = 0;
  let tabFrame = 0;

  const canParallax = () => animate && !reduced.matches && fine.matches;

  const resetShift = () => {
    root.style.setProperty('--shift-x', '0px');
    root.style.setProperty('--shift-y', '0px');
  };

  const applyPointer = () => {
    pointerFrame = 0;
    root.style.setProperty('--mx', `${(px * 100).toFixed(2)}%`);
    root.style.setProperty('--my', `${(py * 100).toFixed(2)}%`);
    root.style.setProperty('--shift-x', `${((px - 0.5) * SHIFT_LIMIT * 2).toFixed(2)}px`);
    root.style.setProperty('--shift-y', `${((py - 0.5) * SHIFT_LIMIT * 2).toFixed(2)}px`);
  };

  const onPointerMove = (event: PointerEvent) => {
    if (!canParallax()) return;
    const rect = root.getBoundingClientRect();
    px = Math.min(1, Math.max(0, (event.clientX - rect.left) / Math.max(rect.width, 1)));
    py = Math.min(1, Math.max(0, (event.clientY - rect.top) / Math.max(rect.height, 1)));
    if (!pointerFrame) pointerFrame = win.requestAnimationFrame(applyPointer);
  };

  const onPointerLeave = () => {
    if (pointerFrame) {
      win.cancelAnimationFrame(pointerFrame);
      pointerFrame = 0;
    }
    resetShift();
  };

  const onPointerDown = (event: PointerEvent) => {
    if (event.pointerType === 'mouse') return;
    const target = event.target as Element | null;
    if (!target || !target.closest(TAP_SELECTOR)) return;
    tapHaptic(8);
  };

  const onClick = (event: MouseEvent) => {
    const target = (event.target as Element | null)?.closest(SEAL_SELECTOR) as HTMLButtonElement | null;
    if (!target || target.disabled) return;
    stampSeal(target);
  };

  const updateTabLine = () => {
    tabFrame = 0;
    const tabs = root.querySelector<HTMLElement>('.obs-tabs');
    if (!tabs) return;
    const active = tabs.querySelector<HTMLElement>('.obs-tab.is-active');
    if (!active) {
      tabs.style.setProperty('--obs-tab-o', '0');
      return;
    }
    tabs.style.setProperty('--obs-tab-x', `${active.offsetLeft}px`);
    tabs.style.setProperty('--obs-tab-w', `${active.offsetWidth}px`);
    tabs.style.setProperty('--obs-tab-o', '1');
  };

  const queueTabLine = () => {
    if (tabFrame) return;
    tabFrame = win.requestAnimationFrame(updateTabLine);
  };

  const asElement = (node: Node | null): Element | null => {
    if (!node) return null;
    return node.nodeType === 1 ? (node as Element) : node.parentElement;
  };

  // 页签由观景窗自己重建，只能从 DOM 变化里跟。
  const observer = new win.MutationObserver(records => {
    for (const record of records) {
      if (asElement(record.target)?.closest('.obs-window')) {
        queueTabLine();
        return;
      }
      for (const node of Array.from(record.addedNodes)) {
        if (asElement(node)?.closest('.obs-window')) {
          queueTabLine();
          return;
        }
      }
    }
  });
  observer.observe(root, { attributes: true, attributeFilter: ['class'], childList: true, subtree: true });

  const onDensityChange = () => {
    if (!canParallax()) resetShift();
    queueTabLine();
  };

  root.addEventListener('pointermove', onPointerMove);
  root.addEventListener('pointerleave', onPointerLeave);
  root.addEventListener('pointerdown', onPointerDown);
  root.addEventListener('click', onClick);
  win.addEventListener('resize', queueTabLine);
  reduced.addEventListener('change', onDensityChange);
  fine.addEventListener('change', onDensityChange);

  return {
    setEnabled(next: boolean) {
      animate = next;
      if (!canParallax()) resetShift();
    },
    tickTime(time: Element | null, date: Element | null) {
      if (reduced.matches) return;
      const now = Date.now();
      inkTick(time, now);
      inkTick(date, now);
    },
    firstLight() {
      if (dawn) return;
      dawn = true;
      root.dataset.dawn = 'true';
    },
    destroy() {
      root.removeEventListener('pointermove', onPointerMove);
      root.removeEventListener('pointerleave', onPointerLeave);
      root.removeEventListener('pointerdown', onPointerDown);
      root.removeEventListener('click', onClick);
      win.removeEventListener('resize', queueTabLine);
      reduced.removeEventListener('change', onDensityChange);
      fine.removeEventListener('change', onDensityChange);
      observer.disconnect();
      if (pointerFrame) win.cancelAnimationFrame(pointerFrame);
      if (tabFrame) win.cancelAnimationFrame(tabFrame);
      pointerFrame = 0;
      tabFrame = 0;
    },
  };
}
