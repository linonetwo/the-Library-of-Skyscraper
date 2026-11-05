# 行动规则 SDK · v0 可玩切片

依据知识库《竞技场行动规则意图输出契约》《竞技场脚本运行时API与沙盒上下文》
和《竞技场脚本运行时与 TypeScript 策略》，提供共享只读类型及三份纯函数策略示例。

```sh
cd arena/script-sdk
npm run typecheck
npm test
```

类型检查复用 `arena/client/node_modules/typescript`，严格模式、仅 ES2022 类型、零输出文件。
测试通过 Node 24 类型擦除直接调用官方示例纯函数。此包交付类型与示例；
玩家代码加载、独立 deno_core/V8 isolate worker 和权威意图执行由后续运行器接入完成。

## 入口与当前字段

```ts
import type { RuleContext, RuleDecisionResult } from '@skyscraper/arena-script-sdk';

export function decide(ctx: RuleContext): RuleDecisionResult {
  return { intents: [] };
}
```

`decide` 同步返回 `intents`，上下文保留知识库的七个具名入口：

|入口|v0 内容|
|---|---|
|`tick`|权威模拟整数 tick|
|`player`|玩家 ID、库存建材、编目分、当前 preset 与 retreatHp|
|`squad`|己方角色、生命、位置、货物容量、纸娃娃外观|
|`world`|授权房间、角色与建筑视图；当前游戏全场共享视野|
|`tasks`|预留具名视图，`items` 当前为空|
|`memory`|只读 JSON 策略记忆视图；示例使用空对象|
|`limits`|意图、任务补丁、日志、记忆、预算提示；运行器执行配额待接入|

所有视图字段和嵌套集合均为只读类型。真正的输入授权、对象隔离及输出处理属于
运行器与模拟核心；TypeScript 类型用于开发体验。

意图种类为 `move/gather/deliver/attack/capture/build`，均带 `actorId`、`priority`
及可选 `reason`。`move` 指定 `roomId`；`build` 指定房间和 `tower/catalog`。
`deliver` 对应当前中庭交付，`capture` 对应当前编目；未来通用 `transfer/claim`
接口另行演进。`build.actorId` 是规则侧角色归因，接入时由权威动作适配器
将其映射到现有建筑命令。装备配置通过玩家换装命令管理。

## 官方示例

- `gather.ts`：采集者优先琥珀纸林，耗尽后选择其余资源节点；侦察员前往编目台，
  守卫前往遗失书库。在资源房间采集，满载或节点耗尽携货返仓，再于中庭交付。
- `defend.ts`：小队回到中庭；沿途处理当前房间敌人，携货到仓后交付。
- `explore.ts`：侦察员探索月灯书架，守卫探索旧日索引，采集者优先墨晶回廊。

`shared.ts` 组合共用的卸货、低血量回撤、满载运输、战斗、编目与中央枢纽路径逻辑。
低血量角色先回中庭，之后输出空意图等待核心恢复；零生命角色等待核心回撤恢复。
每角色每次决策至多一个意图，按优先级和角色 ID 稳定排序，再分配 `maxIntents` 额度。
无资源、已完成目标、目标争夺中可输出空意图。示例使用当前七房间拓扑和角色分工；
正式目标选择工具和长路径查询留给后续公开 API。

这些示例目前用于策略编写与动作输出测试。当前 Rust preset 系统仍负责游戏自动行动，
执行器接入时需要统一空意图、恢复、手动动作额度和意图结算语义。

## 后续接口

- `ArenaScriptApi` 的实体/建筑/资源/任务查询、路径估算与目标评分工具。
- 任务队列补丁、`memoryPatch` 持久化、角色/队伍 localStorage、建筑 indexedDB。
- 技能、咏唱、能量与事件窗口接口；通用传输、建造计划及任务协作。
- `SourceRef`、结构化决策日志、源码清单及跨 tick 复盘归因。
- TypeScript 发布编译、依赖白名单、V8 worker、CPU/内存配额与输出 schema。

当前包只承诺上述 v0 类型和官方示例。测试覆盖采集运输交付、资源耗尽重选、
低血量携货回撤、守卫/探索、战斗后编目、多人争夺与确定性输出。
