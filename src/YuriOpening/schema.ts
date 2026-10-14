export const Schema = z.object({
  玩家: z
    .object({
      _姓名: z.string().prefault('未命名'),
      _称呼: z.string().prefault(''),
      _性别: z.literal('女性').prefault('女性'),
      _年龄: z.coerce.number().int().transform(value => Math.max(value, 18)).prefault(24),
      _自我呈现: z.string().prefault('自然、舒适'),
      _外貌: z
        .object({
          _身高: z.enum(['娇小', '中等', '高挑']).prefault('中等'),
          _发型: z.string().prefault('中长发'),
          _气质: z.string().prefault('清爽'),
          _穿衣: z.string().prefault('简约通勤'),
          _特征: z.string().prefault(''),
        })
        .prefault({}),
      _职业: z
        .object({
          _方向: z.enum(['专业/办公室', '服务/生活', '自由/创作']).prefault('专业/办公室'),
          _具体: z.string().prefault(''),
        })
        .prefault({}),
      _能力: z
        .object({
          共情: z.coerce.number().int().transform(value => _.clamp(value, 1, 3)).prefault(2),
          表达: z.coerce.number().int().transform(value => _.clamp(value, 1, 3)).prefault(2),
          观察: z.coerce.number().int().transform(value => _.clamp(value, 1, 3)).prefault(2),
          勇气: z.coerce.number().int().transform(value => _.clamp(value, 1, 3)).prefault(2),
          边界感: z.coerce.number().int().transform(value => _.clamp(value, 1, 3)).prefault(2),
        })
        .prefault({}),
      _主特长: z.string().prefault('摄影'),
      _兴趣: z.preprocess(
        value => (typeof value === 'string' ? [value] : value),
        z.array(z.string()).prefault(['阅读']),
      ),
    })
    .prefault({}),
  开场: z
    .object({
      _情境: z.enum(['温和日常', '意外事件', '暧昧试探', '自定义']).prefault('温和日常'),
      $已提交: z.boolean().prefault(false),
    })
    .prefault({}),
  环境: z
    .object({
      日期: z.string().prefault('待设定'),
      时间: z.string().prefault('待设定'),
      天气: z.enum(['待设定', '晴', '多云', '阴', '小雨', '大雨', '雷雨', '雾', '雪']).prefault('待设定'),
      主题覆盖: z.enum(['自动', '室内暖光', '特殊夜景', '停电应急', '节日灯光']).prefault('自动'),
      地点: z
        .object({
          城市: z.string().prefault('待设定'),
          区域: z.string().prefault('待设定'),
          具体地点: z.string().prefault('待设定'),
        })
        .prefault({}),
    })
    .prefault({}),
  玩家状态: z
    .object({
      心情: z.enum(['待设定', '平静', '愉快', '紧张', '低落', '心动', '烦躁']).prefault('待设定'),
      精力: z
        .union([
          z.coerce.number().int().transform(value => _.clamp(value, 0, 100)),
          z.literal('待设定'),
        ])
        .prefault('待设定'),
      身体状态: z.enum(['待设定', '健康', '疲惫', '轻微不适', '生病', '受伤']).prefault('待设定'),
      当前行动: z
        .enum(['待设定', '工作', '通勤', '休息', '用餐', '独处', '与主要角色相处', '移动中'])
        .prefault('待设定'),
      关系姿态: z
        .enum(['待设定', '保持距离', '试探靠近', '自然相处', '主动靠近', '暧昧拉扯', '坚定边界'])
        .prefault('待设定'),
      当前穿着: z.string().prefault('待设定'),
    })
    .prefault({}),
  林清: z
    .object({
      亲近: z
        .union([
          z.coerce.number().int().transform(value => _.clamp(value, 0, 100)),
          z.literal('待设定'),
        ])
        .prefault('待设定'),
      心动: z
        .union([
          z.coerce.number().int().transform(value => _.clamp(value, 0, 100)),
          z.literal('待设定'),
        ])
        .prefault('待设定'),
      心情: z
        .enum(['待设定', '平静', '愉快', '害羞', '心动', '紧张', '低落', '生气', '吃醋'])
        .prefault('待设定'),
      当前行动: z.string().prefault('待设定'),
      当前穿着: z.string().prefault('待设定'),
      关系身份: z.enum(['待设定', '初识', '熟人', '朋友', '挚友', '暧昧', '恋人']).prefault('待设定'),
      所在地点: z.string().prefault('待设定'),
      心声: z.string().prefault(''),
    })
    .prefault({}),
  苏玥: z
    .object({
      亲近: z
        .union([
          z.coerce.number().int().transform(value => _.clamp(value, 0, 100)),
          z.literal('待设定'),
        ])
        .prefault('待设定'),
      心动: z
        .union([
          z.coerce.number().int().transform(value => _.clamp(value, 0, 100)),
          z.literal('待设定'),
        ])
        .prefault('待设定'),
      心情: z
        .enum(['待设定', '平静', '愉快', '害羞', '心动', '紧张', '低落', '生气', '吃醋'])
        .prefault('待设定'),
      当前行动: z.string().prefault('待设定'),
      当前穿着: z.string().prefault('待设定'),
      关系身份: z.enum(['待设定', '初识', '熟人', '朋友', '挚友', '暧昧', '恋人']).prefault('待设定'),
      所在地点: z.string().prefault('待设定'),
      心声: z.string().prefault(''),
    })
    .prefault({}),
  地图: z
    .object({
      当前地点: z.string().prefault('待设定'),
      地点状态: z
        .record(
          z.string(),
          z.object({
            状态: z.string().prefault('正常'),
            备注: z.string().prefault(''),
          }),
        )
        .prefault({}),
    })
    .prefault({}),
  微信: z
    .object({
      _已添加林清: z.boolean().prefault(false),
      _已添加苏玥: z.boolean().prefault(false),
      _林清已知事件: z.string().prefault(''),
      _苏玥已知事件: z.string().prefault(''),
      _聊天摘要历史: z.preprocess(
        value => (typeof value === 'string' ? [value] : value),
        z.array(z.string()).prefault([]),
      ),
      _苏玥聊天摘要历史: z.preprocess(
        value => (typeof value === 'string' ? [value] : value),
        z.array(z.string()).prefault([]),
      ),
      _朋友圈: z.preprocess(
        value => (Array.isArray(value) ? value : []),
        z
          .array(
            z.object({
              作者: z.string().prefault('林清'),
              内容: z.string(),
              时间: z.string(),
              心情: z.string(),
              点赞数: z.coerce.number().int().prefault(0),
            }),
          )
          .prefault([]),
      ),
      _未读数: z.coerce.number().int().transform(value => Math.max(value, 0)).prefault(0),
    })
    .prefault({}),
});

export type OpeningState = z.infer<typeof Schema>;
