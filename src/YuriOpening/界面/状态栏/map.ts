export type MapNode = {
  id: string;
  label: string;
  region: string;
  description: string;
  x: number;
  y: number;
  neighbors: string[];
  nightGlow?: boolean;
};

export const MAP_WIDTH = 640;
export const MAP_HEIGHT = 400;

/**
 * 坐标基于 640×400 的 viewBox，而不是百分比。
 * 手绘城市需要节点贴着自己那栋建筑，百分比定位会让图形和命中区错开。
 * 地点名同时是 MVU 变量 地图.当前地点 的取值，必须与世界书「百合市」条目逐字一致。
 */
export const MAP_NODES: MapNode[] = [
  {
    id: 'suzuran_apartment',
    label: '铃兰公寓',
    region: '月见河畔',
    description: '河畔一栋白墙小高层，住户多是独居的年轻女孩。十二楼的阳台正对月见河，夜里能看见对岸的灯。',
    x: 300,
    y: 55,
    neighbors: ['yuejian_park', 'qiangwei_media', 'yinghua_university'],
  },
  {
    id: 'yuejian_park',
    label: '月见河滨公园',
    region: '月见河畔',
    description: '沿河的长步道与草坡，夏夜开满月见草。傍晚有人跑步、遛狗，也有两个人并肩坐着不说话。',
    x: 265,
    y: 130,
    neighbors: ['suzuran_apartment', 'qiangwei_media', 'zhizi_library', 'xingzhui_island'],
  },
  {
    id: 'xingzhui_island',
    label: '星缀岛游乐园',
    region: '月见河畔',
    description: '河心小岛上的游乐园，摩天轮转一圈刚好十五分钟，到最高点时整座城都安静下来。',
    x: 215,
    y: 215,
    neighbors: ['yuejian_park', 'yinghuo_night_market'],
  },
  {
    id: 'tinglan_apartment',
    label: '汀兰公寓',
    region: '月见河畔',
    description: '河西岸一栋深灰色高层公寓，楼下就是桥头。顶层只有她一户，客厅的窗对着整条月见河。',
    x: 150,
    y: 330,
    neighbors: ['shancha_lookout', 'yinghuo_night_market'],
  },
  {
    id: 'yinghua_university',
    label: '樱华女子大学',
    region: '大学城',
    description: '百年女校，红砖老楼与玻璃新馆并排。春天樱花大道落满花瓣，社团招新时整条路都是笑声。',
    x: 70,
    y: 55,
    neighbors: ['zhizi_library', 'suzuran_apartment'],
  },
  {
    id: 'zhizi_library',
    label: '栀子图书馆',
    region: '大学城',
    description: '有一整面落地窗的市立图书馆，靠窗长桌总被同一批人占着。闭馆前半小时最安静。',
    x: 110,
    y: 140,
    neighbors: ['yinghua_university', 'shancha_lookout', 'yuejian_park'],
  },
  {
    id: 'shancha_lookout',
    label: '山茶岭观景台',
    region: '山茶岭',
    description: '城西小山上的观景平台，沿路种满山茶。夜里能把百合市的灯火尽收眼底，是看日出和告白的老地方。',
    x: 60,
    y: 250,
    neighbors: ['zhizi_library', 'tinglan_apartment'],
  },
  {
    id: 'qiangwei_media',
    label: '蔷薇文化传媒',
    region: '中心城区',
    description: '位于花信大厦 17 层的内容与品牌公司，团队几乎全是女性。加班到深夜时，整层只剩几盏灯和茶水间的咖啡香。',
    x: 405,
    y: 90,
    neighbors: ['suzuran_apartment', 'yuejian_park', 'wanhua_mall', 'xiuqiu_street', 'mujin_gym'],
  },
  {
    id: 'wanhua_mall',
    label: '万花汇',
    region: '中心城区',
    description: '城中心最大的商场，顶层是影院和一排看得见夜景的餐厅，周末试衣间门口总排着队。',
    x: 485,
    y: 58,
    neighbors: ['qiangwei_media', 'tanye_bar', 'east_station'],
  },
  {
    id: 'xiuqiu_street',
    label: '绣球路步行街',
    region: '中心城区',
    description: '两侧种满绣球花的步行街，奶茶店、书店、拍贴机和街头歌手挤在同一段路上。',
    x: 400,
    y: 210,
    neighbors: ['qiangwei_media', 'tanye_bar', 'yinghuo_night_market', 'ziteng_community', 'mujin_gym'],
  },
  {
    id: 'mujin_gym',
    label: '木槿拳馆',
    region: '中心城区',
    description: '临街一层的小拳馆，傍晚亮起暖黄的灯，沙袋的闷响一直传到人行道上。',
    x: 345,
    y: 150,
    neighbors: ['qiangwei_media', 'xiuqiu_street'],
  },
  {
    id: 'tanye_bar',
    label: '昙夜酒吧',
    region: '夜樱街',
    description: '藏在夜樱街拐角的女士清吧，暖光吧台和一位话不多的女调酒师。只在夜里营业，熟客都知道这里不问来历。',
    x: 480,
    y: 150,
    nightGlow: true,
    neighbors: ['wanhua_mall', 'xiuqiu_street', 'huahuo_ktv', 'ziluolan_livehouse'],
  },
  {
    id: 'huahuo_ktv',
    label: '花火KTV',
    region: '夜樱街',
    description: '霓虹招牌的量贩式 KTV，包厢隔音一般。聚会唱到凌晨，总有人借着情歌说出平时不敢说的话。',
    x: 580,
    y: 190,
    nightGlow: true,
    neighbors: ['tanye_bar', 'east_station', 'ziluolan_livehouse'],
  },
  {
    id: 'ziluolan_livehouse',
    label: '紫罗兰Livehouse',
    region: '夜樱街',
    description: '旧仓库改造的小型现场，常驻几支女子乐队。台下挤得很近，散场后门口的路灯下常有人等人。',
    x: 520,
    y: 260,
    nightGlow: true,
    neighbors: ['tanye_bar', 'huahuo_ktv', 'ziteng_community', 'tanghua_onsen'],
  },
  {
    id: 'east_station',
    label: '百合东站',
    region: '东城',
    description: '高铁与城际列车的枢纽，出站口的大钟下总有人在等人，也总有人在告别。',
    x: 580,
    y: 90,
    neighbors: ['wanhua_mall', 'huahuo_ktv'],
  },
  {
    id: 'yinghuo_night_market',
    label: '萤火夜市',
    region: '老城南',
    description: '桥头的夜市，天黑后才热闹。烤串、糖水和套圈摊一路排到河边，挂满暖黄色的小灯泡。',
    x: 300,
    y: 260,
    nightGlow: true,
    neighbors: ['xingzhui_island', 'tinglan_apartment', 'xiuqiu_street', 'huaxiang_old_street'],
  },
  {
    id: 'huaxiang_old_street',
    label: '花巷老街',
    region: '老城南',
    description: '青石板路和老骑楼，花店、旧书摊与手冲咖啡馆藏在同一条巷子里，下雨天格外好看。',
    x: 330,
    y: 350,
    neighbors: ['yinghuo_night_market', 'ziteng_community'],
  },
  {
    id: 'ziteng_community',
    label: '紫藤里小区',
    region: '老城南',
    description: '九十年代的老小区，楼道口爬满紫藤。楼下有修车铺和下棋的老人，晚饭时满楼饭香。',
    x: 420,
    y: 290,
    neighbors: ['xiuqiu_street', 'huaxiang_old_street', 'ziluolan_livehouse', 'tanghua_onsen'],
  },
  {
    id: 'tanghua_onsen',
    label: '汤花温泉会馆',
    region: '老城南',
    description: '老城边的日式温泉会馆，有露天汤池和可预约的私汤。泡完换上浴衣，在廊下喝一瓶冰牛奶。',
    x: 510,
    y: 350,
    neighbors: ['ziteng_community', 'ziluolan_livehouse'],
  },
];

