/* 用卡内真实的 Zod 脚本来校验卡内 InitVar：确认 具体地点 不再被剥掉、
   并且没有亲密/欲望字段被 AI 写入的机会。 */
import fs from 'node:fs';
import yaml from 'yaml';
import * as zod from 'zod';
import lodash from 'lodash';

const card = JSON.parse(fs.readFileSync('/root/workspace/cards/YuriOpening-全屏/YuriOpening-全屏.json', 'utf8'));
const zodScript = card.data.extensions.tavern_helper.scripts.find(s => s.id.startsWith('5b3b09af')).content;
const initEntry = card.data.character_book.entries.find(e => e.comment === '[InitVar]请勿打开').content;
const initvar = yaml.parse(initEntry);

// 去掉 import 与注册调用，只保留 Schema 定义
const body = zodScript
  .replace(/^import[^\n]*\n/, '')
  .replace(/export const Schema/, 'const Schema')
  .replace(/\$\(\(\) => \{\s*registerMvuSchema\(Schema\);\s*\}\);\s*$/, '');

const factory = new Function('z', '_', `${body}\nreturn Schema;`);
const Schema = factory(zod, lodash);

const parsed = Schema.parse(initvar);
const kept = '具体地点' in (parsed['环境']?.['地点'] ?? {});
console.log('解析后 环境.地点 =', JSON.stringify(parsed['环境']['地点']));
console.log('具体地点 是否保留:', kept);
console.log('林清字段:', Object.keys(parsed['林清']).join(','));
console.log('苏玥字段:', Object.keys(parsed['苏玥']).join(','));
console.log('关系块是否保留:', '关系' in parsed && '林清' in parsed['关系']);
console.log('开场._初遇对象:', parsed['开场']['_初遇对象']);
console.log('亲密/欲望 是否还在 schema 里:', /亲密事件|欲望/.test(zodScript));
