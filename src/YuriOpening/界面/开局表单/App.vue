<template>
  <div class="opening-shell" :class="{ 'is-submitting': submitting }">
    <div class="ambient ambient-one" aria-hidden="true"></div>
    <div class="ambient ambient-two" aria-hidden="true"></div>
    <div class="ornament ornament-top" aria-hidden="true">
      <span>✦</span><i></i><span>❀</span><i></i><span>✦</span>
    </div>

    <header class="opening-header">
      <div class="brand-mark" aria-hidden="true">
        <span class="brand-star">✦</span>
        <span class="brand-ring"></span>
        <span class="brand-heart">♡</span>
      </div>
      <div class="brand-copy">
        <p class="eyebrow">THE FIRST SCENE</p>
        <h1>初遇之前</h1>
        <p class="subtitle">给故事里的你，留下一点恰到好处的注脚。</p>
      </div>
      <div class="world-note">
        <span class="note-dot"></span>
        2025 · 城市日常
      </div>
    </header>

    <section v-if="locked" class="locked-panel" aria-live="polite">
      <div class="locked-symbol" aria-hidden="true">✓</div>
      <p class="eyebrow">THE STORY HAS BEGUN</p>
      <h2>{{ draft.callName || draft.name || '你的故事' }}，准备好了。</h2>
      <p>你的开局档案已经写入这一场聊天。接下来，把第一句话交给故事。</p>
      <div class="locked-line"><span></span><span>档案已保存 · 等待正常剧情继续</span><span></span></div>
      <p v-if="submitStatus" class="submit-status">{{ submitStatus }}</p>
    </section>

    <template v-else>
      <nav class="stepper" aria-label="开局设置进度">
        <button
          v-for="(item, index) in steps"
          :key="item.id"
          type="button"
          class="step-item"
          :class="{ active: step === index, done: step > index }"
          :aria-current="step === index ? 'step' : undefined"
          @click="jumpTo(index)"
        >
          <span class="step-number">{{ step > index ? '✓' : `0${index + 1}` }}</span>
          <span class="step-label">{{ item.label }}</span>
        </button>
      </nav>

      <main class="form-panel">
        <div class="panel-heading">
          <div>
            <p class="eyebrow">{{ currentStep.kicker }}</p>
            <h2 tabindex="-1">{{ currentStep.title }}</h2>
            <p class="heading-description">{{ currentStep.description }}</p>
          </div>
          <div class="page-count" aria-label="当前步骤">
            <strong>0{{ step + 1 }}</strong>
            <span>/ 05</span>
          </div>
        </div>

        <div v-if="errorText" class="form-alert" role="alert">
          <span aria-hidden="true">!</span>{{ errorText }}
        </div>

        <form @submit.prevent="handlePrimary">
          <Transition name="page" mode="out-in">
            <section v-if="step === 0" key="identity" class="step-content">
              <div class="section-intro">
                <span class="section-symbol" aria-hidden="true">01</span>
                <p>先让我们认识你。这里的资料会成为故事中稳定的玩家档案。</p>
              </div>

              <div class="field-grid two-columns">
                <label class="field">
                  <span>你的名字 <b>*</b></span>
                  <input v-model.trim="draft.name" maxlength="24" autocomplete="name" placeholder="例如：林栖" />
                </label>
                <label class="field">
                  <span>希望被怎样称呼</span>
                  <input v-model.trim="draft.callName" maxlength="18" placeholder="留空则使用名字" />
                </label>
              </div>

              <div class="field-grid two-columns identity-row">
                <div class="static-field">
                  <span>性别</span>
                  <strong>女性</strong>
                  <small>本故事的百合主题边界</small>
                </div>
                <label class="field">
                  <span>年龄 <b>*</b></span>
                  <input v-model.number="draft.age" type="number" min="18" inputmode="numeric" placeholder="18" />
                  <small>成年后不设上限，按你的方式进入故事。</small>
                </label>
              </div>

              <label class="field">
                <span>自我呈现</span>
                <textarea
                  v-model.trim="draft.presentation"
                  maxlength="160"
                  rows="3"
                  placeholder="写下你希望被看见的样子：穿着、气质、性别表达、称呼习惯，或者一句简单的自我介绍。"
                ></textarea>
                <small class="field-count">{{ draft.presentation.length }}/160</small>
              </label>
            </section>

            <section v-else-if="step === 1" key="life" class="step-content">
              <div class="section-intro">
                <span class="section-symbol" aria-hidden="true">02</span>
                <p>不必把自己捏得过于精确。几个轻巧的线索，就足够让日常有你的质感。</p>
              </div>

              <div class="field-grid two-columns">
                <label class="field">
                  <span>身高印象</span>
                  <select v-model="draft.height">
                    <option v-for="item in heightOptions" :key="item" :value="item">{{ item }}</option>
                  </select>
                </label>
                <label class="field">
                  <span>发型</span>
                  <select v-model="draft.hair">
                    <option v-for="item in hairOptions" :key="item" :value="item">{{ item }}</option>
                  </select>
                  <input
                    v-if="draft.hair === '随意自定'"
                    v-model.trim="draft.customHair"
                    maxlength="40"
                    placeholder="写下你想要的发型"
                  />
                </label>
                <label class="field">
                  <span>体态 / 气质</span>
                  <select v-model="draft.vibe">
                    <option v-for="item in vibeOptions" :key="item" :value="item">{{ item }}</option>
                  </select>
                  <input
                    v-if="draft.vibe === '随意自定'"
                    v-model.trim="draft.customVibe"
                    maxlength="40"
                    placeholder="写下你的体态或气质"
                  />
                </label>
                <label class="field">
                  <span>穿衣风格</span>
                  <select v-model="draft.clothing">
                    <option v-for="item in clothingOptions" :key="item" :value="item">{{ item }}</option>
                  </select>
                  <input
                    v-if="draft.clothing === '随意自定'"
                    v-model.trim="draft.customClothing"
                    maxlength="40"
                    placeholder="写下你的穿衣风格"
                  />
                </label>
              </div>

              <label class="field">
                <span>一个显著特征 <em>可选</em></span>
                <input v-model.trim="draft.feature" maxlength="80" placeholder="例如：左耳有一颗很小的痣，笑起来时会先抿一下嘴角" />
              </label>

              <div class="subsection-heading">
                <span class="tiny-line"></span>
                <h3>现在的生活落点</h3>
                <span class="tiny-line"></span>
              </div>
              <div class="choice-row">
                <button
                  v-for="item in jobDirections"
                  :key="item.value"
                  type="button"
                  class="choice-pill"
                  :class="{ selected: draft.jobDirection === item.value }"
                  @click="draft.jobDirection = item.value"
                >
                  <span class="pill-mark" aria-hidden="true">{{ item.mark }}</span>
                  {{ item.value }}
                </button>
              </div>
              <p class="choice-note"><span aria-hidden="true">✦</span> 主要攻略角色属于「专业/办公室」方向，选择它，你和她会更容易遇见。</p>
              <label class="field">
                <span>具体职位 / 行业 <em>可选</em></span>
                <input v-model.trim="draft.jobDetail" maxlength="60" placeholder="例如：品牌公司的初级策划 / 独立摄影师 / 社区咖啡店店员" />
              </label>
            </section>

            <section v-else-if="step === 2" key="ability" class="step-content">
              <div class="section-intro ability-intro">
                <span class="section-symbol" aria-hidden="true">03</span>
                <p>这些不是考试分数，只是你在关系里更容易伸手触碰到的方向。每项基础 1 点，再分配 5 点。</p>
                <div class="points-meter">
                  <strong>{{ spentPoints }}</strong><span>/ 5</span>
                  <small>已分配</small>
                </div>
              </div>

              <div class="preset-strip">
                <span class="preset-label">快速构筑</span>
                <button
                  v-for="item in presets"
                  :key="item.value"
                  type="button"
                  class="preset-button"
                  :class="{ selected: selectedPreset === item.value }"
                  @click="applyPreset(item.value)"
                >
                  {{ item.label }}
                </button>
              </div>

              <div class="ability-list">
                <div v-for="item in abilityList" :key="item.key" class="ability-row">
                  <div class="ability-copy">
                    <strong>{{ item.label }}</strong>
                    <span>{{ item.description }}</span>
                  </div>
                  <div class="ability-control">
                    <button
                      type="button"
                      class="stepper-button"
                      :disabled="draft.abilities[item.key] <= 1"
                      :aria-label="`减少${item.label}`"
                      @click="changeAbility(item.key, -1)"
                    >−</button>
                    <span class="ability-value" :class="{ 'level-high': draft.abilities[item.key] === 3 }">{{ draft.abilities[item.key] }}</span>
                    <button
                      type="button"
                      class="stepper-button"
                      :disabled="draft.abilities[item.key] >= 3 || spentPoints >= 5"
                      :aria-label="`增加${item.label}`"
                      @click="changeAbility(item.key, 1)"
                    >+</button>
                  </div>
                </div>
              </div>

              <div class="ability-note"><span aria-hidden="true">♡</span> 高能力会让某些细节更容易被你捕捉，但不会替你决定关系的走向。</div>
            </section>

            <section v-else-if="step === 3" key="flavor" class="step-content">
              <div class="section-intro">
                <span class="section-symbol" aria-hidden="true">04</span>
                <p>最后放入两颗属于你的生活锚点，再选一扇进入第一幕的门。</p>
              </div>

              <div class="talent-block">
                <div class="subsection-heading left-heading">
                  <span class="tiny-line"></span>
                  <h3>主特长 <em>会反复成为剧情钩子</em></h3>
                </div>
                <div v-for="group in talentGroups" :key="`main-${group.name}`" class="talent-group">
                  <span class="group-label">{{ group.name }}</span>
                  <div class="chip-row">
                    <button
                      v-for="item in group.items"
                      :key="`main-${item}`"
                      type="button"
                      class="talent-chip"
                      :class="{ selected: draft.mainTalent === item }"
                      @click="draft.mainTalent = item"
                    >{{ item }}</button>
                  </div>
                </div>
                <label v-if="draft.mainTalent === '自定义'" class="field compact-field">
                  <span>写下你的主特长</span>
                  <input v-model.trim="draft.customMainTalent" maxlength="40" placeholder="例如：修复旧相机" />
                </label>
              </div>

              <div class="talent-block interest-block">
                <div class="subsection-heading left-heading">
                  <span class="tiny-line"></span>
                  <h3>兴趣 <em>最多选三项，留下轻盈的生活细节</em></h3>
                  <span class="interest-count" :class="{ full: draft.interests.length >= interestLimit }">
                    已选 {{ draft.interests.length }}/{{ interestLimit }}
                  </span>
                </div>
                <div v-for="group in interestGroups" :key="`interest-${group.name}`" class="talent-group">
                  <span class="group-label">{{ group.name }}</span>
                  <div class="chip-row">
                    <button
                      v-for="item in group.items"
                      :key="`interest-${item}`"
                      type="button"
                      class="talent-chip"
                      :class="{ selected: draft.interests.includes(item) }"
                      :disabled="!draft.interests.includes(item) && draft.interests.length >= interestLimit"
                      @click="toggleInterest(item)"
                    >{{ item }}</button>
                  </div>
                </div>
                <label v-if="draft.interests.includes('自定义')" class="field compact-field">
                  <span>写下你的兴趣</span>
                  <input v-model.trim="draft.customInterest" maxlength="40" placeholder="例如：收集城市里的旧招牌" />
                </label>
              </div>

              <div class="subsection-heading left-heading scene-heading">
                <span class="tiny-line"></span>
                <h3>第一幕的情绪入口</h3>
              </div>
              <div class="scene-grid">
                <button
                  v-for="scene in scenes"
                  :key="scene.value"
                  type="button"
                  class="scene-option"
                  :class="{ selected: draft.scenario === scene.value }"
                  @click="draft.scenario = scene.value"
                >
                  <span class="scene-glyph" aria-hidden="true">{{ scene.glyph }}</span>
                  <span class="scene-text"><strong>{{ scene.value }}</strong><small>{{ scene.preview }}</small></span>
                  <span class="select-mark" aria-hidden="true">{{ draft.scenario === scene.value ? '✓' : '' }}</span>
                </button>
              </div>
            </section>

            <section v-else key="preview" class="step-content preview-content">
              <div class="section-intro">
                <span class="section-symbol" aria-hidden="true">05</span>
                <p>这是提交前的最后一眼。确认后仍可回到前面修改，直到你按下“开始这一幕”。</p>
              </div>

              <div class="preview-sheet">
                <div class="preview-ribbon">YOUR PROFILE</div>
                <div class="preview-header">
                  <div class="preview-avatar" aria-hidden="true">{{ (draft.callName || draft.name || '你').slice(0, 1) }}</div>
                  <div><h3>{{ draft.callName || draft.name || '未命名' }}</h3><p>{{ draft.age || 18 }} 岁 · 女性 · {{ resolvedVibe }}气质</p></div>
                </div>
                <div class="preview-lines">
                  <div><span>自我呈现</span><strong>{{ draft.presentation || '保持自然，让细节在故事里慢慢出现。' }}</strong></div>
                  <div><span>生活落点</span><strong>{{ draft.jobDirection }}<template v-if="draft.jobDetail"> · {{ draft.jobDetail }}</template></strong></div>
                  <div><span>外貌印象</span><strong>{{ draft.height }} · {{ resolvedHair }} · {{ resolvedClothing }}</strong></div>
                  <div><span>特长 / 兴趣</span><strong>{{ resolvedMainTalent }} / {{ resolvedInterests.join('、') }}</strong></div>
                </div>
                <div class="preview-scene"><span>{{ selectedScene.glyph }}</span><div><small>第一幕</small><strong>{{ draft.scenario }}</strong><p>{{ selectedScene.preview }}</p></div></div>
              </div>

              <div class="preview-abilities">
                <div class="subsection-heading left-heading"><span class="tiny-line"></span><h3>关系能力配置</h3></div>
                <div class="preview-ability-list">
                  <div v-for="item in abilityList" :key="`preview-${item.key}`" class="preview-ability">
                    <span>{{ item.label }}</span>
                    <i v-for="level in 3" :key="level" :class="{ filled: level <= draft.abilities[item.key] }"></i>
                  </div>
                </div>
              </div>

              <div class="profile-write-note">
                <span aria-hidden="true">✎</span>
                <p>提交后，你填写的档案会以原文写入世界书条目「user设定」（角色定义之后生效）；没有填写的项目，会依据你的选择自动补全。</p>
              </div>
              <details class="profile-preview">
                <summary>将写入世界书的档案</summary>
                <pre>{{ profilePreview }}</pre>
              </details>
            </section>
          </Transition>

          <div class="form-actions">
            <button v-if="step > 0" type="button" class="text-button" @click="previousStep"><span aria-hidden="true">←</span> 返回修改</button>
            <span v-else class="action-spacer"></span>
            <button type="submit" class="primary-button" :disabled="submitting">
              <span v-if="submitting" class="button-loader" aria-hidden="true"></span>
              <template v-else><span>{{ step === 4 ? '开始这一幕' : '继续' }}</span><span class="button-arrow" aria-hidden="true">{{ step === 4 ? '✦' : '→' }}</span></template>
            </button>
          </div>
        </form>
      </main>
    </template>

    <footer class="opening-footer">
      <span>轻柔地选择，不必一次决定全部。</span>
      <span aria-hidden="true">·</span>
      <span>你的故事从确认之后才真正开始</span>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { Schema, type OpeningState } from '../../schema';