export const MAP_NODE_BY_ID = new Map(MAP_NODES.map(node => [node.id, node]));
export const MAP_NODE_BY_LABEL = new Map(MAP_NODES.map(node => [node.label, node]));

/** 月见河：从北向南穿城而过，把大学城、山茶岭与东岸城区隔开 */
export const RIVER_PATH =
  'M200,0 C215,60 190,110 205,160 C215,190 215,240 225,270 C235,310 235,360 240,400';

type NodeArt = { body: string; solid?: string };

/**
 * 每个节点的小建筑是手绘的，线条刻意不对称，
 * 让它们看起来像同一人手笔，而不是图标库里的成品。
 */
export const NODE_ART: Record<string, NodeArt> = {
  suzuran_apartment: {
    body: [
      'M-10,9 L-10,-14 L10,-14 L10,9',
      'M-6,-9 L-3,-9 M3,-9 L6,-9 M-6,-4 L-3,-4 M3,-4 L6,-4 M-6,1 L-3,1 M3,1 L6,1',
      'M-2,9 L-2,4 L2,4 L2,9 M-14,9 L14,9',
    ].join(' '),
    solid: 'M-12,-14 L12,-14 L12,-17 L-12,-17 Z',
  },
  yuejian_park: {
    body: [
      'M-11,10 L-9,1 M2,10 L0,1',
      'M-16,-1 C-16,-7 -10,-8 -8,-3 C-5,-9 3,-7 3,-1 C3,3 -16,3 -16,-1 Z',
      'M-2,-4 C-2,-10 4,-11 6,-6 C9,-12 17,-10 17,-4 C17,0 -2,0 -2,-4 Z',
      'M-13,10 L11,10',
    ].join(' '),
  },
  xingzhui_island: {
    body: [
      'M-12,-4 A12,12 0 1,0 12,-4 A12,12 0 1,0 -12,-4',
      'M0,-16 L0,8 M-12,-4 L12,-4 M-8.5,-12.5 L8.5,4.5 M8.5,-12.5 L-8.5,4.5',
      'M-7,10 L0,-4 L7,10 M-11,10 L11,10',
    ].join(' '),
  },
  tinglan_apartment: {
    body: [
      'M-8,9 L-8,-20 L8,-20 L8,9',
      'M-5,-15 L-2,-15 M2,-15 L5,-15 M-5,-10 L-2,-10 M2,-10 L5,-10 M-5,-5 L-2,-5 M2,-5 L5,-5 M-5,0 L-2,0 M2,0 L5,0',
      'M-2,9 L-2,5 L2,5 L2,9 M-11,9 L11,9',
    ].join(' '),
    solid: 'M-8,-20 L8,-20 L8,-24 L-8,-24 Z',
  },
  yinghua_university: {
    body: [
      'M-17,9 L17,9 M-15,9 L-15,-3 L15,-3 L15,9',
      'M-9,9 L-9,1 M-3,9 L-3,1 M3,9 L3,1 M9,9 L9,1',
      'M-17,-3 L0,-11 L17,-3 M0,-11 L0,-18 L6,-16 L0,-14',
    ].join(' '),
    solid: 'M-17,-3 L0,-11 L17,-3 Z',
  },
  zhizi_library: {
    body: [
      'M0,-10 C-6,-14 -13,-13 -17,-10 L-17,6 C-13,3 -6,3 0,6 C6,3 13,3 17,6 L17,-10 C13,-13 6,-14 0,-10 Z',
      'M0,-10 L0,6',
      'M-13,-5 L-4,-6 M-13,-1 L-4,-2 M4,-6 L13,-5 M4,-2 L13,-1',
      'M-6,10 L6,10',
    ].join(' '),
  },
  shancha_lookout: {
    body: [
      'M-18,9 L-7,-9 L-2,-2 L5,-13 L18,9 Z',
      'M5,-13 L5,-18 L10,-16.5 L5,-15',
    ].join(' '),
    solid: 'M-7,-9 L-4,-4 L-10,-4 Z',
  },
  qiangwei_media: {
    body: [
      'M-14,8 L-14,-6 L-4,-6 L-4,8',
      'M-1,9 L-1,-16 L10,-16 L10,9',
      'M-14,-1 L-4,-1 M-1,-9 L10,-9 M-1,-3 L10,-3 M2,1 L4,1 M6,1 L8,1',
    ].join(' '),
    solid: 'M-1,-16 L10,-16 L10,-11 L-1,-11 Z',
  },
  wanhua_mall: {
    body: [
      'M-18,9 L-18,-6 L18,-6 L18,9 M-18,-1 L18,-1',
      'M-12,9 L-12,3 L-4,3 L-4,9 M4,3 L12,3 L12,9',
    ].join(' '),
    solid: 'M-10,-12 L10,-12 L10,-6 L-10,-6 Z',
  },
  xiuqiu_street: {
    body: [
      'M-17,9 L-17,-6 L17,-6 L17,9',
      'M-17,-6 L-15,-1 L-11,-6 L-7,-1 L-3,-6 L1,-1 L5,-6 L9,-1 L13,-6 L17,-1',
      'M-13,9 L-13,3 L-8,3 L-8,9 M4,3 L12,3 L12,7 L4,7 Z',
    ].join(' '),
  },
  mujin_gym: {
    body: [
      'M-10,-25 L10,-25',
      'M0,-25 L0,-20',
      'M-3.5,-20 C-6,-15.5 -6,-7.5 -3.5,-4 L3.5,-4 C6,-7.5 6,-15.5 3.5,-20 Z',
      'M-4.8,-12 L4.8,-12',
      'M-11,9 L11,9',
    ].join(' '),
  },
  yinghuo_night_market: {
    body: [
      'M-17,-12 C-8,-6 8,-6 17,-12',
      'M-14,9 L-14,-1 L-2,-1 L-2,9 M2,9 L2,-1 L14,-1 L14,9',
      'M-16,-1 L-8,-5 L0,-1 L8,-5 L16,-1',
    ].join(' '),
    solid: 'M-10,-10 h3 v4 h-3 Z M-1.5,-8.5 h3 v4 h-3 Z M7,-10 h3 v4 h-3 Z',
  },
  huaxiang_old_street: {
    body: [
      'M-14,9 L-14,-5 L14,-5 L14,9',
      'M-17,-5 L0,-14 L17,-5',
      'M-8,9 L-8,1 L-3,1 L-3,9 M3,2 L9,2 M3,5 L9,5',
    ].join(' '),
    solid: 'M-17,-5 L0,-14 L17,-5 Z',
  },
  ziteng_community: {
    body: [
      'M-16,9 L-16,-2 L-8,-9 L0,-2 L0,9',
      'M2,9 L2,-4 L9,-11 L16,-4 L16,9',
      'M-10,9 L-10,3 L-6,3 L-6,9 M7,9 L7,3 L11,3 L11,9',
    ].join(' '),
  },
  east_station: {
    body: [
      'M-17,-3 L17,-3 M-17,3 L17,3',
      'M-12,-3 L-12,3 M-4,-3 L-4,3 M4,-3 L4,3 M12,-3 L12,3',
      'M-20,8 L20,8',
    ].join(' '),
    solid: 'M-17,-3 L17,-3 L17,3 L-17,3 Z',
  },
  tanye_bar: {
    body: [
      'M-10,-10 L8,-10 L-1,0 Z',
      'M-1,0 L-1,9 M-7,9 L5,9',
      'M3,-14 L-2,-6',
    ].join(' '),
    solid: 'M-7,-7.5 L5,-7.5 L-1,-1.5 Z M11,-16 A6,6 0 1,0 17,-6 A4.5,4.5 0 1,1 11,-16 Z',
  },
  huahuo_ktv: {
    body: [
      'M-6,-9 A6,6 0 1,0 6,-9 A6,6 0 1,0 -6,-9 M-6,-9 L6,-9',
      'M-3,-3 L-2,9 L2,9 L3,-3',
      'M12,-15 L12,-9 M9,-12 L15,-12 M-13,-3 L-13,2 M-15.5,-0.5 L-10.5,-0.5',
    ].join(' '),
    solid: 'M13,1 L14.5,4 L17.5,5 L14.5,6 L13,9 L11.5,6 L8.5,5 L11.5,4 Z',
  },
  ziluolan_livehouse: {
    body: [
      'M-16,9 L-16,-5 L0,-13 L16,-5 L16,9 M-19,9 L19,9',
      'M-11,9 L-11,1 L-3,1 L-3,9',
      'M10,5 L10,-4 L14,-5.5',
    ].join(' '),
    solid: 'M5,5 A2.5,2 0 1,0 10,5 A2.5,2 0 1,0 5,5 Z',
  },
  tanghua_onsen: {
    body: [
      'M-16,6 C-16,1 16,1 16,6 C16,11 -16,11 -16,6 Z',
      'M-8,-2 C-11,-6 -5,-8 -8,-12 M0,-2 C-3,-6 3,-9 0,-14 M8,-2 C5,-6 11,-8 8,-12',
    ].join(' '),
    solid: 'M-11,6 C-11,4 11,4 11,6 C11,8 -11,8 -11,6 Z',
  },
};

