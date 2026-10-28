<template>
  <div class="intro-shell">
    <header class="intro-header">
      <p class="eyebrow">LILY CITY · NIGHT EDITION</p>
      <div class="cover-head">
        <h1>百合花期</h1>
        <span class="issue-mark" aria-hidden="true">
          <b>01</b>
          <i>夜行</i>
        </span>
      </div>
      <p class="subtitle">一段慢慢升温的城市恋爱故事，正等着你推开第一扇门。</p>
      <div class="cover-rule" aria-hidden="true"></div>
      <div class="world-note">
        <span class="note-dot"></span>
        2025 · 城市日常
      </div>
    </header>

    <div class="intro-block">
      <div class="block-head">
        <h3>出发前的小检查</h3>
        <button type="button" class="mini-button" @click="runEnvCheck">重新检测</button>
      </div>
      <div class="check-list">
        <div class="check-card" :class="env.helper ? 'is-ok' : 'is-missing'">
          <span class="check-light" aria-hidden="true"></span>
          <div class="check-copy">
            <strong>酒馆助手 <em>JS-Slash-Runner</em></strong>
            <small>{{ env.helper ? '已就位，太棒啦！' : '还没装哦——请先在酒馆「扩展」里安装并启用它' }}</small>
          </div>
          <span class="check-verdict">{{ env.helper ? '绿灯 · 已安装' : '红灯 · 未安装' }}</span>
        </div>
        <div class="check-card" :class="env.template ? 'is-ok' : 'is-missing'">
          <span class="check-light" aria-hidden="true"></span>
          <div class="check-copy">
            <strong>提示词模板 <em>ST-Prompt-Template</em></strong>
            <small>{{ env.template ? '已就位，太棒啦！' : '还没装哦——请先在酒馆「扩展」里安装并启用它' }}</small>
          </div>
          <span class="check-verdict">{{ env.template ? '绿灯 · 已安装' : '红灯 · 未安装' }}</span>
        </div>
      </div>
      <p class="block-hint">刚刚装好扩展的话，刷新页面会重新检测 ✦ 两个绿灯都亮起来，体验才完整。</p>
    </div>

    <div class="intro-block">
      <div class="block-head">
        <h3>来找我玩！</h3>
      </div>
      <div class="link-grid">
        <a class="link-card" href="https://discord.gg/bxglyj" target="_blank" rel="noopener noreferrer">
          <span class="link-glyph" aria-hidden="true">☁</span>
          <span class="link-copy">
            <strong>作者的小社区</strong>
            <small>卡更新、闲聊、许愿都在这儿，点我跳转～</small>
          </span>
          <span class="link-arrow" aria-hidden="true">↗</span>
        </a>
        <a class="link-card" href="https://discord.com/channels/1380075940285124724/1558070474104377364" target="_blank" rel="noopener noreferrer">
          <span class="link-glyph" aria-hidden="true">✎</span>
          <span class="link-copy">
            <strong>这张卡的帖子</strong>
            <small>使用说明与更新日志，点我直达～</small>
          </span>
          <span class="link-arrow" aria-hidden="true">↗</span>
        </a>
      </div>
    </div>

    <div class="intro-block">
      <div class="block-head">
        <h3>一分钟上手</h3>
      </div>
      <ol class="guide-list">
        <li><b>填一份档案</b><span>把「你」写进百合市：名字、外貌、生活与关系倾向。</span></li>
        <li><b>走进第一幕</b><span>挑一个开场情境，故事就交给正文里慢慢展开。</span></li>
        <li><b>盯着状态栏</b><span>每层正文里都有一枚小状态栏：天气、关系星图、百合与紫藤的花期，都会跟着剧情生长。</span></li>
        <li><b>别忘了玩手机</b><span>点屏幕上的悬浮按钮掏出手机——微信聊天、朋友圈都开着门。</span></li>
      </ol>
    </div>

    <div class="intro-block cleanup-block">
      <div class="block-head">
        <h3>开新档前，先清一下？</h3>
      </div>
      <p class="cleanup-note">旧存档留下的微信聊天记录（包括世界书里的那条）会跟着角色卡留到新对话里。点一下下面的按钮就能清干净，新故事从零开始～</p>
      <button
        type="button"
        class="cleanup-button"
        :class="{ 'is-confirm': cleanupState === 'confirm', 'is-done': cleanupState === 'done' }"
        :disabled="cleanupState === 'working'"
        @click="requestCleanup"
      >
        {{ cleanupLabel }}
      </button>
      <p v-if="cleanupText" class="cleanup-status">{{ cleanupText }}</p>
    </div>

    <button type="button" class="primary-button intro-start" :disabled="entering" @click="enterForm">
      <span>{{ entering ? '正在进入…' : '开始创建角色' }}</span><span class="button-arrow" aria-hidden="true">→</span>
    </button>
    <p class="swipe-hint">没反应？左右滑动这条消息，就能切换开场白</p>
  </div>
