import { createApp } from 'vue';
import App from './App.vue';

function ensureDomConstructors() {
  const fallbackConstructor = function DomConstructor() {};

  if (typeof window.Element !== 'function') {
    Object.defineProperty(window, 'Element', {
      configurable: true,
      writable: true,
      value: fallbackConstructor,
    });
  }
  if (typeof window.SVGElement !== 'function') {
    Object.defineProperty(window, 'SVGElement', {
      configurable: true,
      writable: true,
      value: fallbackConstructor,
    });
  }
}

const ready = (fn: () => void) => {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fn, { once: true });
  } else {
    fn();
  }
};

ready(() => {
  let active = true;
  let app: ReturnType<typeof createApp> | undefined;

  window.addEventListener('pagehide', () => {
    active = false;
    app?.unmount();
  }, { once: true });

  // 介绍页不依赖 MVU，直接挂载；环境检测自己负责提示「未安装」
  errorCatched(async () => {
    const mountPoint = document.querySelector('#app');
    if (!active || !mountPoint?.isConnected || !document.defaultView) return;

    ensureDomConstructors();
    app = createApp(App);
    app.mount(mountPoint);
  })();
});
