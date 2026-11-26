# Arena MCP (stdio)

Requires Node 22+ and a running Rust authority (default `127.0.0.1:8787`).

```sh
cd arena/tools
npm ci
npm start
```

Configure an MCP client with command `node` and absolute argument
`/path/to/the-Library-of-Skyscraper/arena/tools/server.mjs`.
Optional `ARENA_BASE_URL` accepts an HTTP or HTTPS authority origin, including public servers. URL credentials, paths, queries and fragments are rejected. Redirects are
disabled. Standard output is reserved for official SDK protocol messages.

Twenty-two tools expose CDP-style domains: `Session.create`, `Session.join`,
`Session.getState`, `Simulation.command`, `Simulation.pause`, `Simulation.step`,
`Simulation.reset`, `Script.compile`, `Script.preview`, `Script.publish`,
`Script.disable`, `Script.listVersions`, `Script.getVersion`, `Script.rollback`, `Script.getState`,
`Replay.getEvents`, `Replay.export`, `Page.open`, `Page.getState`,
`Page.captureScreenshot`, `Page.close`, `Input.action`. Create/join returns a local handle, session
ID and player ID. Credentials are held in process memory,
and are lost on MCP restart. Reuse a handle after transient connection failure;
joining again creates another player. All commands pass through the authority.
Training sessions provide pause/step/reset. `Replay.getEvents` reads recent
events; `Replay.export` downloads recorded actions with the requesting player's private memory and tasks.

`Script.getState({handle})` returns the active version's memory and the player's
shared task queue. Publishing a new hash selects its own memory; restoring a hash
resumes that version's last memory. Training reset clears runtime state.

`Script.compile/preview/publish` accept `{handle, files, entry?}`, where `files`
maps project-relative paths to TypeScript source and `entry` defaults to
`main.ts`. Compile returns diagnostics and a bundle; preview returns decisions
against a snapshot. Publish binds the compiled version to the handle's player,
so subsequent authority ticks apply its decisions. An empty `intents` array
holds position. `Script.disable({handle})` resumes the player's action preset.
`Session.getState` includes the published version hash in `Player.script`.
`Script.listVersions({handle})` lists this player's published history;
`Script.getVersion({handle, sourceHash})` returns the original multi-file project.
`Script.rollback({handle, sourceHash})` activates that stored version for future
ticks, preserving the other players' rule choices.

Browser control is optional and isolated from simulation handles. It launches
headless Chromium at `ARENA_UI_URL` (default `http://127.0.0.1:5173`). This is independent of `ARENA_BASE_URL`; configure the game UI’s server address through its existing settings. It supports
training/lobby navigation, selecting actors/rooms, outfits/hair/staff, rules,
map zoom and player commands. `Page.getState` reads rendered body text and visible
button labels. `Page.captureScreenshot` returns PNG image content directly via
MCP. `Page.close` releases the browser context.

The browser action chain `openScripts` → `loadScriptTemplate` →
`editScript` → `publishScript` edits and publishes through Monaco's visible UI;
`disableScript` restores the action preset. Templates are `recall`, `gather`,
`defend`, `explore`, and `memory-gather`. `editScript` accepts `source` and uses clipboard paste
to preserve multiline source exactly, then waits for the local draft update.
For example: `{"action":{"type":"loadScriptTemplate","template":"gather"}}`.
Multi-file controls use `addScriptFile`, `selectScriptFile`, and `setScriptEntry`
with `{file}`. `openScriptHistory` exposes version controls;
`selectScriptVersion({sourceHash})`, `loadScriptVersion`, and
`restoreScriptVersion` select, load a draft, or restore the running version.
`toggleScriptDiff({enabled})` and `selectScriptDiffFile({file})` control the source
comparison. `Page.getState.scriptVersions` includes selectable version hashes.

```sh
npm test                     # official SDK initialize/list/call with mock HTTP authority
npm run test:integration     # plus real HTTP/WS; run Rust server first
npx playwright install chromium
npm run test:browser         # real MCP -> Chromium -> UI -> authority; UI must run on 5173
```

Browser tests run when explicitly enabled and require a Chromium installation. CI installs
Chromium and its system dependencies, then starts both services to run the browser
test. `Input.action` takes `{action:{type:...}}`; for example
`{"action":{"type":"chooseHair","hair":"midnight"}}`. Inspect `tools/list` for all
validated action variants. Screenshots are viewport-sized (1440×1000).

