<template>
  <div class="intro-shell">
    <div class="ambient ambient-one" aria-hidden="true"></div>
    <div class="ambient ambient-two" aria-hidden="true"></div>
    <div class="ornament-top" aria-hidden="true">
      <span>✦</span><i></i><span>❀</span><i></i><span>✦</span>
    </div>

    <header class="intro-header">
      <div class="brand-mark" aria-hidden="true">
        <span class="brand-star">✦</span>
        <span class="brand-ring"></span>
        <span class="brand-heart">♡</span>
      </div>
      <div class="brand-copy">
        <p class="eyebrow">WELCOME TO LILY CITY</p>
        <h1>百合花期</h1>
        <p class="subtitle">一段慢慢升温的城市恋爱故事，正等着你推开第一扇门。</p>
      </div>
      <div class="world-note">
        <span class="note-dot"></span>
        2025 · 城市日常
      </div>
    </header>

    <div class="intro-block">
      <div class="block-head">
        <h3><span class="block-glyph" aria-hidden="true">✦</span>出发前的小检查</h3>
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
        <h3><span class="block-glyph" aria-hidden="true">♡</span>来找我玩！</h3>
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
        <h3><span class="block-glyph" aria-hidden="true">✧</span>一分钟上手</h3>
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
        <h3><span class="block-glyph" aria-hidden="true">♻</span>开新档前，先清一下？</h3>
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
  background: #fffaf8;
  color: #4f3e46;
  font-family: 'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif;
}

:global(button),
:global(input) {
  font: inherit;
}

:global(button) {
  cursor: pointer;
}

.intro-shell {
  --ink: #4f3e46;
  --muted: #8d737d;
  --line: #ead8dc;
  --soft-line: #f2e7e8;
  --paper: #fffdfb;
  --pink: #d9899e;
  --pink-deep: #a95773;
  --pink-soft: #fbecef;
  --sage: #8ba59c;
  --cream: #fff6ed;
  position: relative;
  isolation: isolate;
  display: flex;
  flex-direction: column;
  gap: 13px;
  width: min(100%, 780px);
  min-height: 100vh;
  margin: 0 auto;
  overflow: hidden;
  padding: 30px 24px 24px;
  background: #fffaf8;
}

.ambient {
  position: absolute;
  z-index: -1;
  width: 150px;
  height: 150px;
  border: 1px solid rgba(217, 137, 158, 0.22);
  border-radius: 50%;
  pointer-events: none;
  animation: float-slow 8s ease-in-out infinite;
}

.ambient-one {
  top: 110px;
  right: -70px;
}

.ambient-two {
  bottom: 120px;
  left: -95px;
  width: 190px;
  height: 190px;
  border-color: rgba(139, 165, 156, 0.22);
  animation-delay: -3s;
}

.ornament-top {
  position: absolute;
  top: 16px;
  right: 28px;
  display: flex;
  align-items: center;
  gap: 7px;
  color: var(--pink);
  font-family: Georgia, serif;
  font-size: 12px;
  letter-spacing: 0;
  opacity: 0.75;
}

.ornament-top i {
  display: block;
  width: 22px;
  height: 1px;
  background: var(--line);
}

.intro-header {
  display: flex;
  align-items: center;
  gap: 16px;
  min-width: 0;
  padding: 16px 4px 14px;
}

.brand-mark {
  position: relative;
  flex: 0 0 58px;
  width: 58px;
  height: 58px;
  color: var(--pink-deep);
}

.brand-star,
.brand-heart {
  position: absolute;
  display: block;
  font-family: Georgia, serif;
}

.brand-star {
  top: -4px;
  left: 3px;
  color: var(--sage);
  font-size: 16px;
  animation: twinkle 2.8s ease-in-out infinite;
}

.brand-heart {
  right: 2px;
  bottom: -2px;
  font-size: 42px;
  line-height: 1;
  animation: breathe 3.8s ease-in-out infinite;
}

.brand-ring {
  position: absolute;
  top: 14px;
  left: 11px;
  width: 31px;
  height: 31px;
  border: 1px solid var(--pink);
  border-radius: 50%;
}

.brand-copy {
  min-width: 0;
}

.eyebrow {
  margin: 0 0 5px;
  color: var(--pink-deep);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.16em;
  line-height: 1.4;
}

h1 {
  margin: 0;
  color: var(--ink);
  font-family: Georgia, 'Songti SC', serif;
  font-size: 31px;
  font-weight: 500;
  line-height: 1.15;
}