import { buildUserProfile, writeUserProfileToWorldbook } from './user-profile';

type AbilityKey = '共情' | '表达' | '观察' | '勇气' | '边界感';
type Scenario = '温和日常' | '意外事件' | '暧昧试探';
type Draft = {
  name: string;
  callName: string;
  age: number;
  presentation: string;
  height: string;
  hair: string;
  customHair: string;
  vibe: string;
  customVibe: string;
  clothing: string;
  customClothing: string;
  feature: string;
  jobDirection: string;
  jobDetail: string;
  abilities: Record<AbilityKey, number>;
  mainTalent: string;
  customMainTalent: string;
  interests: string[];
  customInterest: string;
  scenario: Scenario;
};

const steps = [
  { id: 'identity', label: '关于你', kicker: 'A LITTLE ABOUT YOU', title: '先从你开始', description: '名字、年龄，以及你希望被看见的方式。' },
  { id: 'life', label: '生活质地', kicker: 'YOUR EVERYDAY TEXTURE', title: '给日常一点轮廓', description: '那些不必解释太多，却会悄悄留下痕迹的细节。' },
  { id: 'ability', label: '关系能力', kicker: 'YOUR RELATIONSHIP TONE', title: '你怎样靠近一个人', description: '选择你的本能方向，再把剩下的五点放到心里。' },
  { id: 'flavor', label: '第一幕', kicker: 'THE FIRST ENTRANCE', title: '选一扇进入故事的门', description: '主特长、兴趣和第一幕情绪，会成为最初的空气。' },
  { id: 'preview', label: '确认', kicker: 'ONE LAST LOOK', title: '这就是此刻的你', description: '确认后仍可返回修改，直到你准备好让故事向前。' },
] as const;

