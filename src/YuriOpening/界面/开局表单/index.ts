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

$(() => {
  let active = true;
  let app: ReturnType<typeof createApp> | undefined;

  $(window).one('pagehide', () => {
    active = false;
    app?.unmount();
  });

  errorCatched(async () => {
    // 等 Mvu 就绪用于表单读写；未安装酒馆助手时最多等 1.2 秒就照常挂载，
    // 避免整页空白（安装指引由前一条开场白里的介绍页负责）。
    const mvuWait = typeof waitGlobalInitialized === 'function'
      ? Promise.resolve(waitGlobalInitialized('Mvu')).then(() => undefined, () => undefined)
      : Promise.resolve(undefined);
    await Promise.race([mvuWait, new Promise(resolve => setTimeout(resolve, 1200))]);
    const mountPoint = document.querySelector('#app');
    if (!active || !mountPoint?.isConnected || !document.defaultView) return;

    ensureDomConstructors();
    app = createApp(App);
    app.mount(mountPoint);
  })();
});