</template>

<script setup lang="ts">
import { tapHaptic } from '../../脚本/主界面/motion';

const env = reactive({ helper: false, template: false });
const cleanupState = ref<'idle' | 'confirm' | 'working' | 'done'>('idle');
const cleanupText = ref('');
const entering = ref(false);

/** 宿主窗口（iframe 里是酒馆页面）；跨域时返回 null */
function hostWindow(): (Window & {
  TavernHelper?: unknown;
  SillyTavern?: {
    getContext?: () => {
      extensions?: Array<{ name?: string; display_name?: string }>;
      extensionSettings?: Record<string, unknown>;
    } | undefined;
  };
}) | null {
  try {
    return window.parent as unknown as Window;
  } catch {
    return null;
  }
}

/** 酒馆助手：先看 iframe 内注入的全局，再用宿主页的扩展注册信息兜底 */
function detectHelper(): boolean {
  const own = window as unknown as Record<string, unknown>;
  if (typeof own.TavernHelper !== 'undefined') return true;
  if (typeof own.waitGlobalInitialized === 'function') return true;
  if (typeof own.triggerSlash === 'function') return true;
  try {
    const host = hostWindow();
    const context = host?.SillyTavern?.getContext?.();
    if (context?.extensions?.some(item => `${item.name ?? ''}${item.display_name ?? ''}`.match(/slash-runner|酒馆助手/i))) return true;
    const scripts = host?.document?.querySelectorAll('script[src]') ?? [];
    for (const script of Array.from(scripts)) {
      if (/slash-runner/i.test((script as HTMLScriptElement).src)) return true;
    }
  } catch {
    // 跨域环境只能靠 iframe 内信号
  }
  return false;
}

/** 提示词模板（ST-Prompt-Template）：靠宿主页的扩展注册信息/脚本特征识别 */
function detectTemplate(): boolean {
  try {
    const host = hostWindow();
    const context = host?.SillyTavern?.getContext?.();
    if (context?.extensions?.some(item => /prompt.?template|提示词模板/i.test(`${item.name ?? ''}${item.display_name ?? ''}`))) return true;
    if (context?.extensionSettings && Object.keys(context.extensionSettings).some(key => /prompt.?template/i.test(key))) return true;
    const scripts = host?.document?.querySelectorAll('script[src]') ?? [];
    for (const script of Array.from(scripts)) {
      if (/prompt-template/i.test((script as HTMLScriptElement).src)) return true;
    }
  } catch {
    // 同上
  }
  return false;
}

function runEnvCheck() {
  env.helper = detectHelper();
  env.template = detectTemplate();
}

onMounted(() => {
  runEnvCheck();
  if (!env.helper || !env.template) {
    // 扩展往往比卡晚一步加载，稍后再对一次，避免误报红灯
    window.setTimeout(runEnvCheck, 2500);
  }
  // 开新档时清掉上一档遗留的「user设定」（仅未提交态；依赖未就绪时稍后重试一次）
  void resetStaleUserProfile().then(done => {
    if (!done) window.setTimeout(() => void resetStaleUserProfile(), 2500);
  });
});