const heightOptions = ['娇小', '中等', '高挑'];
const hairOptions = ['短发', '中长发', '长发', '随意自定'];
const vibeOptions = ['清爽', '温柔', '利落', '安静', '随意自定'];
const clothingOptions = ['简约通勤', '轻松休闲', '清纯柔和', '利落中性', '随意自定'];
const abilityList: Array<{ key: AbilityKey; label: string; description: string }> = [
  { key: '共情', label: '共情', description: '察觉情绪，接住没有说完的话' },
  { key: '表达', label: '表达', description: '说清感受，也说清想要什么' },
  { key: '观察', label: '观察', description: '捕捉细节、停顿和微小变化' },
  { key: '勇气', label: '勇气', description: '在重要时刻主动向前一步' },
  { key: '边界感', label: '边界感', description: '保持自我，也尊重彼此的距离' },
];
const presets = [
  { value: '均衡', label: '均衡', values: { 共情: 2, 表达: 2, 观察: 2, 勇气: 2, 边界感: 2 } },
  { value: '温柔理解', label: '温柔理解', values: { 共情: 3, 表达: 3, 观察: 1, 勇气: 1, 边界感: 2 } },
  { value: '敏锐观察', label: '敏锐观察', values: { 共情: 2, 表达: 1, 观察: 3, 勇气: 1, 边界感: 3 } },
  { value: '主动推进', label: '主动推进', values: { 共情: 1, 表达: 2, 观察: 1, 勇气: 3, 边界感: 3 } },
  { value: '稳定边界', label: '稳定边界', values: { 共情: 1, 表达: 2, 观察: 2, 勇气: 2, 边界感: 3 } },
] as const;
const jobDirections = [
  { value: '专业/办公室', mark: '◇' },
  { value: '服务/生活', mark: '○' },
  { value: '自由/创作', mark: '✦' },
];
const talentGroups = [
  { name: '生活创造', items: ['摄影', '烹饪/烘焙', '手作', '园艺'] },
  { name: '职场能力', items: ['文案与写作', '设计审美', '数据技术', '沟通协调', '整理规划'] },
  { name: '兴趣爱好', items: ['音乐/乐器', '运动', '旅行与城市探索', '自定义'] },
];
const interestGroups = [
  { name: '生活创造', items: ['摄影', '烹饪/烘焙', '手作', '园艺'] },
  { name: '职场能力', items: ['文字/设计', '技术整理', '沟通观察', '自定义'] },
  { name: '兴趣爱好', items: ['阅读', '影视', '游戏', '音乐', '旅行', '自定义'] },
];
const interestLimit = 3;
const interestOptions = interestGroups.flatMap(group => group.items).filter(item => item !== '自定义');
const scenes = [
  { value: '温和日常' as Scenario, glyph: '☼', preview: '从一段不急着说完的日常开始，让靠近像光落在桌边。' },
  { value: '意外事件' as Scenario, glyph: '✧', preview: '一件小小的意外把两个人推到同一处，故事因此有了第一声回响。' },
  { value: '暧昧试探' as Scenario, glyph: '◌', preview: '有人先递出一根看不见的线，等你决定要不要轻轻牵住。' },
];

