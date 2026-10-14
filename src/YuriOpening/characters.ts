/**
 * characters.ts — 角色注册表（状态栏与手机两个产物共用）
 *
 * 这里是"多角色"体系的唯一前端事实源：新增一个可攻略角色时，
 * 除了数据层（schema / initvar / 更新规则 / 输出格式 / 世界书人设），
 * 前端只需要在这里加一条，并给她准备一组花朵美术（flowers.ts）。
 *
 * 约定：
 * - varRoot 是 MVU 变量里的字段组名（「林清」/「苏玥」），所有数值路径都从它拼出来；
 * - accent 系列是**固定身份色**，不随场景昼夜改变，保证每个角色的页面一眼可辨;
 * - 手机侧配置（关键词、聊天语气）放在 phone 字段里，AI 提示词从这读取。
 */

export type CharacterId = 'linqing' | 'suyue';
export type FlowerId = 'lily' | 'wisteria';

export type CharacterDef = {
  id: CharacterId;
  /** 展示名 */
  name: string;
  /** MVU 变量前缀（与 schema / 世界书条目同名） */
  varRoot: string;
  /** 她的花（花朵美术见界面/状态栏/flowers.ts） */
  flower: FlowerId;
  /** 手机头像字 */
  glyph: string;
  /** 角色面板抬头副题 */
  subtitle: string;
  /**
   * 面板配色：在角色容器上重映射 --hud-accent / --hud-accent-soft /
   * --hud-jade / --hud-glow，花期、星图、心跳、进度条整套自动换色。
   */
  accent: string;
  accentSoft: string;
  jade: string;
  glow: string;
  /** 手机微信侧配置 */
  phone: {
    /** 通讯录搜索关键词（含昵称、拼音） */
    keywords: string[];
    /** 通讯录与朋友圈的副标题 */
    tagline: string;
    /** 通过好友申请所需的最低关系身份 */
    addGate: string;
    /** 头像渐变三段色（手机内头像统一由 avatarLQ 生成） */
    avatarStops: [string, string, string];
    /** 朋友圈文案风格提示（插进生成提示词） */
    momentHint: string;
    /** 微信聊天语气规范（插进她的系统提示词） */
    tone: string;
    /** MVU「微信」下的字段名（各角色历史命名不一，显式登记） */
    fields: {
      /** 是否已添加好友 */
      added: string;
      /** 已知事件（正文同步进微信） */
      knownEvents: string;
      /** 聊天摘要历史 */
      summaryHistory: string;
    };
  };
};

export const CHARACTERS: CharacterDef[] = [
  {
    id: 'linqing',
    name: '林清',
    varRoot: '林清',
    flower: 'lily',
    glyph: '清',
    subtitle: '她此刻的样子',
    accent: '#a84b68',
    accentSoft: '#f3dfe5',
    jade: '#5f8b79',
    glow: 'rgba(184, 98, 127, 0.14)',
    phone: {
      keywords: ['林清', '林总', 'linqing', 'lq'],
      tagline: '蔷薇文化传媒',
      addGate: '熟人',
      avatarStops: ['#c97490', '#b8627f', '#8f6a97'],
      momentHint: '你发得不勤，句子短，偶尔带一点得逞或嘴硬的坏。',
      tone: [
        '- 每条回复严格控制在 60 字以内，宁可短也不要长篇大论',
        '- 用手机聊天的自然语气，短句，口语化',
        '- 偶尔用「[语音 Xs]」代替文字',
        '- 你会发微信表情：可以单独发一条只有 emoji 或颜文字的消息（如 😏、🙄、🤭、(￣▽￣)），也会把它们穿插在文字里；单独发的表情会被放大显示，用得克制但到位',
        '- 表情要紧扣你：坏笑、看好戏、白眼、得逞、偶尔破功，少用甜腻卖萌',
        '- 按关系身份调整亲密度：初识保持礼貌距离；朋友可以调侃；暧昧时会有一点欲言又止',
        '- 不发表长篇感悟，不说教，不解释自己的感受',
        '- 林清是那种在微信上会偶尔已读不回、发半句话然后删掉重写的人',
      ].join('\n'),
      fields: {
        added: '_已添加林清',
        knownEvents: '_林清已知事件',
        summaryHistory: '_聊天摘要历史',
      },
    },
  },
  {
    id: 'suyue',
    name: '苏玥',
    varRoot: '苏玥',
    flower: 'wisteria',
    glyph: '玥',
    subtitle: '她此刻的样子',
    accent: '#7c63a9',
    accentSoft: '#eae3f4',
    jade: '#6b8a6f',
    glow: 'rgba(124, 99, 169, 0.16)',
    phone: {
      keywords: ['苏玥', 'suyue'],
      tagline: '昙夜酒吧 · 夜樱街',
      addGate: '朋友',
      avatarStops: ['#a793cd', '#7c63a9', '#6b8a6f'],
      momentHint: '你像打烊后靠在门边随手写两句，从容、不甜腻，偶尔一点揶揄。',
      tone: [
        '- 每条回复严格控制在 60 字以内，宁可短也不要长篇大论',
        '- 用手机聊天的自然语气，短句，口语化；你说话从容，不急着接话，偶尔一句话就让人接不下去',
        '- 偶尔用「[语音 Xs]」代替文字',
        '- 你会发微信表情：可以单独发一条只有 emoji 或颜文字的消息，也会把它们穿插在文字里；单独发的表情会被放大显示，用得克制',
        '- 表情偏你的风格：一点揶揄、看好戏、偶尔懒洋洋，不甜腻卖萌',
        '- 你常在深夜、店里空闲时回消息；忙或应酬时会直说，不假装热情',
        '- 按关系身份调整亲密度：初识客气周到但不热络；朋友会开始逗人、护短；暧昧时藏一半说一半',
        '- 不发表长篇感悟，不说教，不解释自己的感受；关心常藏在抱怨、取笑或一句漫不经心里',
        '- 你习惯把人哄得放松，偶尔故意越过一点客套；越在意的事，说得越轻',
      ].join('\n'),
      fields: {
        added: '_已添加苏玥',
        knownEvents: '_苏玥已知事件',
        summaryHistory: '_苏玥聊天摘要历史',
      },
    },
  },
];

export function characterById(id: string): CharacterDef | null {
  return CHARACTERS.find(item => item.id === id) ?? null;
}

// ────────────────────────────────────────────────────────────────────────────
// 关系身份工具（状态栏与手机共用）
// ────────────────────────────────────────────────────────────────────────────

/** 关系身份由低到高；待设定最低 */
const RELATION_RANKS = ['待设定', '初识', '熟人', '朋友', '挚友', '暧昧', '恋人'];

export function relationRank(relationship: string): number {
  const idx = RELATION_RANKS.indexOf(relationship);
  return idx >= 0 ? idx : 0;
}

/** 关系身份是否达到门槛（含门槛本身） */
export function relationAtLeast(relationship: string, gate: string): boolean {
  const gateRank = relationRank(gate);
  return gateRank > 0 && relationRank(relationship) >= gateRank;
}