// 清理时保留：接口配置与界面偏好不属于「聊天记录」
const CLEANUP_KEEP = new Set(['ai-config:v1', 'fab-pos:v1', 'shell-mode:v1', 'shell-pos:v1']);

function requestCleanup() {
  if (cleanupState.value === 'confirm') {
    void runCleanup();
    return;
  }
  if (cleanupState.value === 'working') return;
  cleanupState.value = 'confirm';
  cleanupText.value = '再点一次按钮，就真的清理啦！';
  window.setTimeout(() => {
    if (cleanupState.value === 'confirm') {
      cleanupState.value = 'idle';
      cleanupText.value = '';
    }
  }, 5000);
}

async function runCleanup() {
  cleanupState.value = 'working';
  const parts: string[] = [];
  // 本地：清掉所有存档的手机记录
  try {
    const doomed: string[] = [];
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key || !key.startsWith('YuriOpening:phone:')) continue;
      if (!CLEANUP_KEEP.has(key.slice('YuriOpening:phone:'.length))) doomed.push(key);
    }
    doomed.forEach(key => localStorage.removeItem(key));
    parts.push(`本地微信记录已清（${doomed.length} 项）`);
  } catch {
    parts.push('本地存储访问失败');
  }
  // 世界书：清空并停用「微信记录」条目
  try {
    const scope = window as unknown as {
      getCharWorldbookNames?: (type: string) => { primary: string | null; additional: string[] };
      getWorldbook?: (name: string) => Promise<Array<{ name: string }>>;
      updateWorldbookWith?: (
        name: string,
        updater: (list: Array<Record<string, unknown>>) => Array<Record<string, unknown>>,
      ) => Promise<unknown>;
    };
    if (
      typeof scope.getCharWorldbookNames !== 'function' ||
      typeof scope.getWorldbook !== 'function' ||
      typeof scope.updateWorldbookWith !== 'function'
    ) {
      parts.push('未检测到酒馆助手，世界书记录未动');
    } else {
      const names = scope.getCharWorldbookNames('current');
      const bookName = names.primary ?? names.additional?.[0];
      if (!bookName) {
        parts.push('未绑定世界书，跳过');
      } else {
        const entries = await scope.getWorldbook(bookName);
        if (!entries.some(entry => entry.name === '微信记录')) {
          parts.push('世界书里没有旧记录');
        } else {
          await scope.updateWorldbookWith(bookName, list =>
            list.map(entry => (entry.name === '微信记录' ? { ...entry, content: '', enabled: false } : entry)),
          );
          parts.push('世界书「微信记录」已清空并停用');
        }
      }
    }
  } catch {
    parts.push('世界书记录清理失败');
  }
  cleanupText.value = `清理完成 ✦ ${parts.join(' · ')}`;
  cleanupState.value = 'done';
}

/**
 * 开新档时清掉上一档遗留的「user设定」。
 * 档案是世界书里的整卡共享单槽：当前档还没提交表单（开场.$已提交 非 true）时停用它，
 * 等新档提交时由开局表单重新写入。返回是否已处理（false = 依赖未就绪，调用方稍后重试）。
 */