const step = ref(0);
const selectedPreset = ref('均衡');
const errorText = ref('');
const submitStatus = ref('');
const submitting = ref(false);
const locked = ref(false);

const draft = reactive<Draft>({
  name: '',
  callName: '',
  age: 24,
  presentation: '',
  height: '中等',
  hair: '中长发',
  customHair: '',
  vibe: '清爽',
  customVibe: '',
  clothing: '简约通勤',
  customClothing: '',
  feature: '',
  jobDirection: '专业/办公室',
  jobDetail: '',
  abilities: { 共情: 2, 表达: 2, 观察: 2, 勇气: 2, 边界感: 2 },
  mainTalent: '摄影',
  customMainTalent: '',
  interests: ['阅读'],
  customInterest: '',
  scenario: '温和日常',
});

const currentStep = computed(() => steps[step.value]);
const spentPoints = computed(() => Object.values(draft.abilities).reduce((total, value) => total + value, 0) - 5);
const resolvedHair = computed(() => draft.hair === '随意自定' ? draft.customHair.trim() : draft.hair);
const resolvedVibe = computed(() => draft.vibe === '随意自定' ? draft.customVibe.trim() : draft.vibe);
const resolvedClothing = computed(() => draft.clothing === '随意自定' ? draft.customClothing.trim() : draft.clothing);
const resolvedMainTalent = computed(() => draft.mainTalent === '自定义' ? draft.customMainTalent.trim() : draft.mainTalent);
const resolvedInterests = computed(() => {
  const chosen = draft.interests.filter(item => item !== '自定义');
  if (draft.interests.includes('自定义') && draft.customInterest.trim()) {
    chosen.push(draft.customInterest.trim());
  }
  return chosen;
});
const selectedScene = computed(() => scenes.find(scene => scene.value === draft.scenario) ?? scenes[0]);
const profilePreview = computed(() => buildUserProfile(buildState(false)));

function applyPreset(name: string) {
  const preset = presets.find(item => item.value === name);
  if (!preset) return;
  Object.assign(draft.abilities, preset.values);
  selectedPreset.value = name;
}

function changeAbility(key: AbilityKey, amount: number) {
  const next = draft.abilities[key] + amount;
  if (next < 1 || next > 3) return;
  if (amount > 0 && spentPoints.value >= 5) return;
  draft.abilities[key] = next;
  selectedPreset.value = '';
}

function toggleInterest(item: string) {
  const index = draft.interests.indexOf(item);
  if (index >= 0) {
    draft.interests.splice(index, 1);
    return;
  }
  if (draft.interests.length >= interestLimit) return;
  draft.interests.push(item);
}

function validateStep(index: number) {
  if (index === 0) {
    if (!draft.name.trim()) return '请先给自己写下一个名字。';
    if (!Number.isFinite(draft.age) || draft.age < 18) return '年龄需要是 18 岁或以上。';
  }
  if (index === 1) {
    if (!resolvedHair.value) return '请写下你想要的发型。';
    if (!resolvedVibe.value) return '请写下你的体态或气质。';
    if (!resolvedClothing.value) return '请写下你的穿衣风格。';
  }
  if (index === 2 && spentPoints.value !== 5) return '还需要把 5 点能力点分配完。';
  if (index === 3) {
    if (!resolvedMainTalent.value) return '请为自己选一项主特长，或写下自定义特长。';
    if (draft.interests.includes('自定义') && !draft.customInterest.trim()) return '请写下你的自定义兴趣，或取消选择它。';
    if (!resolvedInterests.value.length) return '请为自己选至少一项兴趣。';
  }
  return '';
}

function nextStep() {
  const message = validateStep(step.value);
  if (message) {
    errorText.value = message;
    return;
  }
  errorText.value = '';
  step.value = Math.min(step.value + 1, steps.length - 1);
  scrollToTop();
}

function previousStep() {
  errorText.value = '';
  step.value = Math.max(step.value - 1, 0);
  scrollToTop();
}

function jumpTo(index: number) {
  if (index >= step.value) return;
  errorText.value = '';
  step.value = index;
  scrollToTop();
}

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function buildState(submitted: boolean): OpeningState {
  return Schema.parse({
    玩家: {
      _姓名: draft.name.trim() || '未命名',
      _称呼: draft.callName.trim(),
      _性别: '女性',
      _年龄: Math.max(18, Number(draft.age) || 18),
      _自我呈现: draft.presentation.trim() || '自然、舒适',
      _外貌: {
        _身高: draft.height,
        _发型: resolvedHair.value,
        _气质: resolvedVibe.value,
        _穿衣: resolvedClothing.value,
        _特征: draft.feature.trim(),
      },
      _职业: {
        _方向: draft.jobDirection,
        _具体: draft.jobDetail.trim(),
      },
      _能力: { ...draft.abilities },
      _主特长: resolvedMainTalent.value,
      _兴趣: resolvedInterests.value,
    },
    开场: {
      _情境: draft.scenario,
      $已提交: submitted,
    },
  });
}

