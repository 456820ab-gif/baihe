import { getSettings, setSettings, type AppSettings } from './state';
import { hostDocument } from './host';

interface SettingsViewOptions {
  onChange: (next: AppSettings) => void;
}

const INTENSITY_OPTIONS: Array<{ value: AppSettings['intensity']; label: string }> = [
  { value: '含蓄', label: '含蓄' },
  { value: '直写', label: '直写' },
  { value: 'R18', label: 'R18' },
];

function make<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string) {
  const el = hostDocument().createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

function toggleRow(title: string, note: string, checked: boolean, onChange: (next: boolean) => void) {
  const row = make('label', 'obs-setting');
  const copy = make('span', 'obs-setting-copy');
  copy.append(make('strong', '', title), make('small', '', note));
  const input = make('input');
  input.type = 'checkbox';
  input.checked = checked;
  input.addEventListener('change', () => onChange(input.checked));
  const track = make('span', 'obs-switch');
  track.setAttribute('aria-hidden', 'true');
  row.append(copy, input, track);
  return row;
}

export function renderSettingsView(options: SettingsViewOptions): HTMLElement {
  const settings = getSettings();
  const commit = (patch: Partial<AppSettings>) => {
    const next = { ...getSettings(), ...patch };
    setSettings(next);
    options.onChange(next);
  };

  const wrap = make('div', 'obs-settings');
  wrap.append(
    make('p', 'obs-kicker', '界面'),
    make('h2', 'obs-title', '设置'),
    make('p', 'obs-subtitle', '只保留会改变观感的部分；故事数据不在这里修改。'),
  );

  wrap.append(toggleRow(
    '浅色模式',
    '墨玻璃换成日光纸面，地图与星图同步变亮。',
    settings.theme === 'light',
    checked => commit({ theme: checked ? 'light' : 'dark' }),
  ));

  const toggles: Array<['animate' | 'scene', string, string]> = [
    ['animate', '动态效果', '天气、花期、星图与窗口转场。'],
    ['scene', '场景跟随', '让底纹颜色随着时间、天气和剧情变化。'],
  ];
  toggles.forEach(([key, title, note]) => {
    const patch = (checked: boolean): Partial<AppSettings> =>
      key === 'animate' ? { animate: checked } : { scene: checked };
    wrap.append(toggleRow(title, note, settings[key], checked => commit(patch(checked))));
  });

  const r18 = make('div', 'settings-r18');
  const r18Toggle = toggleRow(
    'R18 模式',
    '成人向内容总开关，默认关闭；关闭时正文只写氛围与距离。',
    settings.r18,
    checked => commit({ r18: checked }),
  );
  r18Toggle.classList.add('settings-r18-toggle');
  r18.append(r18Toggle);

  const intensityRow = make('label', 'obs-setting settings-r18-row');
  const intensityCopy = make('span', 'obs-setting-copy');
  intensityCopy.append(
    make('strong', '', '色气强度'),
    make('small', '', '含蓄只留暗示，直写照实写动作与反应；R18 档需上面的开关一并打开。'),
  );
  const intensity = make('select', 'settings-r18-select');
  intensity.setAttribute('aria-label', '色气强度');
  INTENSITY_OPTIONS.forEach(option => {
    const item = make('option', '', option.label);
    item.value = option.value;
    item.selected = option.value === settings.intensity;
    intensity.append(item);
  });
  intensity.addEventListener('change', () => {
    commit({ intensity: intensity.value as AppSettings['intensity'] });
  });
  intensityRow.append(intensityCopy, intensity);
  r18.append(intensityRow);

  const wordRow = make('label', 'obs-setting settings-r18-row');
  const wordCopy = make('span', 'obs-setting-copy');
  wordCopy.append(
    make('strong', '', '安全词'),
    make('small', '', '剧情里说出这个词，对方会停下来确认你的状态。'),
  );
  const word = make('input', 'settings-r18-word');
  word.type = 'text';
  word.value = settings.safeWord;
  word.maxLength = 24;
  word.placeholder = '例如「百合」';
  word.setAttribute('aria-label', '安全词');
  word.addEventListener('change', () => commit({ safeWord: word.value.trim() }));
  wordRow.append(wordCopy, word);
  r18.append(wordRow);

  wrap.append(r18);

  const reset = make('button', 'obs-reset', '恢复默认');
  reset.type = 'button';
  reset.addEventListener('click', () => {
    commit({ animate: true, scene: true, theme: 'dark', r18: false, intensity: '含蓄', safeWord: '' });
  });
  wrap.append(reset);
  return wrap;
}