async function resetStaleUserProfile(): Promise<boolean> {
  const scope = window as unknown as {
    getVariables?: (option: { type: 'message'; message_id: string | number }) => unknown;
    getCharWorldbookNames?: (type: string) => { primary: string | null; additional: string[] };
    getWorldbook?: (name: string) => Promise<Array<{ name: string }>>;
    updateWorldbookWith?: (
      name: string,
      updater: (list: Array<Record<string, unknown>>) => Array<Record<string, unknown>>,
    ) => Promise<unknown>;
  };
  if (
    typeof scope.getVariables !== 'function' ||
    typeof scope.getCharWorldbookNames !== 'function' ||
    typeof scope.getWorldbook !== 'function' ||
    typeof scope.updateWorldbookWith !== 'function'
  ) {
    return false;
  }
  try {
    // 读不到状态就不动手：宁可不清理，也不能误删已提交档的档案
    const vars = scope.getVariables({ type: 'message', message_id: 'latest' });
    const statData = vars && typeof vars === 'object' ? (vars as { stat_data?: Record<string, unknown> }).stat_data : undefined;
    const opening =
      statData && typeof statData === 'object'
        ? (statData['开场'] as Record<string, unknown> | undefined)
        : undefined;
    if (opening && opening['$已提交'] === true) return true;

    const names = scope.getCharWorldbookNames('current');
    const bookName = names.primary ?? names.additional?.[0];
    if (!bookName) return true;
    const entries = await scope.getWorldbook(bookName);
    const profile = entries.find(entry => entry.name === 'user设定') as
      | { content?: string; enabled?: boolean }
      | undefined;
    if (!profile) return true;
    if (profile.enabled === false && !profile.content) return true; // 已经是空的，不重复写
    await scope.updateWorldbookWith(bookName, list =>
      list.map(entry => (entry.name === 'user设定' ? { ...entry, content: '', enabled: false } : entry)),
    );
    console.info('[百合花期] 已清空上一档遗留的「user设定」');
    return true;
  } catch {
    // 出错交给调用方重试一次；仍失败则静默放弃，不影响介绍页
    return false;
  }
}

const cleanupLabel = computed(() => {
  if (cleanupState.value === 'confirm') return '再点一次，确认清理！';
  if (cleanupState.value === 'working') return '正在清理…';
  if (cleanupState.value === 'done') return '再清理一次';
  return '清理旧微信记录';
});

/** 进入第二个开场白：在开场白消息上划动即切换，用 /swipe 把本条换成同层主界面 */
async function enterForm() {
  if (entering.value) return;
  entering.value = true;
  tapHaptic();
  try {
    if (typeof triggerSlash === 'function') {
      await triggerSlash('/swipe');
      return;
    }
  } catch {
    // 老版本没有 /swipe 命令时落回手动滑动
  }
  entering.value = false;
}
</script>

<style lang="scss" scoped>
:global(*) {
  box-sizing: border-box;
}

:global(body) {
  margin: 0;
  min-width: 0;
  background: #08080b;
  color: #f4f2ec;
  font-family: 'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', system-ui, sans-serif;
}

:global(button),
:global(input) {
  font: inherit;
}

:global(button) {
  cursor: pointer;
}

/* ── 封面 ───────────────────────────────────────────────────────────── */

.intro-shell {
  --nt-bg: #08080b;
  --nt-panel: #121218;
  --nt-ink: #f4f2ec;
  --nt-ink-soft: #c8c5cf;
  --nt-ink-faint: #8b8896;
  --nt-line: rgba(244, 242, 236, 0.16);
  --nt-rule: rgba(244, 242, 236, 0.09);
  --nt-accent: #ff3b5c;
  --nt-fill: #e01b3f;
  --nt-ok: #6fd3b0;
  --nt-err: #ff8296;
  --nt-hard: 6px 6px 0 rgba(0, 0, 0, 0.55);
  --nt-hard-sm: 3px 3px 0 rgba(0, 0, 0, 0.5);
  --nt-mono: ui-monospace, 'SF Mono', 'JetBrains Mono', 'Roboto Mono', Menlo, Consolas, monospace;
  --nt-sans: 'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', system-ui, sans-serif;

  position: relative;
  isolation: isolate;
  counter-reset: block;
  display: flex;
  flex-direction: column;
  gap: 0;
  width: min(100%, 780px);
  min-height: 100vh;
  margin: 0 auto;
  padding: 38px 24px 26px;
  background: var(--nt-bg);
  color: var(--nt-ink);
  font-family: var(--nt-sans);
}