function persistState(submitted: boolean) {
  const state = buildState(submitted);
  const option: VariableOption = { type: 'message', message_id: getCurrentMessageId() };
  updateVariablesWith(variables => {
    const current = _.get(variables, 'stat_data', {});
    const merged = _.merge({}, current, state);
    // lodash.merge 对数组按索引合并，兴趣数组需要整体覆盖
    _.set(merged, '玩家._兴趣', state.玩家._兴趣);
    _.set(variables, 'stat_data', merged);
    return variables;
  }, option);
}

function buildOpeningMessage(state: OpeningState) {
  const player = state.玩家;
  const name = player._称呼 || player._姓名;
  const job = [player._职业._方向, player._职业._具体].filter(Boolean).join('，');
  const appearance = [player._外貌._身高, player._外貌._发型, `${player._外貌._气质}气质`, player._外貌._穿衣]
    .filter(Boolean)
    .join('、');
  const abilityFocus = Object.entries(player._能力)
    .filter(([, value]) => value === 3)
    .map(([key]) => key)
    .join('、');
  return [
    `我叫${player._姓名}，希望被称为${name}。我是一名 ${player._年龄} 岁的女性。`,
    `我希望以这样的方式被看见：${player._自我呈现}。我的外貌印象是${appearance}${player._外貌._特征 ? `，显著特征是${player._外貌._特征}` : ''}。`,
    `我目前的生活落点是${job || '一段正在展开的新生活'}。我的主特长是${player._主特长}，平时喜欢${player._兴趣.join('、')}。`,
    `在与人靠近时，我更擅长${abilityFocus || '慢慢观察再做决定'}。我想从“${state.开场._情境}”的氛围开始这段故事。`,
  ].join('\n\n');
}

async function submitOpening() {
  if (submitting.value || locked.value) return;
  const message = validateStep(3);
  if (message) {
    step.value = 3;
    errorText.value = message;
    return;
  }
  submitting.value = true;
  errorText.value = '';
  let messageCreated = false;
  try {
    const state = buildState(true);
    persistState(true);
    const profileWrite = await writeUserProfileToWorldbook(buildUserProfile(state));
    if (!profileWrite.ok) {
      toastr.warning(`用户设定未能写入世界书：${profileWrite.reason}`, '开局提醒');
    }
    await createChatMessages([
      {
        role: 'user',
        name: state.玩家._称呼 || state.玩家._姓名,
        message: buildOpeningMessage(state),
      },
    ]);
    messageCreated = true;
    locked.value = true;
    submitStatus.value = '档案已保存，正在把第一句话交给故事……';
    await triggerSlash('/trigger');
  } catch (error) {
    console.error('[百合花期] opening submit failed', error);
    if (!messageCreated) {
      try {
        persistState(false);
      } catch (rollbackError) {
        console.error('[百合花期] opening rollback failed', rollbackError);
      }
      errorText.value = '开局没有提交成功，资料仍可修改，请稍后再试。';
    } else {
      locked.value = true;
      submitStatus.value = '档案已保存，但自动生成未完成。你可以直接在酒馆输入框继续。';
    }
  } finally {
    submitting.value = false;
  }
}

function loadExistingState() {
  // 未安装酒馆助手时没有变量接口：跳过回填，由介绍页的红灯提示先装扩展
  if (typeof getVariables !== 'function' || typeof getCurrentMessageId !== 'function') return;
  const option: VariableOption = { type: 'message', message_id: getCurrentMessageId() };
  const raw = _.get(getVariables(option), 'stat_data', {});
  const result = Schema.safeParse(raw);
  if (!result.success) return;
  const state = result.data;
  draft.name = state.玩家._姓名 === '未命名' ? '' : state.玩家._姓名;
  draft.callName = state.玩家._称呼;
  draft.age = state.玩家._年龄;
  draft.presentation = state.玩家._自我呈现 === '自然、舒适' ? '' : state.玩家._自我呈现;
  draft.height = state.玩家._外貌._身高;
  draft.hair = hairOptions.includes(state.玩家._外貌._发型) ? state.玩家._外貌._发型 : '随意自定';
  draft.customHair = draft.hair === '随意自定' ? state.玩家._外貌._发型 : '';
  draft.vibe = vibeOptions.includes(state.玩家._外貌._气质) ? state.玩家._外貌._气质 : '随意自定';
  draft.customVibe = draft.vibe === '随意自定' ? state.玩家._外貌._气质 : '';
  draft.clothing = clothingOptions.includes(state.玩家._外貌._穿衣) ? state.玩家._外貌._穿衣 : '随意自定';
  draft.customClothing = draft.clothing === '随意自定' ? state.玩家._外貌._穿衣 : '';
  draft.feature = state.玩家._外貌._特征;
  draft.jobDirection = state.玩家._职业._方向;
  draft.jobDetail = state.玩家._职业._具体;
  Object.assign(draft.abilities, state.玩家._能力);
  draft.mainTalent = state.玩家._主特长;
  const knownInterests = state.玩家._兴趣.filter(item => interestOptions.includes(item));
  const customInterests = state.玩家._兴趣.filter(item => !interestOptions.includes(item));
  draft.interests = knownInterests.slice(0, interestLimit);
  if (customInterests.length > 0 && draft.interests.length < interestLimit) {
    draft.interests.push('自定义');
    draft.customInterest = customInterests.join('、');
  } else {
    draft.customInterest = '';
  }
  draft.scenario = state.开场._情境;
  locked.value = state.开场.$已提交;
}

loadExistingState();

