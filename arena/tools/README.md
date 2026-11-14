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

Thirteen tools expose narrow, CDP-style domains: `Session.create`, `Session.join`,
`Session.getState`, `Simulation.command`, `Simulation.pause`, `Simulation.step`,
`Simulation.reset`, `Replay.getEvents`, `Page.open`, `Page.getState`,
`Page.captureScreenshot`, `Page.close`, `Input.action`. Create/join returns a local handle, session
ID and player ID, never the bearer token. Credentials are held in process memory,
and are lost on MCP restart. Reuse a handle after transient connection failure;
joining again creates another player. All commands pass through the authority.
Online pause/step/reset are forbidden. Diagnostic events are a bounded ring, not
an archival replay. No arbitrary evaluation, shell, filesystem, or remote fetch.

Browser control is optional and isolated from simulation handles. It launches
headless Chromium at the fixed `http://127.0.0.1:5173` UI, with HTTP/WebSocket
requests limited to the local UI and authority ports. It supports whitelisted
training/lobby navigation, selecting actors/rooms, outfits/hair/staff, rules,
map zoom and player commands. `Page.getState` reads rendered body text and visible
button labels only; it never reads browser storage or network credentials.
`Page.captureScreenshot` returns PNG image content directly via MCP, with no
caller-controlled file path. `Page.close` discards the temporary browser context.
There is no arbitrary selector or script tool.

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