/** 手绘道路：用二次曲线，避免直线带来的工程图感 */
function roadPath(from: MapNode, to: MapNode) {
  const midX = (from.x + to.x) / 2;
  const midY = (from.y + to.y) / 2;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy) || 1;
  const bow = length * 0.13;
  const controlX = midX + (-dy / length) * bow;
  const controlY = midY + (dx / length) * bow;
  return `M${from.x},${from.y} Q${controlX.toFixed(1)},${controlY.toFixed(1)} ${to.x},${to.y}`;
}

export function mapRoads() {
  const seen = new Set<string>();
  const roads: Array<{ d: string; from: string; to: string }> = [];
  MAP_NODES.forEach(node => {
    node.neighbors.forEach(targetId => {
      const target = MAP_NODE_BY_ID.get(targetId);
      if (!target) return;
      const key = [node.id, target.id].sort().join('|');
      if (seen.has(key)) return;
      seen.add(key);
      roads.push({ d: roadPath(node, target), from: node.id, to: target.id });
    });
  });
  return roads;
}

export const REGION_COLORS: Record<string, string> = {
  月见河畔: '#6f9fb0',
  大学城: '#c39a62',
  山茶岭: '#7ea36f',
  中心城区: '#b07a9c',
  夜樱街: '#8f72c4',
  东城: '#7d8fb8',
  老城南: '#c4826e',
};

