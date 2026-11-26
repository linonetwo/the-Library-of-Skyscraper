# v0.5.0 development preview

Explore squad expeditions, edit their AI, and try three map mobility actions.
This development preview features four-head anime paper-doll characters on a
hand-painted 2:1 isometric map.

## Start playing

Use Linux x64, Node.js 24, `setsid` (util-linux), and a WebGL-capable browser.
Extract the package and run `./start.sh`.

- Game: http://127.0.0.1:5173/
- AI modules: http://127.0.0.1:5173/?view=rules, also available through **AI 模块编辑**.
- Default web / authority ports: **5173 / 8787**.

Set `ARENA_WEB_PORT`, `ARENA_PORT`, or `ARENA_BIND_ADDR` to choose listeners.
`ARENA_PROXY_TARGET` selects the authority; by default the web proxy follows
`ARENA_PORT`. Forward the web port for remote play. The package keeps its own
saves in `data/` and authority logs in `logs/authority.log`. Ctrl-C stops it.

## Move, equip and program

Select a character and open **机动指挥** to preview and confirm a route:

- **疾跑** crosses two connected ordinary roads through a chosen room.
- **跃桥** takes the registered room1–room2 gap.
- **攀梯** follows the room4–room3 elevated corridor in either direction.

The map's overview and locate controls help follow your squad. Movement and
work share the authoritative 500ms clock. Equip **星墨学者 / 书库守卫** outfits,
**月白 / 墨蓝** hair, and an empty hand or staff through the paper-doll controls.

The AI workbench offers five behavior modules, rule graphs and TypeScript.
Preview a decision against the current snapshot, edit it, and publish it to
your expedition. Version history, owner-scoped memory and tasks, replay,
same-input A/B comparison, and visible MCP controls support further iteration.
Graphs and TypeScript use the packaged `@skyscraper/arena-script-sdk` **0.0.3**
and the same server commands as map controls.

New expeditions use **simulationVersion7** and **library-v5.0**. Existing saves
and replays keep their recorded simulation behavior, including versions ≤6.
The included README covers server connections and MCP setup; `manifest.json`
records the exact source, modules and shipped resources.