The server uses the official `@modelcontextprotocol/sdk` v1 maintenance line
(MCP through 2025-11-25), not a custom JSON-RPC implementation. SDK API references:
[official source](https://github.com/modelcontextprotocol/typescript-sdk/tree/v1.x).

Replay UI controls use `Input.action`: `openReplay`, `closeReplay`,
`playReplay`, `pauseReplay`, `seekReplay` (`operationIndex`: nonnegative integer),
`selectReplayTask` (`index`: zero-based queue position), and
`locateReplayTaskSource`. `Page.getState.replay` exposes the selected
`operationIndex`, `maxOperationIndex`, rendered `ruleState`, `memory`, and `tasks`;
it is `null` when the replay dialog is closed. Source navigation and seeking use
operation indexes, so resets with repeated ticks remain unambiguous.

### 纸娃娃工坊

通过已有 `Input.action` 控制真实检查台：`openWorkshop`、`returnToArena`；
`setWorkshopAction {action: idle|walk}`、`selectWorkshopDirection {direction: S|SW|W|NW|N|NE|E|SE}`；
`playWorkshop`、`pauseWorkshop`、`stepWorkshop`（必须先暂停）；
`setWorkshopFps {fps: 2|4|8|12}`、`setWorkshopOutfit {outfit: scholar|warden}`、
`setWorkshopHair {hair: ivory|midnight}`、`setWorkshopLayer {layer: outfit|hair|weapon, visible: boolean}`。
所有操作驱动可见控件；播放和暂停可重复调用。`Page.getState.workshop` 返回动作、方向、
从0开始的帧号、帧数、速度、播放状态、外观与图层显隐、加载状态和错误；离开工坊后为 null。
`Page.captureScreenshot` 可直接捕获当前工坊。原竞技场换装动作保持原用途。

真实 stdio 浏览器验证：`ARENA_BROWSER=1 node --test ../tests/workshop-browser.test.mjs`。

For a candidate: `ARENA_UI_URL=http://127.0.0.1:5175 ARENA_BASE_URL=http://127.0.0.1:8790 npm start`.

`Simulation.command` accepts `{type:"task",actorId,kind,target,buildingKind?}`;
kind is `gather`, `build`, `guard`, or `return`, target is the room ID, and build
requires `warehouse`, `tower`, or `catalog`. The authority enforces task rules.
`Input.action` accepts `{action:{type,...}}`.
Use `selectActor({role})`, then `assignTask({kind,target,buildingKind?})` to click
the visible task and destination controls. `startExpedition`, `pauseExpedition`,
`stepTraining`, and `retryExpedition` use the normal UI buttons. Retry is available
at settlement and keeps the seed. Training-only controls stay unavailable online.
`setRule` publishes through the visible rules editor, preserving arbitrary 0–100 thresholds. A select-only UI accepts only its listed thresholds. `Simulation.command` rule accepts optional `assignTasks`; true publishes the preset’s tasks, while the default false preserves manual tasks when adjusting thresholds.
`Page.getState.expedition` reads the visible objective, squad/tasks, selected actor
travel summary, available targets and settlement report. It never reads browser
session credentials. No tool accepts arbitrary JavaScript, shell or navigation.

Candidate integration check (keeps the existing 180-second browser budget):
`ARENA_EXPEDITION_BROWSER=1 ARENA_UI_URL=http://127.0.0.1:5176 ARENA_BASE_URL=http://127.0.0.1:8791 node --test ../tests/expedition-mcp-browser.test.mjs`.
This checks three tasks via UI, start/pause, travel and one UI step, then uses a
separate private Simulation handle for settlement and same-seed reset. It does
not claim to verify clicking the browser’s settlement retry button.

### 官方行为模块

沿既有 `Input.action` 点击/填写真实 AI 工作台：
- `openBehavior`：打开「行为模块」。
- `loadBehaviorTemplate {template: first-expedition|logistics}`：载入官方组合，保留 UI 的替换撤销历史。
- `setBehaviorModule {moduleId: retreat|haul|build|defend|gather, enabled?, priority?, roles?, config?}`：展开该卡片并操作参数。`roles` 为 gatherer/guard/scout 数组，空数组在 UI 表示全部岗位；`config` 支持 hpThreshold、minCargo、minMaterials、targetRoomId、roomId、buildingKind（catalog|tower），使用该模块真实存在的字段。采集/防守房间传空字符串选择「自动」。
- `undoBehaviorReplacement`：点击「撤销上次替换」。
- `openBehaviorSource {moduleId}`：打开该模块在同一工程的源码位置。

编译、试跑、发布仍用 `compileScript`、`previewScript`、`publishScript`。
`Page.getState.behavior` 返回当前卡片控件值、组合路径、明确试跑/已发布/回放来源的 trace 与完整 sourceHash（来自界面标题）、发布版本和撤销入口；未打开模块卡片时不会伪造隐藏工程参数。
工坊 `openWorkshop` 保持当前页面 origin，候选 `ARENA_UI_URL` 不会被切回默认5173。

真实 stdio 验证：`ARENA_BROWSER=1 ARENA_UI_URL=http://127.0.0.1:5181 ARENA_BASE_URL=http://127.0.0.1:8790 node --test ../tests/behavior-browser.test.mjs`。

### 规则图与中文目标

`openRuleGraph` 打开实际规则图页；`convertBehaviorToRuleGraph` 显式转换当前五卡，
`loadRuleGraphTemplate {template: logistics|retreat}` 载入界面示例。
`addRuleGraphObject {kind}` 支持 state、transition、role 和界面九种节点类型；
`selectRuleGraphObject {kind: nodes|states|transitions|roles|modules,id}` 选择对象树条目。
`setRuleGraphView {view: states|tree}` 切换画布；`selectRuleGraphTree {stateId}`
选择状态持续树（空字符串显示全部节点），节点选择保留当前树。
`copyRuleGraphSelection`、`deleteRuleGraphSelection`、`renameRuleGraphObject {id}`、
`undoRuleGraph`、`redoRuleGraph` 使用对应可见按钮。
`setRuleGraphField {label,value,index?}` 按参数区的准确 label 填值/选择/勾选；
`connectRuleGraph {port,target,index?}` 操作准确 label 的引用选择器（例如「满足时」、
「持续决策树入口」、「初始状态」），target 为空字符串即断开。
重复 label 用从0开始的 index 选择。`selectRuleGraphDiagnostic {index}` 选择诊断对象，
`locateRuleGraphSource` 定位所选对象的生成源码。

`Page.getState.graph` 的 `graph/selection/diagnostics/view/treeState` 直接读取可见编辑器
公开的渲染状态；`nodes/edges` 读取当前画布 DOM，`source/results/traces` 读取实际源码定位、
编译结果及有来源标签/哈希的轨迹。隐藏编辑器返回 visible:false，不从存储重建或计算图。
编译与 V8 试跑继续使用原 `compileScript` / `previewScript`。

中文目标操作：`proposeRuleGoals {text}`、`selectRuleGoalChange {changeId,selected}`、
`locateRuleGoalObject {changeId}`、`acceptRuleGoalChanges`、`rejectRuleGoalChanges`、
`undoRuleGoalChanges`。`Page.getState.goals` 返回可见目标文本、状态、差异及勾选状态和警告。
所有图与目标修改都经可见控件，与手动编辑共用同一草稿、撤销与编译路径。

真实 stdio 验证：`ARENA_BROWSER=1 node --test ../tests/rule-graph-browser.test.mjs`。

### 机动指挥

沿当前所选角色的可见“机动指挥”控件调用 `Input.action`：
`chooseMobility {kind: run|jump|climb}`、`setRunRoute {viaRoomId, roomId}`、
`selectMobilityEdge {edgeId}`、`confirmMobility`、`clearMobilityPreview`。
选择路线只预览；确认沿页面原有命令请求执行，脚本接管等禁用原因保留在可见控件中。
`Page.getState.mobility` 返回控件选项、当前选择、原因与确认禁用状态。
`mobilityAuthority` 读取地图当前权威 snapshot 的只读 DOM 投影，包含 tick、暂停、
simulation/map 版本、角色位置/高度/朝向/locomotion/Travel 与玩家脚本来源；
地图未挂载时为空数组。不从插值 pose 推断实际位置，也不添加操作索引。
图模板 `loadRuleGraphTemplate {template: "shortcut"}` 点击同一可见捷径支援图入口。

需要 sim7 UI/权威和 Chromium，定向验证三动作：
`ARENA_MOBILITY_BROWSER=1 ARENA_UI_URL=http://127.0.0.1:5191 ARENA_BASE_URL=http://127.0.0.1:8799 node --test ../tests/mobility-browser.test.mjs`。

### Named graph fragments (v0.6 composition)

Use `openRuleGraph` and `selectRuleGraphObject` to select a decision subtree,
then `openRuleGraphFragments` and `saveRuleGraphFragment { name }`.
`Page.getState.fragments` reads the actual visible library's `saved`, `selected`,
`bindings`, `targetStateId`, `ready`, `error`, binding controls and alerts.
`previewRuleGraphFragment { fragmentId }` opens its insertion preview;
`setRuleGraphFragmentTarget { stateId }`,
`bindRuleGraphFragmentRoom { fromRoomId, roomId }` and
`bindRuleGraphFragmentRole { fromRole, role }` operate the same labeled selects.
Only `confirmRuleGraphFragment` clicks the one insertion confirmation.
`cancelRuleGraphFragment` returns to the list; existing `undoRuleGraph` reverses
one confirmed insertion. Saving/previewing/binding never inserts a graph patch.
The adapter neither exports/imports graph objects itself nor writes React state.

The targeted stdio/UI scenario requires the actual v0.6 candidate UI and server:
`ARENA_FRAGMENTS_BROWSER=1 ARENA_UI_URL=http://127.0.0.1:5200 ARENA_BASE_URL=http://127.0.0.1:8801 node --test arena/tests/graph-fragments-browser.test.mjs`.
The three new module parameters continue through `setRuleGraphField` with the
UI's real field labels. Recording controls below read the actual recording-debug panel; the adapter
does not fabricate trace, coverage or next-hit results.

### Module catalog and independent/shared instances

`openRuleModuleCatalog` opens the visible eight-kind catalog.
`previewRuleModule { kind }` chooses `scout`, `patrol`, `escort`, `gather`,
`haul`, `build`, `defend` or `retreat`, without changing the graph.
For a five-card draft, `confirmRuleModuleConversion` explicitly accepts the
visible conversion preview before module editing; `cancelRuleModulePreview`
returns to the five cards or current composition without confirming.

Edit actual parameter controls with existing `setRuleGraphField`, using
`scope: "modulePreview"` for the insertion preview (default remains the selected
object inspector). Boolean fields use each real checkbox's checked state;
for new composition modules an empty set of execution roles means nobody.
`addRulePatrolStop` and `removeRulePatrolStop { index }` operate the visible
route buttons; indices start at zero. `setRuleModuleTarget { stateId }` picks
the insertion state, and `confirmRuleModule` clicks its single confirmation.

`previewSharedRuleModule { moduleId }` selects an existing instance in the
same catalog. Existing graph object selection opens an instance's references;
`selectRuleModuleCopyReference { nodeId, selected }` checks the explicit rebind
list and `copyRuleModuleInstance` confirms one independent copy. Original
`undoRuleGraph` reverses the patch. `Page.getState.composition` reads actual
catalog, conversion, preview and reference text/fields/options/checked values;
the graph itself remains `Page.getState.graph` from the original UI state.
The tool does not construct modules or resolve their runtime targets.

The targeted visible scenario uses `ARENA_COMPOSITION_BROWSER=1` with the
candidate UI/authority and `node --test arena/tests/composition-controls-browser.test.mjs`.

### Recorded breakpoints, coverage and same-operation comparison

`refreshRecording` loads the visible panel. Choose the actual archive and
filters with `selectRecordingVersion { sourceHash }`,
`selectRecordingActor { actorId }`, `selectRecordingObjectType { target }`,
`selectRecordingObject { objectId }` and `setRecordingHitKind { kind }`.
`setRecordingCursor { operationIndex }` accepts -1 for the panel's initial cursor.
`nextRecording` / `previousRecording` click the original query controls and open
the original replay. `Page.getState.replay.status` reports actual replay locating
status; `closeReplay` returns to the retained recording filters and facts.
`openRecordedSource` opens that record's archived read-only source.

`saveRecordingRange { name, fromOperation, toOperation }`,
`selectSavedRecording { index }` and `useFullRecordingRange` use the panel's
named inclusive ranges. `locateRecordingCoverage { objectId, column, total }`
clicks the exact visible coverage-cell button. `Page.getState.recording` reads
the panel's selected archive/actor/object/original cursor, native controls,
recorded fact, visible coverage cells and archived source location; it does not
compute counts or search visits itself.

`refreshRuleComparison`, `setRuleComparisonOperation { operationIndex }`,
`setRuleComparisonBaseline { sourceHash }` and `compareRuleOperation` reuse the
existing same-frame comparison. An empty baseline chooses the opening draft.
`Page.getState.comparison` reads the visible A/B hashes, facts and intent JSON.

The focused newcomer story is a real stdio driver, not a simulated trace:
`ARENA_UI_URL=http://localhost:5200 ARENA_BASE_URL=http://localhost:8801 ARENA_EVIDENCE_DIR=/fresh/nonexistent/evidence-dir node arena/tools/run-composition-story.mjs`.
Run only in the assigned browser slot against the integrated candidate. It creates
one training session, publishes a deliberately mistargeted escort with a base
patrol fallback, waits for actual gatherer cargo, queries the original recording,
compares a target fix at the same operation, then publishes and observes real
guard travel. It never steps training or sends commands outside visible controls.
Failures retain the partial report and screenshots in the new evidence directory.

### Player-authored modules and tactical controls

`createCustomModule` opens the visible author; `openCustomModuleLibrary` opens
「我的模块」. Use `setCustomModuleView {view: shape|source}` and
`setCustomModuleField {scope: author|upgrade|instance, label, value}` with the
exact labels returned by `Page.getState.customModules`. Add/remove schema rows
with `addCustomModuleField`, `addCustomModuleExit`,
`removeCustomModuleField {index}` and `removeCustomModuleExit {index}` (zero based).
`editCustomModuleSource {source}` pastes into the actual Monaco editor using the
same clipboard/keyboard path as script editing. `compileCustomModule` and
`saveCustomModule` click the original compile/save controls; their results remain
in the author readout. `returnCustomModuleLibrary` returns to saved definitions.

`useCustomModuleLibraryItem {operation: add|edit|remove, name, revisionPrefix}`
uses the exact visible module name and 12-character revision prefix. Adding uses
the existing `setRuleModuleTarget` / `confirmRuleModule` preview confirmation.
Select the new graph node and use existing `connectRuleGraph` with the visible
named port, e.g. `port: "货袋已满 · bagFull"`. Select the instance to use
`editCurrentCustomModule`, `selectCustomModuleVersion {revisionId}`,
`confirmCustomModuleUpgrade` or `cancelCustomModuleUpgrade`. Recording filters use
`selectRecordedCustomExit {exitKey}`, `locateCustomModuleCall` and
`locateCustomModuleBody` in the original recording panel. These controls retain
the original draft, version, undo and archived-source behavior.

`selectSessionScenario {scenarioId: first-expedition|seal-contest}` selects the
visible creation scenario. The existing `Session.create` API also accepts this
optional `scenarioId` for training and online sessions. `Simulation.command`
accepts `attack {actorId,targetId?}`, `repair {actorId,buildingId}`,
`claim {actorId,roomId}` and `cast {actorId,skillId:"ink-strike",targetId}`.
The authority applies scenario, ownership and skill rules.

For the sim8 tactical UI, use `chooseTacticalAction {kind: attack|repair|claim|cast}`,
`selectTacticalTarget {targetId}` and `confirmTacticalAction` to operate the
visible list and confirmation. `openTacticalDetails` expands its actual details;
`openTacticalAI` opens the active AI rules when that entry is shown.
`Page.getState.tactical` reads the visible choices, disabled state and status.
Tactical controls require the integrated sim8 UI/server; T0 authoring can be
verified independently on the authoring candidate:
`ARENA_CUSTOM_MODULE_BROWSER=1 ARENA_UI_URL=http://127.0.0.1:5202 ARENA_BASE_URL=http://127.0.0.1:8803 ARENA_EVIDENCE_DIR=/fresh/evidence node --test arena/tests/custom-module-browser.test.mjs`.
