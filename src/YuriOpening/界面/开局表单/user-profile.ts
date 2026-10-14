import { type OpeningState } from '../../schema';

const USER_ENTRY_NAME = 'user设定';
const ABILITY_ORDER = ['共情', '表达', '观察', '勇气', '边界感'] as const;

export type UserProfileWriteResult = { ok: true; worldbook: string } | { ok: false; reason: string };

export function buildUserProfile(state: OpeningState): string {
  const player = state.玩家;
  const name = player._姓名;
  const appearance = player._外貌;
  const lifeAnchor = [player._职业._方向, player._职业._具体].filter(Boolean).join('，');
  const presentation =
    player._自我呈现 === '自然、舒适'
      ? `${name}希望以${appearance._气质}的样子被看见。`
      : player._自我呈现;
  const focus = ABILITY_ORDER.filter(key => player._能力[key] === 3).join('、') || '慢慢观察再做决定';

  const basics = [
    `姓名：${name}`,
    player._称呼 ? `称呼：${player._称呼}` : '',
    `年龄：${player._年龄}岁`,
    '性别：女',
  ].filter(Boolean);

  const appearanceLines = [
    `- 身高${appearance._身高}，${appearance._发型}，气质${appearance._气质}。`,
    `- 穿衣：${appearance._穿衣}。`,
    appearance._特征 ? `- ${appearance._特征}` : '',
  ].filter(Boolean);

  return [
    `<${name}_基础信息>`,
    basics.join('\n'),
    '',
    '外貌与身体：',
    appearanceLines.join('\n'),
    `</${name}_基础信息>`,
    '',
    `<${name}_生活结构>`,
    presentation,
    `- 现在的生活落点：${lifeAnchor}。`,
    `- 主特长：${player._主特长}。`,
    `- 兴趣：${player._兴趣.join('、')}。`,
    `- 关系倾向：在与人靠近时，更擅长${focus}。`,
    `</${name}_生活结构>`,
  ].join('\n');
}

export async function writeUserProfileToWorldbook(content: string): Promise<UserProfileWriteResult> {
  try {
    if (
      typeof getCharWorldbookNames !== 'function' ||
      typeof getWorldbook !== 'function' ||
      typeof createWorldbookEntries !== 'function' ||
      typeof updateWorldbookWith !== 'function'
    ) {
      return { ok: false, reason: '当前酒馆助手不支持世界书接口' };
    }

    const books = getCharWorldbookNames('current');
    const worldbookName = books.primary ?? books.additional[0];
    if (!worldbookName) {
      return { ok: false, reason: '当前角色卡没有绑定世界书' };
    }

    const entry: TypeFest.PartialDeep<WorldbookEntry> = {
      name: USER_ENTRY_NAME,
      enabled: true,
      content,
      probability: 100,
      strategy: {
        type: 'constant',
        keys: [],
        keys_secondary: { logic: 'and_any', keys: [] },
        scan_depth: 'same_as_global',
      },
      position: {
        type: 'after_character_definition',
        role: 'system',
        depth: 0,
        order: 25,
      },
    };

    const existing = (await getWorldbook(worldbookName)).some(item => item.name === USER_ENTRY_NAME);
    if (existing) {
      await updateWorldbookWith(worldbookName, entries =>
        entries.map(item => (item.name === USER_ENTRY_NAME ? { ...item, ...entry } : item)),
      );
    } else {
      await createWorldbookEntries(worldbookName, [entry]);
    }

    const written = (await getWorldbook(worldbookName)).find(item => item.name === USER_ENTRY_NAME);
    if (!written) {
      return { ok: false, reason: '写入后回读未找到该条目' };
    }
    if (
      written.strategy.type !== 'constant' ||
      written.position.type !== 'after_character_definition' ||
      written.position.order !== 25
    ) {
      return { ok: false, reason: '写入后回读的条目设置与预期不一致' };
    }
    if (written.content !== content) {
      console.warn('[百合花期] user设定条目回读内容与写入内容不一致');
    }
    console.info(`[百合花期] user设定已写入世界书「${worldbookName}」`);
    return { ok: true, worldbook: worldbookName };
  } catch (error) {
    console.warn('[百合花期] user设定写入世界书失败', error);
    return { ok: false, reason: error instanceof Error ? error.message : '未知错误' };
  }
}
