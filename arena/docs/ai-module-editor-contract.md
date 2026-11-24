# AI1 / P4b：可玩的行为模块工作台（v0.3）

**交付边界。** 地图 HUD 常驻「AI 模块」按钮，一击打开游戏内工作台；单排切换行为模块、TypeScript、发布版本与行动预设。保留全屏地图及当前训练局，不另开网页。初次进入即显示五张可编辑的优先级卡片；完整状态机和决策树不是这些卡片的别名。

## 1. 玩家编辑什么

唯一结构模型 `BehaviorPlan`，例如以下是一个**完整但仅含一个绑定**的合法草案：

```json
{"schemaVersion":1,"compositionId":"training","mode":"priority","modules":[{"moduleId":"recall","kind":"retreat","enabled":true,"priority":100,"config":{"hpThreshold":30}}],"fallbackModuleId":"hold"}
```

默认模板提供全部五项。`moduleId` 是组合内唯一且稳定的绑定 ID，不是显示名、种类或数组下标；`hold` 保留。每项可开关、改优先顺序、按 `roleFilter?: ('gatherer'|'guard'|'scout')[]` 限定岗位；省略表示全部。`priority` 数字越大越靠前，同值保持数组顺序，UI 重排必须真正改变评估顺序。卡片列出岗位、条件、参数单位、动作和不适用时的下一跳。连线直接表示「本角色 → 首个启用且匹配岗位的卡 → 命中则选择动作 / 未命中则下一卡 → 保持」，不开放任意接线。无需图引擎。

| 卡 / `kind` | `config`（默认「首场远征」） | 对真实 SDK 的输出 |
|---|---|---|
| 采集 `gather` | 采撷师；`targetRoomId: "room-1"` | 有空余容量才尝试；异房 `move`、同房 `gather`。指定目标耗尽则不命中；清空目标后自动选资源房。 |
| 搬运 `haul` | 采撷师；`minCargo: 8` 件 | 达阈值且有货则回基地，异房 `move`、抵达 `deliver`；以实际入库为准。 |
| 建造 `build` | 巡书使；`roomId: "room-3"`、`buildingKind: "catalog"`、`minMaterials: 25` | 新工地须过材料门槛；先 `move` 后 `build`，已建完不新建。仅 `tower` / `catalog`；编目台仅目标房。材料门槛不是服务端造价。 |
| 守卫 `defend` | 守卷人、巡书使；`roomId: "room-3"` | 异房 `move`，抵达后 `capture` 建立权威驻防任务；追近后按距离和冷却 `attack`。无敌时保持驻守，符合场景条件才实际编目。 |
| 撤退 `retreat` | 全队；`hpThreshold: 20` HP（绝对生命值） | `hp <= hpThreshold` 回基地 `move`，已安全则保持，不发送伪 `retreat`。 |

每个自有角色每次最多一个意图。倒地或已在路上不重复派移动；没有适用卡时 `hold` 返回零意图并说明原因，不代表强制取消正在进行的权威动作。固定快照与配置产生相同选择，不读取隐藏地图、浏览器时间或随机数。生成规则与手写规则都进权威意图/动作校验；`taskPatches` 是计划队列，不能替代执行。

## 2. 一个工程，两种编辑界面

新草稿使用 `createFirstExpeditionPlan()`；显式选择「物流循环」才使用 `createDefaultBehaviorPlan()`。两者都由 `toRuleSourceProject(plan)` 生成已有 `{entry:"main.ts",files:Record<string,string>}`。`main.ts` 导出 `decide`；`ai-plan.ts` 首行是 `// @arena-ai/v1 <canonical JSON>`，下方是有类型的绑定定义（每项单独可定位）；`runtime.ts` 是可读、随源码归档的策略实现，仅依赖项目文件与 SDK。相同模型、生成器和工具链生成相同源码、同一 `sourceHash`。旧工程执行及只读源码定位使用归档文件，不要求与今天的生成器逐字相同。

模块页和 Monaco 共用挂在面板宿主上的一个 `useScriptWorkbench`；仍用 `draftKey(session)` 的 `files/entry/activeFile/baseVersion`。编辑模块调用既有项目更新路径、作废过期诊断/预览；不自动发布。打开/切回/载入版本时，`recoverBehaviorPlan(project)` 只解析自己版本的 marker（`JSON.parse`），并验证该工程仍是生成结果；不可识别不作可逆转换。直接编辑生成文件、改入口或增加手写文件后仍是完整源码工程。不得仅凭 marker 盲写其他文件或从任意 TS 推断策略。

只有未发布且未改动的初始单文件样例会自动进入「首场远征」；既有模块草稿继续编辑原组合，手写草稿默认保留源码。玩家主动采用官方组合或源码模板时，先将当前 `RuleDraft` 压入该会话、该玩家的 `${draftKey(session)}:replacement-history`，再载入所选工程，不弹确认窗。普通改参数、切页和试跑不压栈。「撤销上次替换」弹出栈顶，恢复原文件、入口和基础版本；例如手写 A → 采用模板 → 编辑成手写 B → 另一模板，连续两次撤销分别恢复 B、A。该栈只处理本地草稿替换，与已发布版本历史、活动版本回滚相互独立。

