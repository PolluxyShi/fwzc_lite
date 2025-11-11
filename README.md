# 符文战场（fwzc_lite）

一个基于 Web 的双人对战桌游实现，支持在线联机、卡组导入与自定义构筑。

## 游戏简介

- 符文战场是以“传奇+符文+战场+主牌40张”为核心构筑的对战游戏。
- 本项目内置官方7个预组卡组，开箱即玩；支持玩家使用内置的卡组编辑器构筑并导出自定义卡组。
- 游戏核心规则请参阅 `《符文战场》核心规则_250617.pdf`。

## 环境准备

- Node.js 16+（推荐 18+）
- npm 8+

## 安装与运行

1) 安装依赖
```bash
npm install
```

2) 启动服务器
```bash
npm start
```
启动后访问 `http://localhost:3000`

3) 开始对战
- A 玩家：在首页输入昵称并点击“创建房间”，会获得一个房间ID
- B 玩家：在另一浏览器/标签页输入相同房间ID与昵称，点击“加入房间”
- 双方选择卡组（可用预组，或你的自定义卡组），房主点击“开始游戏”

## 预组卡组

项目提供符文战场官方的7个预组，已放置于 `decks/` 目录，安装后即可在房间内直接选择并游玩。

## 使用卡组编辑器构筑自定义卡组

编辑器文件：`card_data/deck_editor.html`

1) 打开方式
- 直接用浏览器打开 `card_data/deck_editor.html`（本地文件）

2) 加载数据
- 点击“加载卡牌数据 (card_data.csv)”按键，选择 `card_data/card_data.csv`

3) 构筑流程
- 选择“传奇” → 设置两种“符文”（合计12张） → 选择“战场”（1-3张） → 选择“卡牌”（主牌合计40张）
- 页面右侧“卡组摘要”实时显示卡组统计与验证结果

4) 保存导出
- 在“保存卡组”输入“卡组名称”和“文件名”，点击“保存卡组”将导出 JSON 文件
- 将导出的 JSON 文件放入 `decks/` 目录，刷新游戏页面后可在卡组列表中选择

5) 英文卡表导入（可选）
- 在编辑器首页可加载英文映射表：选择 `card_data/id_2_english_name.txt`
- 将英文卡表（示例见 `card_data/english_code_example`）粘贴到文本框，每行格式为“数量 空格 英文名”
- 点击“从英文卡表导入”，编辑器会根据映射表自动识别对应卡牌并填入卡组

导出的自定义卡组 JSON 字段说明（与游戏框架兼容）：
- 所有卡片均仅保留必要字段：`num`、`card_id`、`card_name`、`color`、`card_type`
- 传奇与专属卡牌额外使用 `legend_belongto` 标记所属传奇

示例（片段）：
```json
{
  "deck_name": "my_deck",
  "legend": {
    "num": 1,
    "card_id": "ogs-021",
    "card_name": "光辉女郎-拉克丝",
    "color": ["蓝色", "黄色"],
    "card_type": "传奇",
    "legend_belongto": "拉克丝"
  },
  "runes": [
    { "num": 6, "card_id": "...", "card_name": "...", "color": ["蓝色"], "card_type": "符文" },
    { "num": 6, "card_id": "...", "card_name": "...", "color": ["黄色"], "card_type": "符文" }
  ],
  "battlefield": [
    { "num": 1, "card_id": "...", "card_name": "...", "color": [], "card_type": "战场" }
  ],
  "cards": [
    { "num": 3, "card_id": "...", "card_name": "...", "color": ["黄色"], "card_type": "单位" }
  ]
}
```

## 项目结构（简要）

```
fwzc_lite/
├── server.js                 # 服务端
├── package.json
├── decks/                    # 卡组目录（含官方7个预组与自定义卡组）
├── card_data/
│   ├── deck_editor.html      # 本地打开的卡组编辑器
│   ├── card_data.csv         # 卡牌数据库
│   ├── id_2_english_name.txt # 英文名→卡牌ID映射（可选）
│   └── images/               # 卡牌图片
└── public/                   # 前端页面与静态资源
```

## 核心规则

游戏的完整规则请查阅根目录中的 `《符文战场》核心规则_250617.pdf`。

## 技术栈

- 后端：Node.js + Express + WebSocket
- 前端：HTML + CSS + JavaScript
- 通信：WebSocket (ws)

## 常见问题

- 启动后无法看到卡图：请确认 `card_data/images/` 下存在对应图片文件，文件名需与卡牌 `card_id` 规则一致。
- 新增自定义卡组后列表不出现：请确认 JSON 放在 `decks/` 目录并格式正确，然后刷新页面/重启服务。
- 编辑器验证不通过：请检查构筑规则（传奇1张、两种符文合计12张、战场1-3张、主牌40张、单卡最多3张、专属卡必须匹配所属传奇与颜色）。

## 许可证

MIT License