@media (prefers-color-scheme: light) {
  :global(body) {
    background: #f5f3ee;
    color: #101016;
  }

  .intro-shell {
    --nt-bg: #f5f3ee;
    --nt-panel: #fffefb;
    --nt-ink: #101016;
    --nt-ink-soft: #3b3b45;
    --nt-ink-faint: #6a6a76;
    --nt-line: rgba(16, 16, 22, 0.22);
    --nt-rule: rgba(16, 16, 22, 0.1);
    --nt-accent: #d61a38;
    --nt-fill: #d61a38;
    --nt-ok: #157a5b;
    --nt-err: #b3142d;
    --nt-hard: 6px 6px 0 rgba(16, 16, 22, 0.2);
    --nt-hard-sm: 3px 3px 0 rgba(16, 16, 22, 0.16);
  }
}

.intro-header {
  display: flex;
  flex-direction: column;
  min-width: 0;
  padding: 0 0 16px;
  border-bottom: 2px solid var(--nt-ink);
}

.eyebrow {
  margin: 0 0 14px;
  color: var(--nt-accent);
  font-family: var(--nt-mono);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.18em;
  line-height: 1.4;
  text-transform: uppercase;
}

.cover-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 18px;
  min-width: 0;
}

h1 {
  margin: 0;
  color: var(--nt-ink);
  font-family: var(--nt-sans);
  font-size: clamp(40px, 9vw, 56px);
  font-weight: 900;
  line-height: 0.96;
  letter-spacing: -0.045em;
}

/* 期号：猩红细线 + 编号 + 卷名 */
.issue-mark {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
  flex: 0 0 auto;
  padding-left: 12px;
  border-left: 1px solid var(--nt-line);
  font-family: var(--nt-mono);
  line-height: 1.1;
}

.issue-mark b {
  color: var(--nt-accent);
  font-size: 20px;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.issue-mark i {
  color: var(--nt-ink-faint);
  font-size: 9px;
  font-style: normal;
  letter-spacing: 0.18em;
}

.subtitle {
  margin: 14px 0 0;
  max-width: 46ch;
  color: var(--nt-ink-faint);
  font-size: 12.5px;
  line-height: 1.75;
}

.cover-rule {
  width: 72px;
  height: 2px;
  margin-top: 16px;
  background: var(--nt-accent);
}

.world-note {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-top: 12px;
  color: var(--nt-ink-faint);
  font-family: var(--nt-mono);
  font-size: 9.5px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  white-space: nowrap;
}

.note-dot {
  width: 6px;
  height: 6px;
  background: var(--nt-accent);
}

/* ── 栏目 ───────────────────────────────────────────────────────────── */

.intro-block {
  counter-increment: block;
  padding: 18px 0 16px;
  border-bottom: 1px solid var(--nt-rule);
}

.block-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--nt-line);
}

.block-head h3 {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin: 0;
  color: var(--nt-ink);
  font-size: 15px;
  font-weight: 800;
  letter-spacing: -0.01em;

  &::before {
    content: '0' counter(block);
    color: var(--nt-accent);
    font-family: var(--nt-mono);
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0;
  }
}

.block-hint {
  margin: 12px 0 0;
  color: var(--nt-ink-faint);
  font-size: 10.5px;
  line-height: 1.8;
}

.mini-button {
  padding: 4px 10px;
  border: 1px solid var(--nt-line);
  border-radius: 0;
  background: transparent;
  color: var(--nt-ink-soft);
  font-family: var(--nt-mono);
  font-size: 10px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  transition:
    color 0.12s linear,
    border-color 0.12s linear,
    background 0.12s linear,
    transform 0.08s linear;
}

.mini-button:hover {
  border-color: var(--nt-accent);
  background: var(--nt-accent);
  color: var(--nt-bg);
}

.mini-button:focus-visible {
  border-color: var(--nt-accent);
  outline: 2px solid var(--nt-accent);
  outline-offset: 2px;
}

.mini-button:active {
  transform: translateY(1px);
}

/* ── 环境检测：两行数据表 ───────────────────────────────────────────── */