## 3. 如何知道谁选了什么

不加 endpoint、SDK 命令或第二模拟器。compile / preview / publish / versions / rollback / rule-state / replay-timeline 原样复用。生成的 `decide(ctx)` 返回真实 `intents` 和下面的现有私有记忆补丁，每次**替换**最新记录而非追加日志：

```json
{"memoryPatch":{"set":{"aiTrace":{"v":1,"tick":28,"actors":[{"actorId":"p1-gatherer","visited":["recall","haul"],"moduleId":"haul","reason":"cargo ready for delivery"}]}}}}
```

`visited` 只含实际评估的绑定，按顺序直到命中，不把禁用、岗位不符或未访问节点涂亮。`moduleId` 是胜出绑定或 `hold`。预览取 `execution.decision.memoryPatch.set.aiTrace`；实跑取当前玩家/版本 `state.memory.aiTrace`；回放只取播放器本人截至选中 `operationIndex` 的 `ruleHistory` 私有补丁，并与当帧 `sourceHash` 匹配，标明原决策 tick，不能用最终状态倒灌。reset 清空，切换版本不串线，公共/旧回放或运行失败明确无本次路径。回放记录的脚本选择不是命中、入库或工程结算凭证；人工抢占/指令被拒要与权威事件区分。不要用 `intent.reason` 传证据，当前 Rust `ScriptIntent` 不保留它。

以 `(owner, sourceHash, moduleId)` 找到原版本的项目，再取绑定 `config` 和 `{file,line,column}`（1 起算）传给既有 Monaco 定位。`sourceHash` 由编译/运行外壳提供，不嵌入自身源文件；绑定可分别定位，隐式 `hold` 指回 `runtime.ts` fallback。回放无版本源码访问权时可以显示录到的路径 ID、原因，不伪造旧参数或打开当前草稿同名节点。

## 4. 实施归属（最小分工）

| 归属 | 代码边界 |
|---|---|
| 生成器 / 策略 | `arena/behavior-modules/`：types、defaults、工程编解码、可读运行源码与针对五卡的固定快照测试；导出小函数，不建插件框架。 |
| 游戏工作台 | `arena/client/src/BehaviorWorkbench`、`BehaviorCard`、`BehaviorFlow`、小 hook、独立 CSS；消费上述函数与现成项目控制器，不在 React 重新计算哪张卡获胜。 |
| 宿主 / 定位 / 复盘 | 地图入口、`RuleEditor` / `ScriptWorkbench` 共享控制器；在已有 `ReplayRules` / `projectRuleHistory` 读取一次同形 trace。现有版本和诊断导航复用。 |
| 权威 / 工具链 | 复用 `script-sdk`、`script-toolchain`、Rust V8、`advance_scripted` 和现有版本/回放私有边界；不另造行为模块服务或内置场景回放。 |

## 5. 六项放行验收

1. **找得到、改得动。** 新玩家在全屏训练地图一击打开五卡；不用键入 TS 改岗位、顺序、阈值及开关，连线反映新顺序，刷新仍是本人草稿。
2. **采集→搬运。** 固定训练局，真实编译/试跑见采集者选择采集，到房后货量增加；过搬运门槛选择搬运，回仓后载量减少且玩家材料增加。改门槛能改变相应试跑路径。
3. **建造。** 在合法无敌房、足料并启用建造时，权威开始对应 `tower` 或目标房 `catalog`，验证材料支出及施工进度；无料/已完成不重复开工，卡片解释落到下一项或保持。
4. **守卫→撤退→保持。** 同一守卫在敌人有效范围内实测伤害；调高优先撤退的 HP 阈值后，在同输入的真实预览转走撤退分支。安全地、行军或无适用项能看到零意图原因，不误报攻击或抵达。
5. **同源与无损。** 可视结果打开 Monaco 定位选中绑定；同工程发布 A、改参发布 B、查历史并回滚 A，版本/hash/阈值吻合；含额外文件的用户 TS 经往返、采用模板及恢复后逐字不变。
6. **证据不是猜测。** 真 V8 的试跑、已发布后 owner state、owner 回放选帧三处能按角色高亮实际访问链与命中卡，能定位该版配置和源码；reset、跨版本、无权限、缺源码及被拒动作分别显示正确边界，不把其他帧、草稿或公有回放当本帧成功。

**后续仍保留的 Wiki 范围：** FSM 的状态/入口/持续/退出/转移/异常、决策树的条件/评分/组合/动作/日志、加权组合、自然语言目标→可审阅补丁。它们不是本次的空标签，也不替代本版必须可玩的五模块优先序。依据：《竞技场行为模块接口与组合模型》《竞技场状态机决策树与行为模块编辑》《竞技场规则工作台自然语言目标与结构化配置》《竞技场行为模块系统》《竞技场行动规则系统》《竞技场客户端React UI与规则编辑器》。
