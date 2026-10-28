import { hostDocument, hostWindow } from './host';
import { readData } from './state';

interface ChatRow {
  message_id: number;
  role: string;
  message: string;
  is_hidden?: boolean;
  name?: string;
  extra?: Record<string, unknown>;
}

interface ChatHandle {
  setInput: (text: string) => void;
  hasInput: () => boolean;
  setStatus: (message: string) => void;
  refresh: () => void;
  destroy: () => void;
}

function make<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string) {
  const el = hostDocument().createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

type MessageSegment = { kind: 'text' | 'page'; content: string };

/* 内容签名取 FNV-1a：长消息只留摘要，逐条比对不涨内存 */
function digest(value: string) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `${(hash >>> 0).toString(36)}:${value.length}`;
}

function formatMessage(row: ChatRow, depth: number) {
  let text = String(row.message ?? '');
  text = text
    .replace(/<update(?:variable)?>[\s\S]*?<\/update(?:variable)?>/gi, '')
    .replace(/<StatusPlaceHolderImpl\s*\/>/gi, '')
    .replace(/<白星1米76>/g, '')
    .replace(/<白星是高冷御姐>/g, '')
    .replace(/<OpeningPlaceHolder\s*\/>/gi, '')
    .replace(/<thinking>[\s\S]*?<\/thinking>/gi, '')
    .replace(/<thought>[\s\S]*?<\/thought>/gi, '');
  if (typeof formatAsTavernRegexedString === 'function') {
    try {
      text = formatAsTavernRegexedString(text, row.role === 'user' ? 'user_input' : 'ai_output', 'display', { depth });
    } catch {
      // 正则不可用时退回原文
    }
  }
  return text;
}

/* 预设正则会把整页 HTML 包在代码围栏里；拆出来单独用 iframe 渲染，正文留在外面 */
function splitMessage(text: string): MessageSegment[] {
  const segments: MessageSegment[] = [];
  const fence = /^```[^\n]*\n([\s\S]*?)^```[ \t]*$/gm;
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = fence.exec(text))) {
    const before = text.slice(last, match.index).trim();
    if (before) segments.push({ kind: 'text', content: before });
    const body = match[1].trim();
    if (body) {
      const isPage = /<!doctype html|<html[\s>]|<body[\s>]/i.test(body);
      segments.push({ kind: isPage ? 'page' : 'text', content: body });
    }
    last = fence.lastIndex;
  }
  const after = text.slice(last).trim();
  if (after) segments.push({ kind: 'text', content: after });
  if (!segments.length && text.trim()) segments.push({ kind: 'text', content: text.trim() });
  return segments;
}

function playerName() {
  try {
    const name = String(readData()?.玩家?._姓名 ?? '').trim();
    return name && name !== '待设定' ? name : '你';
  } catch {
    return '你';
  }
}

function messages(): ChatRow[] {
  try {
    const last = getLastMessageId();
    if (!Number.isInteger(last) || last < 0) return [];
    return (getChatMessages(`0-${last}`) as ChatRow[]).filter(row => row.role !== 'system' && !row.is_hidden);
  } catch {
    return [];
  }
}

function characterName() {
  try {
    return String(SillyTavern.name2 ?? '').trim();
  } catch {
    return '';
  }
}

function speaker(row: ChatRow) {
  if (row.role === 'user') return playerName();
  const name = String(row.name ?? '').trim();
  if (name && name !== 'SillyTavern' && name !== '系统') return name;
  return characterName();
}

function timestamp(value: unknown) {
  if (typeof value === 'number') return value;
  const parsed = Date.parse(String(value ?? ''));
  return Number.isFinite(parsed) ? parsed : null;
}

/* 酒馆把生成起止时间写在 extra.gen_started / gen_finished，用时即两者之差 */
function generationTime(row: ChatRow) {
  const start = timestamp(row.extra?.gen_started);
  const end = timestamp(row.extra?.gen_finished);
  if (start === null || end === null || end < start) return null;
  return `${((end - start) / 1000).toFixed(1)}s`;
}

function meta(row: ChatRow) {
  const box = make('div', 'story-meta');
  box.append(make('span', 'story-id', `#${row.message_id}`));
  const time = generationTime(row);
  if (time) box.append(make('span', 'story-time', time));
  return box;
}