function handlePrimary() {
  if (step.value === steps.length - 1) {
    void submitOpening();
  } else {
    nextStep();
  }
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
:global(input),
:global(select),
:global(textarea) {
  font: inherit;
}

:global(button) {
  cursor: pointer;
}

.opening-shell {
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

.opening-header {
  display: flex;
  align-items: center;
  gap: 16px;
  min-width: 0;
  padding: 16px 4px 28px;
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

h1,
h2,
h3,
p {
  overflow-wrap: anywhere;
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
  margin: 7px 0 0;
  color: var(--muted);
  font-size: 12px;
  line-height: 1.6;
}

.world-note {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-left: auto;
  padding: 7px 10px;
  border: 1px solid var(--line);
  color: var(--muted);
  font-size: 10px;
  line-height: 1.3;
  white-space: nowrap;
}

.note-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--sage);
  box-shadow: 0 0 0 3px rgba(139, 165, 156, 0.14);
}

.stepper {
  display: flex;
  gap: 3px;
  margin-bottom: 14px;
  padding: 5px;
  border: 1px solid var(--line);
  background: rgba(255, 253, 251, 0.76);
}

.step-item {
  display: flex;
  flex: 1 1 0;
  align-items: center;
  justify-content: center;
  gap: 7px;
  min-width: 0;
  min-height: 38px;
  padding: 6px 4px;
  border: 0;
  background: transparent;
  color: #b49ba3;
  font-size: 11px;
  transition: color 0.2s ease, background-color 0.2s ease;
}

.step-item:hover,
.step-item:focus-visible {
  color: var(--pink-deep);
  outline: none;
  background: #fff7f6;
}

.step-item.active {
  background: var(--pink-soft);
  color: var(--pink-deep);
}

.step-item.done {
  color: var(--sage);
}

.step-number {
  display: grid;
  place-items: center;
  flex: 0 0 20px;
  width: 20px;
  height: 20px;
  border: 1px solid currentColor;
  border-radius: 50%;
  font-size: 9px;
  line-height: 1;
}

.step-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.form-panel,
.locked-panel {
  position: relative;
  border: 1px solid var(--line);
  background: var(--paper);
  box-shadow: 0 12px 28px rgba(148, 91, 111, 0.08);
}

.form-panel {
  padding: 28px 30px 20px;
}

.panel-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
  padding-bottom: 23px;
  border-bottom: 1px solid var(--soft-line);
}

.panel-heading h2,
.locked-panel h2 {
  margin: 0;
  color: var(--ink);
  font-family: Georgia, 'Songti SC', serif;
  font-size: 25px;
  font-weight: 500;
  line-height: 1.3;
}

.heading-description {
  max-width: 470px;
  margin: 8px 0 0;
  color: var(--muted);
  font-size: 12px;
  line-height: 1.7;
}

.page-count {
  flex: 0 0 auto;
  padding-top: 4px;
  color: var(--muted);
  font-family: Georgia, serif;
  white-space: nowrap;
}

.page-count strong {
  color: var(--pink-deep);
  font-size: 27px;
  font-weight: 500;
}

.page-count span {
  font-size: 11px;
}

.step-content {
  min-height: 430px;
  padding-top: 24px;
}

.section-intro {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 24px;
  color: var(--muted);
  font-size: 12px;
  line-height: 1.7;
}

.section-intro p {
  max-width: 530px;
  margin: 0;
}

.section-symbol {
  display: inline-grid;
  place-items: center;
  flex: 0 0 28px;
  width: 28px;
  height: 28px;
  border: 1px solid var(--pink);
  border-radius: 50%;
  color: var(--pink-deep);
  font-family: Georgia, serif;
  font-size: 10px;
}

.field-grid {
  display: grid;
  gap: 16px;
}

.two-columns {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.field,
.static-field {
  position: relative;
  display: flex;
  flex-direction: column;
  min-width: 0;
  gap: 7px;
}

.field > span,
.static-field > span {
  color: var(--ink);
  font-size: 12px;
  font-weight: 600;
}

.field b {
  color: var(--pink-deep);
  font-weight: 700;
}

.field em {
  margin-left: 5px;
  color: #b69da5;
  font-size: 10px;
  font-style: normal;
  font-weight: 400;
}

.field input,
.field select,
.field textarea {
  width: 100%;
  min-width: 0;
  border: 1px solid var(--line);
  border-radius: 4px;
  background: #fffaf9;
  color: var(--ink);
  font-size: 13px;
  line-height: 1.5;
  outline: none;
  transition: border-color 0.2s ease, box-shadow 0.2s ease, background-color 0.2s ease;
}

.field input,
.field select {
  min-height: 42px;
  padding: 9px 11px;
}

.field textarea {
  min-height: 86px;
  resize: vertical;
  padding: 10px 11px;
}

.field input::placeholder,
.field textarea::placeholder {
  color: #c4afb5;
}

.field input:focus,
.field select:focus,
.field textarea:focus {
  border-color: var(--pink);
  background: #fffdfc;
  box-shadow: 0 0 0 3px rgba(217, 137, 158, 0.13);
}

.field small,
.static-field small {
  color: #b1979f;
  font-size: 10px;
  font-weight: 400;
  line-height: 1.5;
}

.field-count {
  align-self: flex-end;
  margin-top: -4px;
}

.identity-row {
  margin-top: 16px;
}

.static-field {
  justify-content: center;
  min-height: 75px;
  padding: 10px 12px;
  border-left: 2px solid var(--sage);
  background: #f8fbf8;
}

.static-field strong {
  color: var(--ink);
  font-family: Georgia, serif;
  font-size: 17px;
  font-weight: 500;
}

.subsection-heading {
  display: flex;
  align-items: center;
  gap: 9px;
  margin: 25px 0 14px;
}

.subsection-heading h3 {
  margin: 0;
  color: var(--ink);
  font-family: Georgia, 'Songti SC', serif;
  font-size: 16px;
  font-weight: 500;
  white-space: nowrap;
}

.subsection-heading em {
  color: var(--muted);
  font-family: inherit;
  font-size: 10px;
  font-style: normal;
  font-weight: 400;
}

.interest-count {
  margin-left: auto;
  color: #b1979f;
  font-size: 10px;
  white-space: nowrap;
}

.interest-count.full {
  color: var(--pink-deep);
}

.tiny-line {
  display: block;
  width: 18px;
  height: 1px;
  background: var(--pink);
}

.choice-row,
.chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.choice-note {
  display: flex;
  align-items: baseline;
  gap: 6px;
  margin: 10px 0 0;
  color: #b1979f;
  font-size: 10px;
  line-height: 1.6;
}

.choice-note span {
  color: var(--sage);
  font-family: Georgia, serif;
  font-size: 11px;
}

.choice-pill,
.talent-chip,
.preset-button {
  border: 1px solid var(--line);
  border-radius: 4px;
  background: #fffdfb;
  color: var(--muted);
  font-size: 11px;
  transition: border-color 0.2s ease, color 0.2s ease, background-color 0.2s ease, transform 0.2s ease;
}

.choice-pill:hover,
.choice-pill:focus-visible,
.talent-chip:hover:not(:disabled),
.talent-chip:focus-visible:not(:disabled),
.preset-button:hover,
.preset-button:focus-visible {
  border-color: var(--pink);
  color: var(--pink-deep);
  outline: none;
  transform: translateY(-1px);
}

.choice-pill {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 40px;
  padding: 8px 11px;
}

.choice-pill.selected,
.talent-chip.selected,
.preset-button.selected {
  border-color: var(--pink);
  background: var(--pink-soft);
  color: var(--pink-deep);
}

.pill-mark {
  color: var(--sage);
  font-family: Georgia, serif;
  font-size: 15px;
}

.ability-intro {
  position: relative;
  padding-right: 85px;
}

.points-meter {
  position: absolute;
  top: -5px;
  right: 0;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  width: 64px;
  color: var(--pink-deep);
  font-family: Georgia, serif;
}

.points-meter strong {
  font-size: 24px;
  font-weight: 500;
}

.points-meter span {
  align-self: flex-end;
  padding-bottom: 3px;
  color: var(--muted);
  font-size: 11px;
}

.points-meter small {
  flex-basis: 100%;
  color: var(--muted);
  font-family: inherit;
  font-size: 9px;
  text-align: center;
}

.preset-strip {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 7px;
  padding: 10px;
  border: 1px solid var(--soft-line);
  background: #fffbf8;
}

.preset-label {
  margin-right: 2px;
  color: var(--muted);
  font-size: 10px;
  font-weight: 600;
}

.preset-button {
  min-height: 29px;
  padding: 5px 9px;
}

.ability-list {
  margin-top: 15px;
  border-top: 1px solid var(--soft-line);
}

.ability-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  min-width: 0;
  padding: 14px 0;
  border-bottom: 1px solid var(--soft-line);
}

