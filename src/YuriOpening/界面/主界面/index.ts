import appCss from '../../脚本/主界面/styles.scss?raw';
import { mountApp } from '../../脚本/主界面/app';
import { setHostMode } from '../../脚本/主界面/host';

setHostMode('self');

function injectStyle() {
  if (document.getElementById('yuri-front-style')) return;
  const style = document.createElement('style');
  style.id = 'yuri-front-style';
  style.textContent = appCss;
  document.head.append(style);
}

/** 伪同层：只保留前端所在的楼层节点，其余楼层在生成结束后清理（数据不动） */
function keepOnlyHostMessage() {
  const frame = window.frameElement as HTMLIFrameElement | null;
  if (!frame) return;
  try {
    const doc = frame.ownerDocument;
    const host = frame.closest('.mes');
    const chat = doc.querySelector('#chat');
    if (!doc || !host || !chat) return;
    const prune = () => {
      chat.querySelectorAll(':scope > .mes').forEach(mes => {
        if (mes !== host) mes.remove();
      });
    };
    prune();
    try {
      eventOn(tavern_events.GENERATION_ENDED, prune);
    } catch {
      // 非酒馆环境
    }
  } catch {
    // 跨域时保持原生楼层
  }
}

function start() {
  injectStyle();
  keepOnlyHostMessage();
  const mvu = typeof waitGlobalInitialized === 'function'
    ? Promise.resolve(waitGlobalInitialized('Mvu')).then(() => undefined, () => undefined)
    : Promise.resolve();
  // Mvu 迟迟不就绪也要把界面挂出来，不能让楼层停在空白色块
  void Promise.race([mvu, new Promise(resolve => setTimeout(resolve, 1500))]).then(() => {
    const app = mountApp({ floor: true });
    document.getElementById('boot-note')?.remove();
    if (!app) return;
    app.openOpening();
  }).catch(error => {
    console.error('[YuriFront]', error);
    const note = document.getElementById('boot-note');
    if (note) note.textContent = '主界面加载失败，请刷新或检查酒馆助手。';
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', start, { once: true });
} else {
  start();
}
