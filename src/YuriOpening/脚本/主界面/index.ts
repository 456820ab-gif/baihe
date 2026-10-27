import appCss from './styles.scss?raw';
import { mountApp } from './app';
import { hostDocument, setHostMode } from './host';

setHostMode('parent');

const STYLE_ID = 'yuri-front-style';

function injectStyle() {
  const host = hostDocument();
  if (host.getElementById(STYLE_ID)) return;
  const style = host.createElement('style');
  style.id = STYLE_ID;
  style.textContent = appCss;
  (host.head ?? host.body).append(style);
}

function start() {
  injectStyle();
  void waitGlobalInitialized('Mvu').then(() => {
    mountApp();
  }).catch(error => {
    console.error('[YuriFront]', error);
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', start, { once: true });
} else {
  start();
}