.ability-copy {
  display: flex;
  flex-direction: column;
  min-width: 0;
  gap: 3px;
}

.ability-copy strong {
  color: var(--ink);
  font-size: 13px;
}

.ability-copy span {
  color: var(--muted);
  font-size: 10px;
  line-height: 1.5;
}

.ability-control {
  display: flex;
  align-items: center;
  flex: 0 0 auto;
  gap: 7px;
}

.stepper-button {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border: 1px solid var(--line);
  border-radius: 50%;
  background: #fffdfb;
  color: var(--pink-deep);
  font-size: 18px;
  line-height: 1;
  transition: background-color 0.2s ease, opacity 0.2s ease;
}

.stepper-button:hover:not(:disabled),
.stepper-button:focus-visible:not(:disabled) {
  background: var(--pink-soft);
  outline: none;
}

.stepper-button:disabled {
  cursor: not-allowed;
  opacity: 0.35;
}

.ability-value {
  display: grid;
  place-items: center;
  width: 24px;
  color: var(--ink);
  font-family: Georgia, serif;
  font-size: 18px;
}

.ability-value.level-high {
  color: var(--pink-deep);
}

.ability-note {
  margin-top: 16px;
  padding: 10px 12px;
  background: #f8fbf8;
  color: #718c83;
  font-size: 10px;
  line-height: 1.6;
}

.ability-note span {
  margin-right: 5px;
  color: var(--pink-deep);
  font-family: Georgia, serif;
  font-size: 15px;
}

.talent-block {
  margin-bottom: 22px;
}

.left-heading {
  justify-content: flex-start;
  margin-top: 0;
  margin-bottom: 12px;
}

.talent-group {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin: 9px 0;
}

.group-label {
  flex: 0 0 57px;
  padding-top: 7px;
  color: #b18e9a;
  font-size: 10px;
  line-height: 1.4;
}

.talent-chip {
  min-height: 29px;
  padding: 5px 9px;
}

.talent-chip:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.compact-field {
  margin: 12px 0 0 69px;
  max-width: 360px;
}

.scene-heading {
  margin-top: 28px;
}

.scene-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.scene-option {
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: 9px;
  min-width: 0;
  min-height: 106px;
  padding: 13px 10px;
  border: 1px solid var(--line);
  border-radius: 5px;
  background: #fffdfb;
  color: var(--ink);
  text-align: left;
  transition: border-color 0.2s ease, background-color 0.2s ease, transform 0.2s ease;
}

.scene-option:hover,
.scene-option:focus-visible {
  border-color: var(--pink);
  outline: none;
  transform: translateY(-2px);
}

.scene-option.selected {
  border-color: var(--pink);
  background: var(--pink-soft);
}

.scene-glyph {
  flex: 0 0 auto;
  color: var(--pink-deep);
  font-family: Georgia, serif;
  font-size: 19px;
  line-height: 1;
}

.scene-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
  gap: 5px;
}

.scene-text strong {
  font-size: 12px;
  font-weight: 600;
}

.scene-text small {
  color: var(--muted);
  font-size: 10px;
  line-height: 1.5;
}

.select-mark {
  position: absolute;
  top: 7px;
  right: 8px;
  color: var(--pink-deep);
  font-size: 12px;
}

.preview-content {
  min-height: 430px;
}

.preview-sheet {
  position: relative;
  padding: 22px 20px 18px;
  border: 1px solid var(--line);
  background: #fffaf8;
}

.preview-ribbon {
  position: absolute;
  top: 0;
  right: 18px;
  padding: 5px 8px;
  background: var(--pink-soft);
  color: var(--pink-deep);
  font-size: 9px;
  letter-spacing: 0.12em;
}

.preview-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--soft-line);
}

.preview-avatar {
  display: grid;
  place-items: center;
  flex: 0 0 45px;
  width: 45px;
  height: 45px;
  border: 1px solid var(--pink);
  border-radius: 50%;
  background: #fffdfb;
  color: var(--pink-deep);
  font-family: Georgia, serif;
  font-size: 22px;
}

.preview-header h3 {
  margin: 0;
  color: var(--ink);
  font-family: Georgia, 'Songti SC', serif;
  font-size: 19px;
  font-weight: 500;
}

.preview-header p {
  margin: 4px 0 0;
  color: var(--muted);
  font-size: 10px;
}

.preview-lines {
  display: grid;
  gap: 10px;
  padding: 16px 0;
}

.preview-lines > div {
  display: grid;
  grid-template-columns: 74px minmax(0, 1fr);
  gap: 9px;
  font-size: 11px;
  line-height: 1.55;
}

.preview-lines span {
  color: #b18e9a;
}