/**
 * 区域标注坐标由脚本按「贴近本区地点、避开其它区地点/道路/河道」求解得出。
 * 调整地点坐标后需要重新核对，否则标注会漂到别的区。
 */
export const REGION_LABELS: Array<{ text: string; sub: string; x: number; y: number }> = [
  { text: '月见河畔', sub: 'RIVERSIDE', x: 275, y: 187 },
  { text: '大学城', sub: 'CAMPUS', x: 125, y: 101 },
  { text: '山茶岭', sub: 'CAMELLIA HILL', x: 60, y: 297 },
  { text: '中心城区', sub: 'DOWNTOWN', x: 398, y: 48 },
  { text: '夜樱街', sub: 'NIGHT SAKURA', x: 585, y: 237 },
  { text: '东城', sub: 'EAST END', x: 580, y: 51 },
  { text: '老城南', sub: 'OLD TOWN', x: 407, y: 337 },
];

export const RIVER_LABEL = { text: '月见河', x: 205, y: 54 };
export const COMPASS = { x: 612, y: 371 };
export const CARTOUCHE = { x: 68, y: 381 };

type FloraKind = 'tree' | 'lily' | 'grass';

/** 花草以底部中点为原点绘制，摇摆动画绕底部转动 */
export const FLORA_ART: Record<FloraKind, { line: string; fill?: string }> = {
  tree: {
    line: 'M0,0 L0,-5',
    fill: 'M-5.5,-5 C-7,-10 -2,-13.5 0.5,-11 C3,-14 7.5,-10 5.5,-5.5 C4.5,-3.5 -4,-3 -5.5,-5 Z',
  },
  lily: {
    line: 'M0,0 C0.5,-3 -0.5,-6 0,-8 M0,-3 C-2,-4 -3,-5 -3.5,-7',
    fill: 'M0,-8 C-3,-9 -4,-12 -3.5,-14 C-1.5,-12.5 -0.5,-11 0,-8 Z M0,-8 C0,-11 1,-13.5 2.5,-15 C3,-12 2,-10 0,-8 Z M0,-8 C2.5,-9.5 4.5,-10 6,-9.5 C4.5,-8 2.5,-7.5 0,-8 Z',
  },
  grass: {
    line: 'M-3,0 C-3,-3 -4,-5 -5,-6 M0,0 C0,-3 0.5,-6 0,-8 M3,0 C3,-3 4,-4.5 5,-5.5',
  },
};

