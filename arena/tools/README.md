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
