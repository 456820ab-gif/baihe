import { getSettings, setSettings, type AppSettings } from './state';
import { hostDocument } from './host';

interface SettingsViewOptions {
  onChange: (next: AppSettings) => void;
}

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

  const reset = make('button', 'obs-reset', '恢复默认');
  reset.type = 'button';
  reset.addEventListener('click', () => {
    commit({ animate: true, scene: true, theme: 'dark' });
  });
  wrap.append(reset);
  return wrap;
}