export const MAP_FLORA: Array<{ x: number; y: number; kind: FloraKind }> = [
  { x: 34, y: 18, kind: 'lily' },
  { x: 258, y: 22, kind: 'tree' },
  { x: 166, y: 26, kind: 'lily' },
  { x: 14, y: 74, kind: 'grass' },
  { x: 122, y: 78, kind: 'lily' },
  { x: 254, y: 82, kind: 'grass' },
  { x: 170, y: 106, kind: 'tree' },
  { x: 34, y: 126, kind: 'grass' },
  { x: 174, y: 154, kind: 'lily' },
  { x: 34, y: 190, kind: 'tree' },
  { x: 130, y: 194, kind: 'grass' },
  { x: 174, y: 222, kind: 'lily' },
  { x: 110, y: 254, kind: 'tree' },
  { x: 14, y: 262, kind: 'tree' },
  { x: 178, y: 278, kind: 'tree' },
  { x: 270, y: 314, kind: 'lily' },
  { x: 110, y: 322, kind: 'tree' },
  { x: 34, y: 330, kind: 'grass' },
  { x: 206, y: 374, kind: 'tree' },
  { x: 270, y: 374, kind: 'lily' },
  { x: 442, y: 378, kind: 'tree' },
  { x: 146, y: 386, kind: 'lily' },
];

export const MAP_FIREFLIES: Array<{ x: number; y: number }> = [
  { x: 187, y: 29 },
  { x: 183, y: 107 },
  { x: 184, y: 147 },
  { x: 250, y: 248 },
  { x: 215, y: 317 },
  { x: 220, y: 377 },
];