.subtitle {
  margin: 6px 0 0;
  color: var(--muted);
  font-size: 12px;
  line-height: 1.6;
}

.world-note {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-left: auto;
  color: var(--muted);
  font-size: 10px;
  letter-spacing: 0.08em;
  white-space: nowrap;
}

.note-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--pink);
  box-shadow: 0 0 6px rgba(217, 137, 158, 0.7);
}

.intro-block {
  padding: 14px 16px 15px;
  border: 1px solid var(--line);
  border-radius: 14px;
  background: var(--paper);
  box-shadow: 0 1px 0 var(--soft-line), 0 8px 22px rgba(169, 87, 115, 0.07);
}

.block-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 11px;
}

.block-head h3 {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  color: var(--ink);
  font-size: 13.5px;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.block-glyph {
  color: var(--pink);
  font-family: Georgia, serif;
  font-size: 13px;
}

.block-hint {
  margin: 10px 0 0;
  color: var(--muted);
  font-size: 10.5px;
  line-height: 1.75;
}

.mini-button {
  padding: 3px 11px;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: transparent;
  color: var(--muted);
  font-size: 10.5px;
  letter-spacing: 0.04em;
  transition:
    color 0.2s ease,
    border-color 0.2s ease,
    background-color 0.2s ease;
}

.mini-button:hover,
.mini-button:focus-visible {
  border-color: var(--pink);
  color: var(--pink-deep);
  background: var(--pink-soft);
  outline: none;
}

.check-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.check-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 11px 13px;
  border: 1px solid var(--line);
  border-radius: 11px;
  background: #fff;
  transition:
    border-color 0.35s ease,
    background-color 0.35s ease;
}

.check-light {
  position: relative;
  flex: 0 0 12px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  transition:
    background-color 0.35s ease,
    box-shadow 0.35s ease;
}

.check-light::after {
  position: absolute;
  inset: -4px;
  border-radius: 50%;
  content: '';
  opacity: 0.28;
  transition: background-color 0.35s ease;
}

.check-copy {
  display: flex;
  flex: 1 1 auto;
  min-width: 0;
  flex-direction: column;
  gap: 2px;
}

.check-copy strong {
  color: var(--ink);
  font-size: 12.5px;
}

.check-copy strong em {
  margin-left: 6px;
  color: var(--muted);
  font-size: 10px;
  font-style: normal;
  letter-spacing: 0.02em;
}

.check-copy small {
  color: var(--muted);
  font-size: 10.5px;
  line-height: 1.5;
}

.check-verdict {
  flex: 0 0 auto;
  font-size: 10px;
  letter-spacing: 0.06em;
}

.check-card.is-ok {
  border-color: #cfe3d3;
  background: #f5fbf6;
}

.check-card.is-ok .check-light {
  background: #55b476;
  box-shadow: 0 0 8px rgba(85, 180, 118, 0.65);
}

.check-card.is-ok .check-light::after {
  background: #55b476;
}

.check-card.is-ok .check-verdict {
  color: #3f8f5c;
}

.check-card.is-missing {
  border-color: #f0d2d2;
  background: #fff8f8;
}

.check-card.is-missing .check-light {
  background: #d96459;
  box-shadow: 0 0 8px rgba(217, 100, 89, 0.6);
}

.check-card.is-missing .check-light::after {
  background: #d96459;
}

.check-card.is-missing .check-verdict {
  color: #c05046;
}

.link-grid {
  display: flex;
  flex-direction: column;
  gap: 9px;
}

.link-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 13px;
  border: 1px dashed var(--pink);
  border-radius: 11px;
  background: linear-gradient(120deg, var(--pink-soft), #fff 68%);
  color: inherit;
  text-decoration: none;
  transition:
    transform 0.22s ease,
    box-shadow 0.22s ease,
    border-color 0.22s ease;
}

.link-card:hover,
.link-card:focus-visible {
  border-color: var(--pink-deep);
  border-style: solid;
  box-shadow: 0 8px 18px rgba(169, 87, 115, 0.14);
  transform: translateY(-2px);
  outline: none;
}

.link-glyph {
  display: grid;
  flex: 0 0 32px;
  width: 32px;
  height: 32px;
  place-items: center;
  border-radius: 50%;
  background: #fff;
  color: var(--pink-deep);
  font-family: Georgia, serif;
  font-size: 15px;
  box-shadow: inset 0 0 0 1px var(--line);
}