.check-list {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.check-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 11px 0;
  border: 0;
  border-bottom: 1px solid var(--nt-rule);
  border-radius: 0;
  background: transparent;
  transition: background 0.16s linear;
}

.check-light {
  position: relative;
  flex: 0 0 8px;
  width: 8px;
  height: 8px;
  border-radius: 0;
  transition: background 0.16s linear;
}

.check-copy {
  display: flex;
  flex: 1 1 auto;
  min-width: 0;
  flex-direction: column;
  gap: 3px;
}

.check-copy strong {
  color: var(--nt-ink);
  font-size: 12.5px;
  font-weight: 700;
}

.check-copy strong em {
  margin-left: 7px;
  color: var(--nt-ink-faint);
  font-family: var(--nt-mono);
  font-size: 9px;
  font-style: normal;
  letter-spacing: 0.1em;
}

.check-copy small {
  color: var(--nt-ink-faint);
  font-size: 10.5px;
  line-height: 1.55;
}

.check-verdict {
  flex: 0 0 auto;
  font-family: var(--nt-mono);
  font-size: 9px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.check-card.is-ok .check-light {
  background: var(--nt-ok);
}

.check-card.is-ok .check-verdict {
  color: var(--nt-ok);
}

.check-card.is-missing .check-light {
  background: var(--nt-accent);
}

.check-card.is-missing .check-verdict {
  color: var(--nt-accent);
}

/* ── 链接卡：反色 hover ─────────────────────────────────────────────── */

.link-grid {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.link-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 13px;
  border: 1px solid var(--nt-line);
  border-radius: 0;
  background: transparent;
  color: inherit;
  text-decoration: none;
  transition:
    transform 0.08s linear,
    border-color 0.12s linear,
    background 0.12s linear;
}

.link-card:hover {
  border-color: var(--nt-accent);
  background: var(--nt-accent);
  color: var(--nt-bg);
}

.link-card:focus-visible {
  border-color: var(--nt-accent);
  outline: 2px solid var(--nt-accent);
  outline-offset: 2px;
}

.link-card:active {
  transform: translateY(1px);
}

.link-glyph {
  display: grid;
  flex: 0 0 28px;
  width: 28px;
  height: 28px;
  place-items: center;
  border: 1px solid currentColor;
  border-radius: 0;
  color: var(--nt-accent);
  font-family: var(--nt-mono);
  font-size: 13px;
}

.link-card:hover .link-glyph {
  color: inherit;
}

.link-copy {
  display: flex;
  flex: 1 1 auto;
  min-width: 0;
  flex-direction: column;
  gap: 3px;
}

.link-copy strong {
  color: inherit;
  font-size: 12.5px;
  font-weight: 800;
}

.link-copy small {
  color: var(--nt-ink-faint);
  font-size: 10.5px;
  line-height: 1.5;
}

.link-card:hover .link-copy small {
  color: inherit;
  opacity: 0.82;
}

.link-arrow {
  color: var(--nt-accent);
  font-family: var(--nt-mono);
  font-size: 13px;
}

.link-card:hover .link-arrow {
  color: inherit;
}

/* ── 目录：编号 + 标题 + 页码 ───────────────────────────────────────── */

.guide-list {
  display: flex;
  flex-direction: column;
  gap: 0;
  margin: 0;
  padding: 0;
  list-style: none;
  counter-reset: guide;
}

.guide-list li {
  display: flex;
  align-items: baseline;
  gap: 10px;
  padding: 9px 0;
  border-bottom: 1px solid var(--nt-rule);
  color: var(--nt-ink);
  font-size: 12px;
  line-height: 1.65;
}

.guide-list li::before {
  flex: 0 0 22px;
  color: var(--nt-accent);
  font-family: var(--nt-mono);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.04em;
  content: counter(guide, decimal-leading-zero);
  counter-increment: guide;
}

.guide-list li::after {
  flex: 0 0 auto;
  color: var(--nt-ink-faint);
  font-family: var(--nt-mono);
  font-size: 9.5px;
  letter-spacing: 0.12em;
  content: 'P.0' counter(guide);
}

.guide-list b {
  flex: 0 0 auto;
  font-weight: 800;
  white-space: nowrap;
}

.guide-list span {
  flex: 1 1 auto;
  min-width: 0;
  color: var(--nt-ink-faint);
  font-size: 11.5px;
}

/* ── 清理 ───────────────────────────────────────────────────────────── */

.cleanup-note {
  margin: 0 0 12px;
  color: var(--nt-ink-faint);
  font-size: 11px;
  line-height: 1.85;
}

.cleanup-button {
  padding: 9px 16px;
  border: 1px solid var(--nt-line);
  border-radius: 0;
  background: transparent;
  color: var(--nt-ink);
  font-family: var(--nt-mono);
  font-size: 10.5px;
  letter-spacing: 0.1em;
  transition:
    background 0.12s linear,
    color 0.12s linear,
    border-color 0.12s linear,
    transform 0.08s linear;
}

.cleanup-button:hover:not(:disabled) {
  border-color: var(--nt-accent);
  background: var(--nt-accent);
  color: var(--nt-bg);
}

.cleanup-button:focus-visible:not(:disabled) {
  border-color: var(--nt-accent);
  outline: 2px solid var(--nt-accent);
  outline-offset: 2px;
}

.cleanup-button:active:not(:disabled) {
  transform: translateY(1px);
}

.cleanup-button:disabled {
  cursor: wait;
  opacity: 0.6;
}

.cleanup-button.is-confirm {
  border-color: var(--nt-fill);
  background: var(--nt-fill);
  color: #ffffff;
  font-weight: 700;
}

.cleanup-button.is-done {
  border-color: var(--nt-ok);
  color: var(--nt-ok);
}

.cleanup-status {
  margin: 10px 0 0;
  color: var(--nt-ink-faint);
  font-size: 10.5px;
  line-height: 1.8;
}

/* ── 进入按钮：猩红实底块 + 硬投影 ─────────────────────────────────── */

.primary-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  min-width: 126px;
  min-height: 42px;
  padding: 12px 18px;
  border: 1px solid var(--nt-fill);
  border-radius: 0;
  background: var(--nt-fill);
  color: #ffffff;
  font-family: var(--nt-sans);
  font-size: 13px;
  font-weight: 800;
  letter-spacing: 0.14em;
  box-shadow: var(--nt-hard-sm);
  transition:
    transform 0.08s linear,
    background 0.12s linear,
    color 0.12s linear,
    border-color 0.12s linear,
    box-shadow 0.08s linear,
    opacity 0.12s linear;
}