.preview-lines strong {
  min-width: 0;
  color: var(--ink);
  font-weight: 500;
  overflow-wrap: anywhere;
}

.preview-scene {
  display: flex;
  align-items: flex-start;
  gap: 11px;
  padding: 12px;
  border-left: 2px solid var(--sage);
  background: #f8fbf8;
}

.preview-scene > span {
  color: var(--pink-deep);
  font-family: Georgia, serif;
  font-size: 22px;
}

.preview-scene div {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.preview-scene small {
  color: #78938a;
  font-size: 9px;
  letter-spacing: 0.1em;
}

.preview-scene strong {
  color: var(--ink);
  font-size: 13px;
}

.preview-scene p {
  margin: 2px 0 0;
  color: var(--muted);
  font-size: 10px;
  line-height: 1.5;
}

.preview-abilities {
  margin-top: 23px;
}

.preview-ability-list {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 8px;
}

.preview-ability {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
  color: var(--muted);
  font-size: 10px;
}

.preview-ability span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.preview-ability i {
  display: block;
  width: 100%;
  height: 4px;
  background: #f0e4e5;
}

.preview-ability i.filled {
  background: var(--pink);
}

.profile-write-note {
  display: flex;
  align-items: baseline;
  gap: 7px;
  margin-top: 18px;
  padding: 10px 12px;
  border-left: 2px solid var(--sage);
  background: #f8fbf8;
  color: #718c83;
  font-size: 10px;
  line-height: 1.7;
}

.profile-write-note span {
  color: var(--pink-deep);
  font-family: Georgia, serif;
  font-size: 13px;
}

.profile-write-note p {
  margin: 0;
}

.profile-preview {
  margin-top: 12px;
  border: 1px solid var(--soft-line);
  background: #fffbf8;
}

.profile-preview summary {
  padding: 10px 12px;
  color: var(--pink-deep);
  font-size: 11px;
  cursor: pointer;
}

.profile-preview summary:hover,
.profile-preview summary:focus-visible {
  outline: none;
  background: var(--pink-soft);
}

.profile-preview pre {
  max-height: 280px;
  margin: 0;
  padding: 0 12px 12px;
  overflow: auto;
  color: var(--ink);
  font-family: 'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif;
  font-size: 11px;
  line-height: 1.7;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.form-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 23px;
  padding-top: 17px;
  border-top: 1px solid var(--soft-line);
}

.text-button,
.primary-button {
  min-height: 42px;
  border-radius: 5px;
  font-size: 12px;
  transition: transform 0.2s ease, background-color 0.2s ease, border-color 0.2s ease, opacity 0.2s ease;
}

.text-button {
  padding: 8px 4px;
  border: 0;
  background: transparent;
  color: var(--muted);
}

.text-button:hover,
.text-button:focus-visible {
  color: var(--pink-deep);
  outline: none;
}

.text-button span {
  margin-right: 5px;
  font-size: 17px;
  vertical-align: -1px;
}

.primary-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  min-width: 126px;
  padding: 8px 16px;
  border: 1px solid var(--pink-deep);
  background: var(--pink-deep);
  color: #fffdfb;
  box-shadow: 0 6px 14px rgba(169, 87, 115, 0.16);
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

.button-loader {
  width: 14px;
  height: 14px;
  border: 1px solid rgba(255, 255, 255, 0.45);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.action-spacer {
  width: 1px;
}

.form-alert {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 16px;
  padding: 9px 11px;
  border-left: 2px solid var(--pink-deep);
  background: #fff2f3;
  color: var(--pink-deep);
  font-size: 11px;
  line-height: 1.5;
}

.form-alert > span {
  display: grid;
  place-items: center;
  flex: 0 0 16px;
  width: 16px;
  height: 16px;
  border: 1px solid currentColor;
  border-radius: 50%;
  font-size: 10px;
  font-weight: 700;
}

.locked-panel {
  padding: 58px 30px;
  text-align: center;
}

.locked-symbol {
  display: grid;
  place-items: center;
  width: 54px;
  height: 54px;
  margin: 0 auto 17px;
  border: 1px solid var(--sage);
  border-radius: 50%;
  color: var(--sage);
  font-family: Georgia, serif;
  font-size: 25px;
  animation: breathe 3.8s ease-in-out infinite;
}

.locked-panel h2 {
  margin-top: 9px;
}

.locked-panel > p:not(.eyebrow):not(.submit-status) {
  max-width: 420px;
  margin: 12px auto 0;
  color: var(--muted);
  font-size: 12px;
  line-height: 1.7;
}

.locked-line {
  display: flex;
  align-items: center;
  gap: 9px;
  max-width: 360px;
  margin: 30px auto 0;
  color: #78938a;
  font-size: 10px;
}

.locked-line span:first-child,
.locked-line span:last-child {
  flex: 1;
  height: 1px;
  background: #d7e4df;
}

.submit-status {
  margin: 21px 0 0;
  color: var(--pink-deep);
  font-size: 11px;
}

.opening-footer {
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 9px;
  padding: 18px 4px 0;
  color: #b49ba3;
  font-size: 10px;
  line-height: 1.5;
  text-align: center;
}

.page-enter-active,
.page-leave-active {
  transition: opacity 0.22s ease, transform 0.22s ease;
}

.page-enter-from {
  opacity: 0;
  transform: translateX(10px);
}

.page-leave-to {
  opacity: 0;
  transform: translateX(-10px);
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

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 620px) {
  .opening-shell {
    padding: 24px 12px 18px;
  }

  .opening-header {
    align-items: flex-start;
    padding-top: 18px;
  }

  .world-note {
    display: none;
  }

  .form-panel {
    padding: 22px 16px 16px;
  }

  .panel-heading h2,
  .locked-panel h2 {
    font-size: 22px;
  }

  .two-columns,
  .scene-grid {
    grid-template-columns: 1fr;
  }

  .stepper {
    overflow-x: auto;
  }

  .step-item {
    flex: 0 0 auto;
    min-width: 82px;
  }

  .step-label {
    display: none;
  }

  .scene-option {
    min-height: 82px;
  }

  .preview-ability-list {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .preview-ability:nth-child(4),
  .preview-ability:nth-child(5) {
    grid-column: span 1;
  }

  .compact-field {
    margin-left: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    scroll-behavior: auto !important;
    transition-duration: 0.01ms !important;
  }
}
</style>