export function mountChat(host: HTMLElement): ChatHandle {
  const scroll = make('div', 'story-scroll');
  const list = make('div', 'story-list');
  scroll.append(list);
  const composer = make('div', 'story-composer');
  const input = make('textarea', 'story-input');
  input.id = 'send_textarea';
  input.rows = 1;
  input.placeholder = '说点什么…';
  input.setAttribute('aria-label', '输入消息');
  const send = make('button', 'story-send', '发送');
  send.id = 'send_but';
  send.type = 'button';
  composer.append(input, send);
  const status = make('p', 'story-status');
  host.append(scroll, composer, status);

  const disposers: Array<() => void> = [];
  const add = (value: unknown) => {
    if (typeof value === 'function') disposers.push(value as () => void);
    else if (value && typeof (value as { stop?: unknown }).stop === 'function') {
      disposers.push(() => (value as { stop: () => void }).stop());
    }
  };

  const onFrameHeight = (event: MessageEvent) => {
    const data = event.data as { type?: string; height?: number } | null;
    if (!data || typeof data.height !== 'number') return;
    if (data.type !== 'yuri-frame-height' && data.type !== 'resizeIframe') return;
    list.querySelectorAll<HTMLIFrameElement>('iframe.story-frame, iframe.story-page-frame').forEach(frame => {
      if (frame.contentWindow === event.source) {
        frame.style.height = `${Math.min(2600, Math.max(24, Math.ceil(data.height as number)))}px`;
      }
    });
  };
  hostWindow().addEventListener('message', onFrameHeight);
  add(() => hostWindow().removeEventListener('message', onFrameHeight));

  function heightScript() {
    const open = String.fromCharCode(60) + 'script>';
    const close = String.fromCharCode(60) + '/script>';
    return `${open}const r=()=>parent.postMessage({type:'yuri-frame-height',height:document.documentElement.scrollHeight},'*');if(window.ResizeObserver){new ResizeObserver(r).observe(document.body);}r();${close}`;
  }

  function narrativeSrcdoc(html: string) {
    const frameStyle = hostWindow().getComputedStyle(host);
    const frameColor = frameStyle.getPropertyValue('--ink').trim() || frameStyle.color;
    const baseStyle = `html,body{margin:0;background:transparent;color:${frameColor};font-family:${frameStyle.fontFamily};font-size:${frameStyle.fontSize};line-height:${frameStyle.lineHeight};white-space:pre-line}*,*::before,*::after{box-sizing:border-box}#story-content *{float:none !important}#story-content div,#story-content section,#story-content article,#story-content header,#story-content footer,#story-content aside,#story-content nav,#story-content table,#story-content thead,#story-content tbody,#story-content tr,#story-content td,#story-content th,#story-content figure{float:none !important;position:static !important;display:block !important;width:auto !important;max-width:100% !important;margin-left:0 !important;margin-right:0 !important}#story-content img,#story-content picture,#story-content svg,#story-content video,#story-content canvas{display:block !important;float:none !important;max-width:100% !important;height:auto !important;margin-left:0 !important;margin-right:0 !important}#story-content a:has(> img){display:block !important}`;
    return `<!doctype html><html><head><meta charset="utf-8"><style>${baseStyle}</style></head><body><div id="story-content">${html}</div>${heightScript()}</body></html>`;
  }

  function pageBridge() {
    return `document.addEventListener('click',(event)=>{const button=event.target.closest?.('.option-btn');if(!button)return;const title=document.getElementById('modeTitle')?.textContent||'';if(!title.includes('直接'))return;const text=button.querySelector('.option-text')?.textContent?.trim()||'';if(!text)return;const parentDoc=window.parent?.document;const textarea=parentDoc?.getElementById('send_textarea');const send=parentDoc?.getElementById('send_but');if(!textarea||!send)return;event.preventDefault();event.stopImmediatePropagation();textarea.value=text;textarea.dispatchEvent(new Event('input',{bubbles:true}));textarea.dispatchEvent(new Event('change',{bubbles:true}));textarea.focus();send.click();window.frameElement?.remove();},true);`;
  }

  function pageSrcdoc(content: string) {
    const open = String.fromCharCode(60) + 'script>';
    const close = String.fromCharCode(60) + '/script>';
    const script = heightScript() + `${open}${pageBridge()}${close}`;
    return /<\/body>/i.test(content) ? content.replace(/<\/body>/i, `${script}</body>`) : `${content}${script}`;
  }

  function setStatus(message: string) {
    status.textContent = message;
    status.hidden = !message;
  }

  /* AI 回复的 HTML iframe 颜色固化在 srcdoc 里；主题切换后要把新墨色写进去 */
  function retheme() {
    const frameStyle = hostWindow().getComputedStyle(host);
    const color = frameStyle.getPropertyValue('--ink').trim() || frameStyle.color;
    list.querySelectorAll<HTMLIFrameElement>('iframe.story-frame').forEach(frame => {
      const doc = frame.contentDocument;
      if (!doc) return;
      doc.documentElement.style.color = color;
      doc.body.style.color = color;
      const content = doc.getElementById('story-content');
      if (content) content.style.color = color;
    });
  }

  let generating = false;
  let awaitingReply = false;
  let modal: HTMLElement | null = null;

  function appendTyping() {
    if (list.querySelector('.story-typing')) return;
    list.append(make('p', 'story-typing', '她正在回应…'));
  }

  const seenIds = new Map<number, string>();
  const nodes = new Map<number, HTMLElement>();
  let painted = false;

  /* 结尾那条的「重新生成」按钮与称呼会随后续消息变，一并进签名才能真正复用节点 */
  function signature(row: ChatRow, name: string, isLast: boolean, segments: MessageSegment[]) {
    const body = segments.map(segment => `${segment.kind}\u0001${segment.content}`).join('\u0002');
    return `${row.message_id}\u0000${row.role}\u0000${isLast ? 1 : 0}\u0000${name}\u0000${digest(body)}`;
  }

  function buildMessage(row: ChatRow, segments: MessageSegment[], name: string, isLast: boolean) {
    const article = make('article', `story-msg story-msg-${row.role === 'user' ? 'user' : 'assistant'}`);
    const head = make('div', 'story-head');
    if (name) head.append(make('div', 'story-speaker', name));
    head.append(meta(row));
    head.append(messageActions(row, isLast));
    const content = make('div', 'story-content');
    segments.forEach(segment => {
      if (segment.kind === 'page') {
        const frame = hostDocument().createElement('iframe');
        frame.className = 'story-page-frame';
        frame.setAttribute('sandbox', 'allow-scripts allow-same-origin');
        frame.setAttribute('title', '预设状态栏');
        frame.srcdoc = pageSrcdoc(segment.content);
        content.append(frame);
        return;
      }
      if (/<[a-z][\s\S]*>/i.test(segment.content)) {
        const frame = hostDocument().createElement('iframe');
        frame.className = 'story-frame';
        frame.setAttribute('sandbox', 'allow-scripts allow-same-origin');
        frame.setAttribute('title', '消息内容');
        frame.srcdoc = narrativeSrcdoc(segment.content);
        content.append(frame);
        return;
      }
      const text = make('div', 'story-bubble story-text');
      text.textContent = segment.content;
      content.append(text);
    });
    article.append(head, content);
    return article;
  }

  function render() {
    const lastId = getLastMessageId();
    const rows = messages();
    const lastRowId = rows[rows.length - 1]?.message_id;
    const ordered: HTMLElement[] = [];
    const arriving: number[] = [];
    const present = new Set<number>();

    rows.forEach(row => {
      const depth = Number.isInteger(lastId) ? Math.max(0, lastId - row.message_id) : 0;
      const segments = splitMessage(formatMessage(row, depth));
      if (!segments.length) return;
      const name = speaker(row);
      const isLast = row.message_id === lastRowId;
      const next = signature(row, name, isLast, segments);
      const known = seenIds.get(row.message_id);
      let article = nodes.get(row.message_id);
      if (!article || known !== next) {
        article?.remove();
        article = buildMessage(row, segments, name, isLast);
        nodes.set(row.message_id, article);
        if (known === undefined) arriving.push(row.message_id);
      }
      seenIds.set(row.message_id, next);
      present.add(row.message_id);
      ordered.push(article);
    });

    seenIds.forEach((_, id) => {
      if (!present.has(id)) seenIds.delete(id);
    });
    nodes.forEach((node, id) => {
      if (present.has(id)) return;
      node.remove();
      nodes.delete(id);
    });

    const typing = list.querySelector<HTMLElement>(':scope > .story-typing');
    ordered.forEach((article, index) => {
      const reference = list.children[index] ?? typing ?? null;
      if (reference !== article) list.insertBefore(article, reference);
    });

    const empty = list.querySelector<HTMLElement>(':scope > .story-empty');
    if (ordered.length) empty?.remove();
    else if (!empty) list.append(make('p', 'story-empty', '故事还没有开始。'));

    // 首屏只让最后两条落下，之后每次只让真正新到的那一两条落下
    const picked = painted ? arriving : arriving.slice(-2);
    picked.forEach((id, index) => {
      const article = nodes.get(id);
      if (!article) return;
      article.style.setProperty('--arrive-delay', `${index * 40}ms`);
      article.classList.add('is-arriving');
    });
    painted = true;

    if (generating) appendTyping();
    scroll.scrollTop = scroll.scrollHeight;
  }

  function resetChat() {
    seenIds.clear();
    nodes.clear();
    painted = false;
    list.querySelectorAll(':scope > .story-msg').forEach(node => node.remove());
    render();
  }

  function typing() {
    if (!awaitingReply) return;
    generating = true;
    appendTyping();
    scroll.scrollTop = scroll.scrollHeight;
  }

  function stopTyping() {
    generating = false;
    list.querySelector('.story-typing')?.remove();
  }

  function onSent() {
    awaitingReply = true;
    render();
  }

  function onReceived() {
    awaitingReply = false;
    stopTyping();
    render();
  }

  function closeModal() {
    modal?.remove();
    modal = null;
  }

  function mountModal(panel: HTMLElement) {
    closeModal();
    const overlay = make('div', 'story-modal');
    overlay.tabIndex = -1;
    overlay.append(panel);
    host.append(overlay);
    modal = overlay;
    return overlay;
  }

  function openEdit(row: ChatRow) {
    if (generating) {
      setStatus('正在生成回复，等这一句结束再编辑。');
      return;
    }
    if (typeof setChatMessages !== 'function') {
      setStatus('当前酒馆助手不支持编辑消息。');
      return;
    }
    const panel = make('form', 'story-modal-panel');
    const title = make('p', 'story-modal-title', '编辑这条消息');
    const input = make('textarea', 'story-modal-input');
    input.value = String(row.message ?? '');
    const actions = make('div', 'story-modal-actions');
    const cancel = make('button', 'story-modal-cancel', '取消');
    cancel.type = 'button';
    const save = make('button', 'story-modal-save', '保存');
    save.type = 'submit';
    actions.append(cancel, save);
    panel.append(title, input, actions);
    const overlay = mountModal(panel);
    let saving = false;
    const close = () => closeModal();
    cancel.addEventListener('click', close);
    overlay.addEventListener('click', event => { if (event.target === overlay) close(); });
    overlay.addEventListener('keydown', event => { if (event.key === 'Escape') close(); });
    panel.addEventListener('submit', async event => {
      event.preventDefault();
      if (saving) return;
      saving = true;
      save.disabled = true;
      try {
        await setChatMessages([{ message_id: row.message_id, message: input.value }]);
        try {
          if (typeof eventEmit === 'function') {
            await eventEmit(tavern_events.MESSAGE_EDITED, row.message_id);
            await eventEmit(tavern_events.MESSAGE_UPDATED, row.message_id);
          }
        } catch { /* 事件桥不可用时忽略 */ }
        close();
        render();
      } catch {
        setStatus('编辑没有保存成功，请再试一次。');
      } finally {
        saving = false;
        save.disabled = false;
      }
    });
    input.focus();
  }

  function confirmDelete(row: ChatRow) {
    return new Promise<boolean>(resolve => {
      const panel = make('div', 'story-modal-panel');
      const title = make('p', 'story-modal-title', `删除第 ${row.message_id} 楼？`);
      const text = make('p', 'story-modal-text', '删除后这条消息和它携带的楼层变量会从聊天里移除，和酒馆原生删除一致。');
      const actions = make('div', 'story-modal-actions');
      const cancel = make('button', 'story-modal-cancel', '取消');
      cancel.type = 'button';
      const confirm = make('button', 'story-modal-confirm', '删除');
      confirm.type = 'button';
      actions.append(cancel, confirm);
      panel.append(title, text, actions);
      const overlay = mountModal(panel);
      const finish = (value: boolean) => {
        closeModal();
        resolve(value);
      };
      cancel.addEventListener('click', () => finish(false));
      confirm.addEventListener('click', () => finish(true));
      overlay.addEventListener('click', event => { if (event.target === overlay) finish(false); });
      overlay.addEventListener('keydown', event => { if (event.key === 'Escape') finish(false); });
      confirm.focus();
    });
  }

  async function removeMessage(row: ChatRow) {
    if (generating) {
      setStatus('正在生成回复，等这一句结束再删除。');
      return;
    }
    if (typeof deleteChatMessages !== 'function') {
      setStatus('当前酒馆助手不支持删除消息。');
      return;
    }
    if (!(await confirmDelete(row))) return;
    try {
      await deleteChatMessages([row.message_id]);
      try {
        if (typeof eventEmit === 'function') await eventEmit(tavern_events.MESSAGE_DELETED, row.message_id);
      } catch { /* 事件桥不可用时忽略 */ }
      render();
    } catch {
      setStatus('删除没有成功，请再试一次。');
    }
  }

  async function regenerateLast() {
    if (generating) {
      setStatus('正在生成回复。');
      return;
    }
    if (typeof triggerSlash !== 'function') {
      setStatus('当前酒馆助手不支持重新生成。');
      return;
    }
    awaitingReply = true;
    typing();
    try {
      await triggerSlash('/regenerate');
    } catch {
      awaitingReply = false;
      stopTyping();
      setStatus('重新生成没有成功，请再试一次。');
    }
  }

  function messageActions(row: ChatRow, isLast: boolean) {
    const bar = make('div', 'story-actions');
    const edit = make('button', 'story-action', '编辑');
    edit.type = 'button';
    edit.setAttribute('aria-label', `编辑第 ${row.message_id} 楼`);
    edit.addEventListener('click', () => openEdit(row));
    const remove = make('button', 'story-action story-action-danger', '删除');
    remove.type = 'button';
    remove.setAttribute('aria-label', `删除第 ${row.message_id} 楼`);
    remove.addEventListener('click', () => void removeMessage(row));
    bar.append(edit, remove);
    if (isLast && row.role !== 'user') {
      const regen = make('button', 'story-action', '重新生成');
      regen.type = 'button';
      regen.setAttribute('aria-label', '重新生成最后一条回复');
      regen.addEventListener('click', () => void regenerateLast());
      bar.append(regen);
    }
    return bar;
  }

  function nativeSend() {
    const doc = hostDocument();
    const textarea = doc.querySelector<HTMLTextAreaElement>('#send_textarea');
    const button = doc.querySelector<HTMLElement>('#send_but, #send_button, #send_but_right');
    if (!textarea || !button || textarea.closest('#yuri-front')) return false;
    textarea.value = input.value;
    const EventCtor = hostWindow().Event ?? Event;
    textarea.dispatchEvent(new EventCtor('input', { bubbles: true }));
    button.click();
    input.value = '';
    input.style.height = '';
    return true;
  }

  function submit() {
    const value = input.value.trim();
    if (!value) return;
    if (nativeSend()) return;
    try {
      triggerSlash(`/send ${value.replace(/\n/g, ' ')}`);
      triggerSlash('/trigger');
      input.value = '';
      input.style.height = '';
    } catch {
      setStatus('原生输入不可用，请切回原生视图。');
    }
  }

  input.addEventListener('input', () => {
    input.style.height = 'auto';
    input.style.height = `${Math.min(input.scrollHeight, 96)}px`;
  });
  input.addEventListener('keydown', event => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  });
  send.addEventListener('click', submit);

  try {
    add(eventOn(tavern_events.MESSAGE_SENT, onSent));
    add(eventOn(tavern_events.MESSAGE_RECEIVED, onReceived));
    add(eventOn(tavern_events.MESSAGE_UPDATED, render));
    add(eventOn(tavern_events.MESSAGE_EDITED, render));
    add(eventOn(tavern_events.MESSAGE_DELETED, render));
    add(eventOn(tavern_events.MESSAGE_SWIPED, render));
    add(eventOn(tavern_events.USER_MESSAGE_RENDERED, render));
    add(eventOn(tavern_events.CHARACTER_MESSAGE_RENDERED, render));
    add(eventOn(tavern_events.CHAT_CHANGED, resetChat));
  } catch { /* ignore */ }
  try {
    add(eventOn(tavern_events.GENERATION_STARTED, typing));
    add(eventOn(tavern_events.GENERATION_ENDED, onReceived));
    add(eventOn(tavern_events.GENERATION_STOPPED, onReceived));
  } catch { /* ignore */ }

  setStatus('');
  render();

  return {
    setInput(text) {
      input.value = text;
      input.focus();
      input.style.height = 'auto';
      input.style.height = `${Math.min(input.scrollHeight, 96)}px`;
    },
    hasInput: () => input.value.trim().length > 0,
    setStatus,
    refresh: render,
    retheme,
    destroy() {
      closeModal();
      while (disposers.length) {
        try { disposers.pop()?.(); } catch { /* ignore */ }
      }
      scroll.remove();
      composer.remove();
      status.remove();
    },
  };
}
