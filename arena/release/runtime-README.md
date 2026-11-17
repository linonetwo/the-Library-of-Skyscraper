# Arena v{{version}} local Linux candidate

Game source: {{sourceCommit}}. The package manifest records the game source and packaging recipe commits.

## Run

Use Linux x86_64, Node.js 24 and a WebGL browser. The package includes debug Rust authority and V8 runner binaries, the production frontend, compiler, SDK and runtime Node dependencies.

With local ports 5173 and 8787 available, run `./start.sh` and open http://127.0.0.1:5173/ or http://127.0.0.1:5173/animation-lab. The frontend serves the production dist and proxies `/api` and `/ws` to the package-local authority. Ctrl-C stops the preview and authority.

The launcher selects the package's runner, TS compiler and independent `data/` directory. The directory starts empty; subsequent checkpoints stay here. Authority output goes to `logs/authority.log`.

## MCP

Configure a stdio MCP client with `node arena/tools/server.mjs`. Browser controls use Playwright Chromium; install it through `cd arena/tools && npx playwright install --with-deps chromium`. Page.open and Input.action drive the game; Page.captureScreenshot returns actual PNG output.

TS publication and restoration, version memory and shared tasks, replay timelines and paper-doll workshop controls are available. `manifest.json` records the environment and profile; `FILES.sha256` lists payload hashes. The build output's `evidence/` directory holds build and acceptance records. Version tags and hosted releases follow the version delivery plan.
