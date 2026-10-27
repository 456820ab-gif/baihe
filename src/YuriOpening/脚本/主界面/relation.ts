/*
 * relation.ts — MVU「关系」数据块的只读视图。
 *
 * 这个字段只由测试卡提供，正式卡没有它，所有入口都必须先过 relationEnabled()；
 * 本文件只读不写，界面上的动作一律走输入框，不改 MVU。
 */

import { stageOf } from '../../界面/状态栏/heroine';

export const RELATION_WOMEN = ['林清', '苏玥'] as const;
export type RelationWomanName = (typeof RELATION_WOMEN)[number];

export type RelationAxis = '私密' | '克制' | '失控' | '风险';
export const RELATION_AXES: RelationAxis[] = ['私密', '克制', '失控', '风险'];

export type RelationConfidant = { 人: string; 知道: string };

export type RelationTrace = {
  类型: string;
  内容: string;
  时间: string;
  可见性: string;
};

export type RelationWoman = Record<RelationAxis, number | null> & {
  /** MVU 原始值是 Record<string,string>，前端统一展开成可排序列表 */
  知情: RelationConfidant[];
  痕迹: RelationTrace[];
  修罗场: ArenaState;
};

export type RelationBlock = Record<RelationWomanName, RelationWoman> & { _启用: boolean };

export const ARENA_STATES = ['无', '察觉', '试探', '撞见', '摊牌'] as const;
export type ArenaState = (typeof ARENA_STATES)[number];

/** 每根轴四档，与 heroine.ts 的 stageOf 分界（25/50/75）一致 */
const AXIS_BANDS: Record<RelationAxis, [string, string, string, string]> = {
  私密: ['客气', '半开', '亲昵', '只属于你们'],
  克制: ['放任', '随意', '收着', '严守'],
  失控: ['平稳', '起波', '失守', '溃堤'],
  风险: ['安全', '微光', '惹眼', '一触即发'],
};

function recordOf(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function textOf(value: unknown) {
  if (typeof value === 'string') return value.trim();
  return typeof value === 'number' && Number.isFinite(value) ? String(value) : '';
}

function amountOf(value: unknown): number | null {
  const number = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN;
  return Number.isFinite(number) ? Math.min(100, Math.max(0, Math.round(number))) : null;
}

export function arenaOf(value: unknown): ArenaState {
  const text = textOf(value);
  return (ARENA_STATES as readonly string[]).includes(text) ? (text as ArenaState) : '无';
}

export function arenaLevel(state: ArenaState) {
  return ARENA_STATES.indexOf(state);
}

export function arenaLabel(state: ArenaState) {
  if (state === '察觉') return '她察觉到了什么';
  if (state === '试探') return '她在试探';
  if (state === '撞见') return '已经被撞见';
  if (state === '摊牌') return '话已经摊开';
  return '还没有人察觉';
}

export function relationAxisLabel(axis: RelationAxis, value: number | null) {
  if (value === null) return '待定';
  return AXIS_BANDS[axis][stageOf(value)];
}

/** 交给样式的语义色：风险越高越接近警戒色，其余轴只表深浅 */
export function relationAxisTone(axis: RelationAxis, value: number | null) {
  if (value === null) return 'is-empty';
  const level = stageOf(value);
  if (axis === '风险') return level >= 2 ? 'is-danger' : level >= 1 ? 'is-warn' : 'is-calm';
  if (axis === '失控') return level >= 2 ? 'is-danger' : level >= 1 ? 'is-warn' : 'is-calm';
  return level >= 2 ? 'is-deep' : 'is-soft';
}

const BLIND_KNOWLEDGE = ['不知情', '未察觉', '未知', '待设定', '无'];

function confidantsOf(value: unknown): RelationConfidant[] {
  const source = recordOf(value);
  if (!source) return [];
  return Object.keys(source)
    .map(name => ({ 人: name.trim(), 知道: textOf(source[name]) }))
    .filter(item => item.人 && item.知道 && !BLIND_KNOWLEDGE.includes(item.知道));
}

function tracesOf(value: unknown): RelationTrace[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(item => recordOf(item))
    .filter((item): item is Record<string, unknown> => Boolean(item))
    .map(item => ({
      类型: textOf(item.类型),
      内容: textOf(item.内容),
      时间: textOf(item.时间),
      可见性: textOf(item.可见性) || '只有你们知道',
    }))
    .filter(item => item.内容);
}

function womanOf(value: unknown): RelationWoman {
  const source = recordOf(value) ?? {};
  return {
    私密: amountOf(source.私密),
    克制: amountOf(source.克制),
    失控: amountOf(source.失控),
    风险: amountOf(source.风险),
    知情: confidantsOf(source.知情),
    痕迹: tracesOf(source.痕迹),
    修罗场: arenaOf(source.修罗场),
  };
}

export function relationOf(data: unknown): RelationBlock | null {
  const root = recordOf(recordOf(data)?.关系);
  if (!root) return null;
  return {
    _启用: root._启用 !== false,
    林清: womanOf(root.林清),
    苏玥: womanOf(root.苏玥),
  };
}

export function relationWoman(data: unknown, name: string): RelationWoman | null {
  const block = relationOf(data);
  if (!block || !(RELATION_WOMEN as readonly string[]).includes(name)) return null;
  return block[name as RelationWomanName];
}

/** 整块（页签、私密区、动作）是否出现：没有关系字段或明确关闭时为 false */
export function relationEnabled(data: unknown) {
  const block = relationOf(data);
  return Boolean(block?._启用);
}

export function relationRecentTrace(woman: RelationWoman | null): RelationTrace | null {
  if (!woman || !woman.痕迹.length) return null;
  return woman.痕迹[woman.痕迹.length - 1];
}

/** 知情在 MVU 里是 Record，读出来统一成列表（空说明自动丢弃） */
export function relationConfidants(woman: RelationWoman | null): RelationConfidant[] {
  return woman?.知情 ?? [];
}
