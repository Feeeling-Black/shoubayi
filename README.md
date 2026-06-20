# 手把一规则引擎

这是《手把一》后端规则层的起步版本，先实现牌型分析和压制比较，不接 UI、不接微信小游戏前端。

## 当前范围

- `HandAnalyzer`：把一手 `cardId` 对应的后端牌对象解释成结构化牌型。
- `HandComparator`：判断当前出牌能否压过上一手。
- `PlayValidator`：校验是否轮到当前玩家、`cardId` 是否属于后端手牌、首出/跟牌是否合法、是否能压上一手。
- `DealManager`：生成 4 副牌 + 4 张独立癞子，洗牌、发牌、确定明牌首出玩家。
- `GameStateMachine`：处理出牌、过牌、接风、玩家出完、结算升级。
- `TributeManager`：判断反贡、抗贡、常规进贡，并取最大非癞子贡牌。
- `AutoPlayManager`：处理首出超时的最小自然牌选择，不主动出炸弹或癞子组合。
- `Room`：给网络层/前端调用的房间门面，支持开局、出牌、过牌、按座位生成快照。
- `Rank`：按当前级牌计算动态牌力。
- `network/MessageTypes`：定义前后端通信消息结构。
- 测试覆盖癞子、同张、单顺、连对/多张连、普通炸弹、王炸、炸弹比较、最终打 A 限制、出牌校验、发牌、房间流程、接风、进贡、托管。

## 运行测试

```bash
node --test
```

当前项目使用 Node 24 直接运行 TypeScript 测试，不需要先安装依赖。

## 单机演示

```bash
node src/dev/SinglePlayerDemo.ts
```

这个命令会创建本地房间、自动发牌，并用简单托管策略让 4 个座位轮流出牌/过牌。它不是正式 UI，只用于验证规则和局内流程能跑起来。

## 网页预览

如果本地端口服务访问不了，可以直接打开静态预览文件：

```text
public/preview.html
```

静态预览不依赖 `localhost`，适合先看界面和基本单机流程。

如果第一次看不懂调试界面，先打开更简单的玩家视角版本：

```text
public/easy-preview.html
```

```bash
node src/dev/PreviewServer.ts
```

启动后打开：

```text
http://localhost:4173
```

网页里可以切换 A/B/C/D 视角、选择手牌、出牌、过牌、重新发牌，也可以点“自动走一步”让本地托管推进流程。

## 推荐下一步

1. 接 WebSocket 服务端，把 `Room` 的 `playCards` / `pass` 暴露给客户端。
2. 接 Cocos 前端，把 `_chooseCard` 改成只发送 `cardIds`。
3. 补完整进贡交互状态，包括选贡池、5 秒超时随机分配、返还牌。
4. 补龙牌库完整规则。
5. 接 Redis / 数据库做断线重连、房间恢复和战绩保存。