.primary-button:hover:not(:disabled) {
  background: var(--nt-ink);
  border-color: var(--nt-ink);
  color: var(--nt-bg);
}

.primary-button:focus-visible:not(:disabled) {
  outline: 2px solid var(--nt-accent);
  outline-offset: 3px;
}

.primary-button:active:not(:disabled) {
  transform: translateY(1px);
  box-shadow: none;
}

.primary-button:disabled {
  cursor: wait;
  opacity: 0.6;
  box-shadow: none;
}

.button-arrow {
  font-family: var(--nt-mono);
  font-size: 15px;
}

.intro-start {
  margin: 20px auto 0;
  width: min(100%, 360px);
}

.swipe-hint {
  margin: 12px 0 4px;
  color: var(--nt-ink-faint);
  font-family: var(--nt-mono);
  font-size: 9.5px;
  letter-spacing: 0.14em;
  text-align: center;
}

/* ── 窄屏 ───────────────────────────────────────────────────────────── */

@media (max-width: 620px) {
  .intro-shell {
    padding: 26px 16px 20px;
  }

  .cover-head {
    align-items: flex-start;
    gap: 12px;
  }

  h1 {
    font-size: clamp(34px, 11vw, 44px);
  }

  .world-note {
    display: none;
  }

  .guide-list li::after {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-delay: 0s !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    transition-delay: 0s !important;
  }
}
</style>
