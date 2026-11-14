# Arena MCP (stdio)

Requires Node 22+ and the Rust authority on `127.0.0.1:8787`.

```sh
cd arena/tools
npm ci
npm start
```

Configure an MCP client with command `node` and absolute argument
`/path/to/the-Library-of-Skyscraper/arena/tools/server.mjs`.
Optional `ARENA_BASE_URL` accepts a plain HTTP loopback origin only. Redirects are
disabled. Standard output is reserved for official SDK protocol messages.

Eighteen tools expose CDP-style domains: `Session.create`, `Session.join`,
`Session.getState`, `Simulation.command`, `Simulation.pause`, `Simulation.step`,
`Simulation.reset`, `Script.compile`, `Script.preview`, `Script.publish`,
`Script.disable`, `Replay.getEvents`, `Replay.export`, `Page.open`, `Page.getState`,
`Page.captureScreenshot`, `Page.close`, `Input.action`. Create/join returns a local handle, session
ID and player ID. Credentials are held in process memory,
and are lost on MCP restart. Reuse a handle after transient connection failure;
joining again creates another player. All commands pass through the authority.
Training sessions provide pause/step/reset. `Replay.getEvents` reads recent
events; `Replay.export` downloads the complete command recording.

`Script.compile/preview/publish` accept `{handle, files, entry?}`, where `files`
maps project-relative paths to TypeScript source and `entry` defaults to
`main.ts`. Compile returns diagnostics and a bundle; preview returns decisions
against a snapshot. Publish binds the compiled version to the handle's player,
so subsequent authority ticks apply its decisions. An empty `intents` array
holds position. `Script.disable({handle})` resumes the player's action preset.
`Session.getState` includes the published version hash in `Player.script`.

Browser control is optional and isolated from simulation handles. It launches
headless Chromium at `http://127.0.0.1:5173`. It supports
training/lobby navigation, selecting actors/rooms, outfits/hair/staff, rules,
map zoom and player commands. `Page.getState` reads rendered body text and visible
button labels. `Page.captureScreenshot` returns PNG image content directly via
MCP. `Page.close` releases the browser context.

The browser action chain `openScripts` → `loadScriptTemplate` →
`editScript` → `publishScript` edits and publishes through Monaco's visible UI;
`disableScript` restores the action preset. Templates are `recall`, `gather`,
`defend`, and `explore`. `editScript` accepts `source` and uses clipboard paste
to preserve multiline source exactly, then waits for the local draft update.
For example: `{"action":{"type":"loadScriptTemplate","template":"gather"}}`.

```sh
npm test                     # official SDK initialize/list/call with mock HTTP authority
npm run test:integration     # plus real HTTP/WS; run Rust server first
npx playwright install chromium
npm run test:browser         # real MCP -> Chromium -> UI -> authority; UI must run on 5173
```

Browser tests explicitly skip when not enabled or Chromium is absent. CI installs
Chromium and its system dependencies, then starts both services to run the browser
test. `Input.action` takes `{action:{type:...}}`; for example
`{"action":{"type":"chooseHair","hair":"midnight"}}`. Inspect `tools/list` for all
validated action variants. Screenshots are viewport-sized (1440×1000).

The server uses the official `@modelcontextprotocol/sdk` v1 maintenance line
(MCP through 2025-11-25), not a custom JSON-RPC implementation. SDK API references:
[official source](https://github.com/modelcontextprotocol/typescript-sdk/tree/v1.x).
