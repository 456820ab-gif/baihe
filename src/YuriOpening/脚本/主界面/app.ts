import { weatherLabel, weatherMarkSvg, weatherOverlaySvg, weatherTone, lilySprigSvg } from '../../界面/状态栏/icons';
import type { PhoneNotice } from '../../界面/手机';
import { mountChat } from './chat';
import { hostDocument, hostWindow, teleportStyles } from './host';
import { Observatory, type ObsTab } from './observatory';
import { CharacterView } from './character-view';
import { MapView } from './map-view';
import { mountMotion } from './motion';
import { mountOpening } from './opening-view';
import { mountBanner } from './phone-banner';
import { phoneHost } from './phone-host';
import { relationEnabled } from './relation';
import { renderRelationView } from './relation-view';
import { renderSettingsView } from './settings-view';
import {
  formatPlace, getPath, getSettings, playerAge, playerJob, playerName, readData,
  readPath, resolveTheme, safeMessageId, weatherNote, type HudData, type ThemeState,
} from './state';

const APP_ID = 'yuri-front';
const ROOT_CLASS = 'yuri-front';

type Mode = 'closed' | 'opening' | 'main';

function make<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string) {
  const el = hostDocument().createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

function button(label: string, className: string) {
  const el = make('button', className, label);
  el.type = 'button';
  return el;
}

function row(label: string, value: string, index: number) {
  const el = make('div', 'front-row');
  el.append(make('span', 'front-row-index', String(index + 1).padStart(2, '0')));
  el.append(make('span', 'front-row-label', label));
  el.append(make('span', 'front-row-value', value));
  return el;
}

export function mountApp(options: { floor?: boolean } = {}) {
  const host = hostDocument();
  if (host.getElementById(APP_ID)) return;
  const settings = getSettings();
  const root = make('div', ROOT_CLASS);
  root.id = APP_ID;
  root.dataset.open = 'false';
  root.dataset.mode = 'closed';
  root.dataset.embed = options.floor ? 'floor' : 'overlay';
  root.dataset.animate = String(settings.animate);
  root.dataset.scene = String(settings.scene);
  root.dataset.theme = settings.theme;
  root.style.display = 'none';

  const motion = mountMotion(root, { animate: settings.animate });

  const atmosphere = make('div', 'front-atmosphere');
  atmosphere.setAttribute('aria-hidden', 'true');
  atmosphere.innerHTML = `
    <span class="front-paper"></span>
    <span class="front-lamp"></span>
    <span class="front-wash"></span>
    <span class="front-nocturne"></span>
    <span class="front-vignette"></span>
    <span class="front-motes">${Array.from({ length: 6 }, (_, index) => {
      const x = 8 + ((index * 17) % 84);
      const y = 12 + ((index * 29) % 70);
      const size = 1.5 + (index % 3) * 0.7;
      return `<i style="--x:${x}%;--y:${y}%;--s:${size}px;--d:${12 + (index % 5) * 3}s;--delay:${-index * 1.7}s"></i>`;
    }).join('')}</span>
    <span class="front-specimen">${lilySprigSvg()}</span>
    <span class="front-specimen-echo">${lilySprigSvg()}</span>`;
  root.append(atmosphere);

  const weather = make('div', 'front-weather hud-shell');
  weather.dataset.animate = String(settings.animate);
  weather.dataset.scene = String(settings.scene);
  root.append(weather);

  const shell = make('div', 'front-shell');
  const head = make('header', 'front-head');
  const env = make('div', 'front-env');
  const stamp = make('span', 'front-weather-mark');
  const weatherCopy = make('div', 'front-weather-copy');
  const weatherLabelEl = make('strong', 'front-weather-label');
  const dateEl = make('small', 'front-date');
  weatherCopy.append(weatherLabelEl, dateEl);
  const timeCopy = make('div', 'front-time-copy');
  const timeEl = make('strong', 'front-time');
  const placeEl = make('small', 'front-place');
  timeCopy.append(timeEl, placeEl);
  const note = make('span', 'front-weather-note');
  env.append(stamp, weatherCopy, timeCopy, note);
  const actions = make('div', 'front-actions');
  const fullButton = button('全屏', 'front-action');
  const phoneButton = button('手机', 'front-action');
  const phoneBadge = make('span', 'front-action-badge');
  phoneBadge.hidden = true;
  phoneButton.append(phoneBadge);
  const nativeButton = button('原生视图', 'front-action front-action-quiet');
  actions.append(fullButton, phoneButton, nativeButton);
  head.append(env, actions);

  const body = make('div', 'front-body');
  const player = make('aside', 'front-player');
  const playerHead = make('div', 'front-player-head');
  const playerMark = make('span', 'front-player-mark', '·');
  const playerCopy = make('div', 'front-player-copy');
  const playerNameEl = make('strong', '');
  const playerJobEl = make('small', '');
  playerCopy.append(playerNameEl, playerJobEl);
  const playerToggle = button('‹', 'front-player-toggle');
  playerToggle.setAttribute('aria-label', '收起玩家栏');
  playerHead.append(playerMark, playerCopy, playerToggle);
  const playerBody = make('div', 'front-player-body');
  player.append(playerHead, playerBody);

  const stage = make('main', 'front-stage');
  const chatHost = make('div', 'front-chat');
  stage.append(chatHost);
  const openingHost = make('div', 'front-opening');
  openingHost.hidden = true;
  stage.append(openingHost);
  body.append(player, stage);

  const playerHandle = button('玩家', 'front-player-handle');
  playerHandle.hidden = true;
  const gate = make('section', 'front-gate');
  gate.innerHTML = `
    <div class="front-gate-card">
      <span class="front-kicker">百合花期 · 全屏游玩</span>
      <h1>请横屏开始</h1>
      <p>天气、花期、玩家与故事，在一张画布上。</p>
      <button type="button" class="front-primary" data-action="enter">点击横屏开始游玩</button>
      <small>需要允许全屏；方向锁定失败时会使用沉浸视图。</small>
    </div>`;
  gate.hidden = true;

  shell.append(head, body);
  root.append(shell, playerHandle, gate);

  const launcher = button('全屏游玩', 'front-launcher');
  launcher.hidden = true;
  host.body.append(launcher);
  host.body.append(root);

  const banner = mountBanner(root, {
    onOpen: notice => phoneHost.openChat(notice.charId),
  });
  const setPhoneUnread = (count: number) => {
    phoneBadge.textContent = count > 0 ? String(Math.min(count, 99)) : '';
    phoneBadge.hidden = count <= 0;
    phoneButton.setAttribute('aria-label', count > 0 ? `手机（${count} 条未读）` : '手机');
  };
  phoneHost.mount({
    host: root,
    onNotify: notice => banner.push(notice),
    onUnread: setPhoneUnread,
  });
  setPhoneUnread(phoneHost.getUnread());

  const chat = mountChat(chatHost);
  /* 关系/地图动作只落到输入框：不发送、不改 MVU，发送权留给玩家 */
  const fillActionInput = (line: string, note: string) => {
    if (chat.hasInput()) {
      chat.setStatus('输入框已有内容，请先处理当前消息。');
      return;
    }
    chat.setInput(line);
    chat.setStatus(note);
  };
  const characterView = new CharacterView({
    rerender: () => observatory.render(true),
    onLocate: label => {
      observatory.openTab('map');
      mapView.focus(label);
      observatory.render(true);
    },
    onAction: line => fillActionInput(line, '关系动作已填入输入框，发送由你决定。'),
  });
  const mapView = new MapView({
    rerender: () => observatory.render(true),
    onTravel: message => {
      if (chat.hasInput()) {
        chat.setStatus('输入框已有内容，请先处理当前消息。');
        return;
      }
      chat.setInput(message);
      chat.setStatus('前往意图已填入输入框，发送由你决定。');
    },
  });
  const observatory = new Observatory({
    root,
    isTabAvailable: tab => tab !== 'relation' || relationEnabled(readData()),
    /* 只有页签与真正影响画面的数据变化才重建，消息流更新不应重绘地图 */
    getRenderKey: tab => {
      const data = readData();
      return `${tab}:${JSON.stringify({ data, theme: resolveTheme(data), settings, relation: relationEnabled(data) })}`;
    },
    renderTab: tab => {
      const data = readData();
      const theme = resolveTheme(data);
      if (tab === 'relation') {
        return renderRelationView({
          data,
          onAction: line => fillActionInput(line, '关系动作已填入输入框，发送由你决定。'),
        });
      }
      if (tab === 'map') return mapView.render(data, theme);
      if (tab === 'settings') {
        return renderSettingsView({
          onChange: next => {
            Object.assign(settings, next);
            applySettings();
            if (observatory.opened) observatory.render(true);
          },
        });
      }
      return characterView.render(data, theme);
    },
  });

  let mode: Mode = 'closed';
  let nativeMode = false;
  let open = false;
  let playerOpen = true;
  let lastTime = '';
  let lastDate = '';
  let unmountOpening: (() => void) | null = null;
  let floorFull = false;
  let floorPromoted = false;
  let floorFrameStyle = '';

  function applySettings() {
    root.dataset.animate = String(settings.animate);
    root.dataset.scene = String(settings.scene);
    root.dataset.theme = settings.theme;
    weather.dataset.animate = String(settings.animate);
    weather.dataset.scene = String(settings.scene);
    motion.setEnabled(settings.animate);
  }

  function renderHeader(data: HudData | null, theme: ThemeState) {
    const label = weatherLabel(theme.weather);
    stamp.innerHTML = weatherMarkSvg(theme.weather);
    stamp.setAttribute('aria-label', label);
    weatherLabelEl.textContent = label;
    const date = readPath(data, '环境.日期');
    const time = readPath(data, '环境.时间');
    if (lastDate && date !== lastDate) motion.tickTime(null, dateEl);
    if (lastTime && time !== lastTime) motion.tickTime(timeEl, null);
    lastDate = date;
    lastTime = time;
    dateEl.textContent = date;
    timeEl.textContent = time;
    placeEl.textContent = formatPlace(data);
    note.textContent = weatherNote(theme, settings.scene);
    root.dataset.daypart = theme.daypart;
    root.dataset.weather = weatherTone(theme.weather);
    root.dataset.override = theme.override;
    root.style.setProperty('--light-x', theme.daypart === 'night' ? '84%' : '18%');
    root.style.setProperty('--light-y', theme.daypart === 'night' ? '78%' : '8%');
    root.style.setProperty('--light-tone', theme.daypart === 'night' ? 'rgba(227, 138, 165, 0.14)' : 'rgba(243, 233, 236, 0.1)');
    weather.dataset.daypart = theme.daypart;
    weather.dataset.weather = theme.weather === '待设定' ? 'cloudy' : theme.weather;
    weather.dataset.override = theme.override;
    const svg = theme.weather === '待设定' ? '' : weatherOverlaySvg(theme.weather, 1920, 1080);
    weather.innerHTML = svg ? `<svg viewBox="0 0 1920 1080" preserveAspectRatio="none" aria-hidden="true">${svg}</svg>` : '';
  }

  function renderPlayer(data: HudData | null) {
    const name = playerName(data);
    playerNameEl.textContent = name;
    playerJobEl.textContent = `${playerAge(data)} 岁 · ${playerJob(data)}`;
    playerMark.textContent = name.slice(0, 1);
    playerBody.replaceChildren();
    const fields: Array<[string, string]> = [
      ['心情', readPath(data, '玩家状态.心情')],
      ['精力', readPath(data, '玩家状态.精力')],
      ['身体', readPath(data, '玩家状态.身体状态')],
      ['行动', readPath(data, '玩家状态.当前行动')],
      ['姿态', readPath(data, '玩家状态.关系姿态')],
      ['穿着', readPath(data, '玩家状态.当前穿着')],
    ];
    fields.forEach(([label, value], index) => playerBody.append(row(label, value, index)));
  }

  function syncLauncher() {
    launcher.hidden = mode !== 'closed' ? true : !nativeMode && safeMessageId() <= 0;
  }

  function renderAll() {
    const data = readData();
    const theme = resolveTheme(data);
    renderHeader(data, theme);
    renderPlayer(data);
    syncLauncher();
    if (observatory.opened) observatory.render();
  }

  function updatePlayer(openState: boolean) {
    playerOpen = openState;
    root.dataset.player = openState ? 'open' : 'closed';
    playerHandle.hidden = openState;
    playerToggle.textContent = openState ? '‹' : '›';
    playerToggle.setAttribute('aria-label', openState ? '收起玩家栏' : '展开玩家栏');
  }

  function isFloorMode() {
    return root.dataset.embed === 'floor';
  }

  function parentDocument(): Document | null {
    try {
      return window.parent !== window ? window.parent.document : null;
    } catch {
      return null;
    }
  }

  async function requestDeviceFullscreen(): Promise<boolean> {
    try {
      await document.documentElement.requestFullscreen();
      return true;
    } catch {
      // 楼层 iframe 没有 allowfullscreen 时，退到宿主页面
    }
    try {
      const doc = parentDocument();
      if (doc?.documentElement.requestFullscreen) {
        await doc.documentElement.requestFullscreen();
        return true;
      }
    } catch {
      // 跨域或权限策略禁止
    }
    return false;
  }

  function exitDeviceFullscreen() {
    try {
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
      const doc = parentDocument();
      if (doc?.fullscreenElement) void doc.exitFullscreen().catch(() => undefined);
    } catch {
      // 跨域时忽略
    }
  }

  function promoteFloorFrame() {
    const frame = window.frameElement as HTMLIFrameElement | null;
    if (!frame || floorPromoted) return;
    floorFrameStyle = frame.style.cssText;
    frame.style.setProperty('position', 'fixed', 'important');
    frame.style.setProperty('inset', '0', 'important');
    frame.style.setProperty('width', '100vw', 'important');
    frame.style.setProperty('height', '100vh', 'important');
    frame.style.setProperty('max-width', 'none', 'important');
    frame.style.setProperty('z-index', '2147483000', 'important');
    frame.style.setProperty('background', '#1c1720', 'important');
    floorPromoted = true;
  }

  function restoreFloorFrame() {
    const frame = window.frameElement as HTMLIFrameElement | null;
    if (frame && floorPromoted) frame.style.cssText = floorFrameStyle;
    floorPromoted = false;
  }

  async function toggleFloorFull() {
    if (floorFull) {
      exitDeviceFullscreen();
      restoreFloorFrame();
      return;
    }
    const ok = await requestDeviceFullscreen();
    if (!ok) {
      fullButton.textContent = '全屏';
      return;
    }
    // 如果全屏的是宿主页面，楼层 iframe 还需要铺满宿主
    if (!document.fullscreenElement) promoteFloorFrame();
    floorFull = true;
    root.dataset.full = 'true';
    fullButton.textContent = '退出全屏';
    updateGate();
  }

  function updateGate() {
    const landscape = hostWindow().matchMedia('(orientation: landscape)').matches;
    const blocked = !landscape;
    const doc = hostDocument();
    open = mode === 'main' && open;
    const full = Boolean(doc.fullscreenElement);
    fullButton.textContent = isFloorMode()
      ? (floorFull ? '退出全屏' : '全屏')
      : (full ? '退出全屏' : '全屏');
    gate.hidden = nativeMode || mode !== 'main' || isFloorMode() || (open && !blocked);
    const enter = gate.querySelector<HTMLButtonElement>('[data-action="enter"]');
    if (enter) {
      enter.disabled = blocked;
      enter.textContent = blocked ? '请旋转设备横屏游玩' : full ? '正在全屏游玩' : '点击横屏开始游玩';
    }
    if (blocked && open && !isFloorMode()) {
      open = false;
      root.dataset.open = 'false';
      host.body.classList.remove('yuri-front-open');
    }
    root.dataset.gate = String(!gate.hidden);
  }

  function requestHostFullscreen() {
    if (root.dataset.embed === 'floor') return;
    const doc = hostDocument();
    if (doc.fullscreenElement) return;
    try {
      const result = doc.documentElement.requestFullscreen?.();
      if (result) void result.catch(() => undefined);
    } catch {
      // 沉浸视图兜底
    }
  }

  async function enterApp() {
    requestHostFullscreen();
    if (!isFloorMode()) {
      try {
        const orientation = hostWindow().screen?.orientation as ScreenOrientation & { lock?: (mode: string) => Promise<void> };
        await orientation?.lock?.('landscape');
      } catch {
        // ignore
      }
    }
    nativeMode = false;
    mode = 'main';
    open = true;
    root.style.display = '';
    root.dataset.mode = 'main';
    root.dataset.open = 'true';
    launcher.hidden = true;
    host.body.classList.add('yuri-front-open');
    chat.refresh();
    updateGate();
    motion.firstLight();
  }

  function hideOpening() {
    if (unmountOpening) {
      unmountOpening();
      unmountOpening = null;
    }
    openingHost.replaceChildren();
    openingHost.hidden = true;
  }

  function showOpening() {
    hideOpening();
    mode = 'opening';
    root.style.display = '';
    root.dataset.mode = 'opening';
    root.dataset.open = 'true';
    launcher.hidden = true;
    openingHost.hidden = false;
    unmountOpening = mountOpening(openingHost, {
      onSubmitStart: requestHostFullscreen,
      onSubmitted: () => openMain(),
    });
    teleportStyles();
  }

  function openMain() {
    hideOpening();
    mode = 'main';
    open = true;
    root.style.display = '';
    root.dataset.mode = 'main';
    root.dataset.open = 'true';
    launcher.hidden = true;
    host.body.classList.add('yuri-front-open');
    chat.refresh();
    updateGate();
    motion.firstLight();
    if (hostWindow().matchMedia('(orientation: landscape)').matches) void enterApp();
  }

  function openOpening() {
    const data = readData();
    const submitted = getPath(data, '开场.$已提交') === true;
    if (submitted) {
      openMain();
      return;
    }
    showOpening();
  }

  async function toggleFullscreen() {
    const doc = hostDocument();
    if (doc.fullscreenElement) {
      try { await doc.exitFullscreen(); } catch { /* ignore */ }
      updateGate();
      return;
    }
    requestHostFullscreen();
    updateGate();
  }

  function nativeView() {
    phoneHost.close();
    nativeMode = true;
    mode = 'closed';
    open = false;
    root.dataset.open = 'false';
    root.dataset.mode = 'closed';
    root.style.display = 'none';
    launcher.hidden = false;
    host.body.classList.remove('yuri-front-open');
    const doc = hostDocument();
    if (doc.fullscreenElement) void doc.exitFullscreen().catch(() => undefined);
    try { doc.querySelector<HTMLTextAreaElement>('#send_textarea')?.focus(); } catch { /* ignore */ }
  }

  fullButton.addEventListener('click', () => {
    if (isFloorMode()) {
      toggleFloorFull();
      return;
    }
    void toggleFullscreen();
  });
  phoneButton.addEventListener('click', () => phoneHost.toggle());
  nativeButton.addEventListener('click', nativeView);
  launcher.addEventListener('click', () => openMain());
  gate.querySelector<HTMLButtonElement>('[data-action="enter"]')?.addEventListener('click', () => void enterApp());
  playerToggle.addEventListener('click', () => updatePlayer(!playerOpen));
  playerHandle.addEventListener('click', () => updatePlayer(true));

  try {
    eventOn(Mvu.events.VARIABLE_INITIALIZED, renderAll);
    eventOn(Mvu.events.VARIABLE_UPDATE_ENDED, renderAll);
    eventOn(tavern_events.CHAT_CHANGED, renderAll);
    eventOn(tavern_events.MESSAGE_RECEIVED, renderAll);
    eventOn(tavern_events.MESSAGE_EDITED, renderAll);
    eventOn(tavern_events.MESSAGE_DELETED, renderAll);
    eventOn(tavern_events.MESSAGE_SWIPED, renderAll);
    eventOn(tavern_events.USER_MESSAGE_RENDERED, renderAll);
    eventOn(tavern_events.CHARACTER_MESSAGE_RENDERED, renderAll);
    eventOn(tavern_events.GENERATION_ENDED, renderAll);
  } catch { /* ignore */ }

  applySettings();
  updatePlayer(true);
  renderAll();
  updateGate();
  const hostWin = hostWindow();
  hostWin.addEventListener('resize', updateGate);
  hostWin.addEventListener('orientationchange', updateGate);
  hostDocument().addEventListener('fullscreenchange', updateGate);
  const syncFullscreen = () => {
    const active = Boolean(document.fullscreenElement || parentDocument()?.fullscreenElement);
    if (!active) restoreFloorFrame();
    if (active === floorFull) return;
    floorFull = active;
    root.dataset.full = String(active);
    fullButton.textContent = active ? '退出全屏' : '全屏';
    updateGate();
  };
  document.addEventListener('fullscreenchange', syncFullscreen);
  try {
    parentDocument()?.addEventListener('fullscreenchange', syncFullscreen);
  } catch {
    // 跨域时无法监听宿主全屏
  }
  window.addEventListener('pagehide', () => {
    hideOpening();
    motion.destroy();
    banner.destroy();
    phoneHost.destroy();
    chat.destroy();
    observatory.destroy();
    launcher.remove();
    root.remove();
    host.body.classList.remove('yuri-front-open');
  }, { once: true });

  const api = {
    openOpening,
    open: openMain,
    isOpen: () => mode !== 'closed',
    phone: {
      open: phoneHost.open,
      close: phoneHost.close,
      toggle: phoneHost.toggle,
      openChat: phoneHost.openChat,
      openNotifications: phoneHost.openNotifications,
      getUnread: phoneHost.getUnread,
      /** 宿主推一条手机通知：主应用负责横幅与角标 */
      notify: (notice: PhoneNotice) => banner.push(notice),
    },
  };
  try {
    if (typeof initializeGlobal === 'function') initializeGlobal('YuriFront', api);
  } catch {
    // 预览或非酒馆助手环境下没有全局共享接口
  }

  return { root, openTab: (tab: ObsTab) => observatory.openTab(tab), ...api };
}