.link-copy {
  display: flex;
  flex: 1 1 auto;
  min-width: 0;
  flex-direction: column;
  gap: 2px;
}

.link-copy strong {
  color: var(--ink);
  font-size: 12.5px;
}

.link-copy small {
  color: var(--muted);
  font-size: 10.5px;
}

.link-arrow {
  color: var(--pink);
  font-size: 14px;
}

.guide-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
  counter-reset: guide;
}

.guide-list li {
  display: flex;
  align-items: baseline;
  gap: 10px;
  color: var(--ink);
  font-size: 12px;
  line-height: 1.65;
}

.guide-list li::before {
  flex: 0 0 auto;
  color: var(--pink);
  font-family: Georgia, serif;
  font-size: 11px;
  letter-spacing: 0.05em;
  content: '0' counter(guide);
  counter-increment: guide;
}

.guide-list b {
  flex: 0 0 auto;
  font-weight: 700;
  white-space: nowrap;
}

.guide-list span {
  flex: 1 1 auto;
  min-width: 0;
  color: var(--muted);
  font-size: 11.5px;
}

.cleanup-block {
  background: linear-gradient(165deg, var(--cream), var(--paper) 72%);
}

.cleanup-note {
  margin: 0 0 11px;
  color: var(--muted);
  font-size: 11px;
  line-height: 1.8;
}

.cleanup-button {
  padding: 9px 18px;
  border: 1px solid var(--pink);
  border-radius: 999px;
  background: #fff;
  color: var(--pink-deep);
  font-size: 12px;
  letter-spacing: 0.04em;
  transition:
    background-color 0.2s ease,
    color 0.2s ease,
    border-color 0.2s ease,
    transform 0.2s ease;
}

.cleanup-button:hover:not(:disabled),
.cleanup-button:focus-visible:not(:disabled) {
  background: var(--pink-soft);
  outline: none;
}

.cleanup-button:disabled {
  cursor: wait;
  opacity: 0.7;
}

.cleanup-button.is-confirm {
  border-color: #d96459;
  background: #d96459;
  color: #fff;
  animation: breathe 1.2s ease-in-out infinite;
}

.cleanup-button.is-done {
  border-color: var(--sage);
  color: #4f7d6d;
}

.cleanup-status {
  margin: 9px 0 0;
  color: var(--muted);
  font-size: 10.5px;
  line-height: 1.75;
}

.primary-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  min-width: 126px;
  min-height: 42px;
  padding: 8px 16px;
  border: 1px solid var(--pink-deep);
  border-radius: 5px;
  background: var(--pink-deep);
  color: #fffdfb;
  font-size: 12px;
  box-shadow: 0 6px 14px rgba(169, 87, 115, 0.16);
  transition:
    transform 0.2s ease,
    background-color 0.2s ease,
    border-color 0.2s ease,
    opacity 0.2s ease;
}

.primary-button:hover:not(:disabled),
.primary-button:focus-visible:not(:disabled) {
  background: #934863;
  outline: none;
  transform: translateY(-2px);
}

.primary-button:disabled {
  cursor: wait;
  opacity: 0.7;
}

.button-arrow {
  font-family: Georgia, serif;
  font-size: 17px;
}

.intro-start {
  margin: 4px auto 0;
  width: min(100%, 340px);
}

.swipe-hint {
  margin: 0 0 6px;
  color: var(--muted);
  font-size: 10.5px;
  letter-spacing: 0.04em;
  text-align: center;
}

@keyframes float-slow {
  0%,
  100% {
    transform: translate3d(0, 0, 0);
  }
  50% {
    transform: translate3d(0, 10px, 0);
  }
}

@keyframes twinkle {
  0%,
  100% {
    opacity: 0.45;
    transform: scale(0.9) rotate(0deg);
  }
  50% {
    opacity: 1;
    transform: scale(1.12) rotate(12deg);
  }
}

@keyframes breathe {
  0%,
  100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.04);
  }
}

@media (max-width: 620px) {
  .intro-shell {
    padding: 24px 14px 18px;
  }

  .intro-header {
    flex-wrap: wrap;
    gap: 12px;
  }

  .world-note {
    display: none;
  }

  h1 {
    font-size: 27px;
  }

  .intro-block {
    padding: 12px 13px 13px;
  }

  .check-card {
    flex-wrap: wrap;
  }

  .check-verdict {
    flex: 1 1 100%;
    padding-left: 24px;
  }
}
</style>
