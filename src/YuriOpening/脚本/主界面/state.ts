import { CHARACTERS, characterById, type CharacterDef } from '../../characters';
import { stageOf, zoneOf, type HeroinePoint } from '../../界面/状态栏/heroine';
import { weatherLabel, weatherTone } from '../../界面/状态栏/icons';

export type HudData = {
  环境?: {
    日期?: string;
    时间?: string;
    天气?: string;
    主题覆盖?: string;
    地点?: { 城市?: string; 区域?: string; 具体地点?: string };
  };
  玩家?: { _姓名?: string; _年龄?: number | string; _职业?: { _方向?: string; _具体?: string } };
  玩家状态?: Record<string, unknown>;
  林清?: Record<string, unknown>;
  苏玥?: Record<string, unknown>;
  地图?: { 当前地点?: string; 地点状态?: Record<string, { 状态?: string; 备注?: string }> };
  [key: string]: unknown;
};

export type ThemeState = {
  daypart: 'day' | 'night';
  weather: string;
  override: string;
};

export type AppSettings = {
  animate: boolean;
  scene: boolean;
  theme: 'dark' | 'light';
};

const SETTINGS_KEY = 'YuriOpening:frontstage:settings:v1';
const DEFAULT_SETTINGS: AppSettings = { animate: true, scene: true, theme: 'dark' };

export function getPath(value: unknown, path: string, fallback?: unknown): unknown {
  const parts = String(path).replace(/\[(\d+)\]/g, '.$1').split('.').filter(Boolean);
  let current: unknown = value;
  for (const part of parts) {
    if (current === null || current === undefined) return fallback;
    current = (current as Record<string, unknown>)[part];
  }
  return current === undefined ? fallback : current;
}

export function readPath(data: HudData | null, path: string, fallback = '待设定') {
  const value = getPath(data, path);
  if (value === undefined || value === null || value === '') return fallback;
  return String(value);
}

export function readNumber(data: HudData | null, path: string): number | null {
  const value = getPath(data, path);
  return typeof value === 'number' && Number.isFinite(value) ? Math.min(100, Math.max(0, Math.round(value))) : null;
}

export function isUnset(value: string) {
  return value === '待设定' || value === '';
}

export function currentMessageId() {
  try {
    return getCurrentMessageId();
  } catch {
    return getLastMessageId();
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isBlank(value: unknown) {
  return value === undefined || value === null || value === '' || value === '待设定';
}

/* 最新楼层可能只有环境/剧情增量，玩家档案还在开局楼层，逐层合并但不用默认值覆盖已填内容 */
function mergeStat(base: unknown, latest: unknown): unknown {
  if (!isObject(base) || !isObject(latest)) return isBlank(latest) ? base : latest;
  const out: Record<string, unknown> = { ...base };
  for (const key of Object.keys(latest)) out[key] = mergeStat(base[key], latest[key]);
  return out;
}

export function readData(): HudData | null {
  try {
    const latest = getPath(getVariables({ type: 'message', message_id: 'latest' }), 'stat_data');
    const hostId = currentMessageId();
    const host = getPath(getVariables({ type: 'message', message_id: hostId }), 'stat_data');
    const merged = mergeStat(host, latest);
    return isObject(merged) ? (merged as HudData) : null;
  } catch {
    return null;
  }
}

export function safeMessageId() {
  try {
    return getLastMessageId();
  } catch {
    return -1;
  }
}

export function resolveTheme(data: HudData | null): ThemeState {
  const time = readPath(data, '环境.时间');
  const match = time.match(/(\d{1,2})[:：](\d{2})/);
  const hour = match ? Number(match[1]) : 12;
  return {
    daypart: hour >= 6 && hour < 18 ? 'day' : 'night',
    weather: readPath(data, '环境.天气'),
    override: readPath(data, '环境.主题覆盖', '自动'),
  };
}

export function formatPlace(data: HudData | null) {
  const parts = [
    readPath(data, '环境.地点.城市'),
    readPath(data, '环境.地点.区域'),
    readPath(data, '环境.地点.具体地点'),
  ].filter(value => !isUnset(value));
  return parts.join(' · ') || '地点待设定';
}

export function weatherNote(theme: ThemeState, scene: boolean) {
  if (!scene) return '静态纸面';
  if (!isUnset(theme.override) && theme.override !== '自动') return theme.override;
  return `${theme.daypart === 'night' ? '夜间' : '白昼'} · ${weatherLabel(theme.weather)}`;
}

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : { ...DEFAULT_SETTINGS };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: AppSettings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // 预览/无持久化环境里只保留当前会话
  }
}

export function playerName(data: HudData | null) {
  const name = String(getPath(data, '玩家._姓名', '') ?? '').trim();
  return name && name !== '未命名' ? name : '你';
}

export function playerJob(data: HudData | null) {
  return [getPath(data, '玩家._职业._方向'), getPath(data, '玩家._职业._具体')]
    .filter(value => typeof value === 'string' && !isUnset(value))
    .join(' · ') || '旅居百合市';
}

export function playerAge(data: HudData | null) {
  const value = getPath(data, '玩家._年龄');
  return typeof value === 'number' || (typeof value === 'string' && value !== '待设定') ? String(value) : '待设定';
}

export function characterValue(data: HudData | null, char: CharacterDef, key: string) {
  return readPath(data, `${char.varRoot}.${key}`);
}

export function characterPoint(data: HudData | null, char: CharacterDef): HeroinePoint | null {
  const close = readNumber(data, `${char.varRoot}.亲近`);
  const heart = readNumber(data, `${char.varRoot}.心动`);
  return close === null || heart === null ? null : { close, heart };
}

export function characterTrail(data: HudData | null, char: CharacterDef, point: HeroinePoint | null) {
  if (!point) return { previous: null as HeroinePoint | null, trail: [] as HeroinePoint[] };
  const trail: HeroinePoint[] = [];
  let previous = point;
  const current = safeMessageId();
  for (let id = current - 1; id >= 0 && id >= current - 16 && trail.length < 5; id -= 1) {
    try {
      const history = getVariables({ type: 'message', message_id: id }) as { stat_data?: HudData };
      const before = characterPoint(history?.stat_data ?? null, char);
      if (!before) break;
      previous = before;
      if (before.close !== point.close || before.heart !== point.heart) {
        if (!trail.some(item => item.close === before.close && item.heart === before.heart)) {
          trail.unshift(before);
        }
      }
    } catch {
      break;
    }
  }
  return { previous, trail };
}

export function relationZone(point: HeroinePoint | null) {
  if (!point) return null;
  return zoneOf(point);
}

export function flowerStage(point: HeroinePoint | null) {
  return point ? { leaf: stageOf(point.close), bloom: stageOf(point.heart) } : { leaf: 0, bloom: 0 };
}

export function characterNode(data: HudData | null, char: CharacterDef) {
  const label = characterValue(data, char, '所在地点');
  return label && !isUnset(label) ? label : null;
}

export function weatherToneFor(theme: ThemeState) {
  return weatherTone(theme.weather);
}

export { CHARACTERS, characterById };
