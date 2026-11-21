# Arena protocol v1

Local authority: `http://127.0.0.1:8787`, fixed tick 500 ms, integer deterministic simulation.
The Rust authority serves HTTP commands and WebSocket snapshots, persists checkpoints,
and restores sessions after restart. Online sessions support four players; training sessions
are private. TypeScript rules run through the independent V8 runner, and appearance changes
are synchronized and recorded. See [server runtime](server/README.md),
[rule SDK](script-sdk/README.md) and [runner](script-runner/README.md).

## Session and authorization

- `GET /health`: `{ok:true,protocol:"arena.v1",tickMillis:500}`.
- `POST /api/sessions` JSON `{mode:"training"|"online",seed?:u64}` returns `{sessionId,playerId,token}`.
- `POST /api/sessions/:id/join` returns a **new** player's credentials (online only).
- `GET /api/sessions/:id/state`: snapshot, requires `Authorization: Bearer <token>`.
- `POST /api/sessions/:id/commands`: command below, same bearer authentication, returns snapshot.
- `WS /ws/:id?token=<token>`: snapshot immediately and every 500 ms. Commands use HTTP.

Errors use HTTP 400/401/403/404 with `{error:string}`; malformed JSON is rejected by Axum.
Credentials are opaque random UUIDs. Session IDs are not authentication tokens. Never log tokens.
Browser Origin is checked on every route including WebSocket upgrades: only HTTP
localhost/127.0.0.1 on ports 5173, 4173 and 8787 are allowed. Origin-less CLI/MCP
requests are supported. CORS allows only those origins, GET/POST/OPTIONS and
Authorization/Content-Type headers. Host must also be localhost/127.0.0.1 on one
of those ports to prevent DNS rebinding.

## Commands

```ts
type Command =
 | {type:"move";actorId:string;roomId:string}
 | {type:"gather";actorId:string}
 | {type:"attack";actorId:string}
 | {type:"capture";actorId:string}
 | {type:"build";roomId:string;kind:"tower"|"catalog"}
 | {type:"rule";preset:"gather"|"defend"|"explore";retreatHp:number}
 | {type:"pause";paused:boolean}
 | {type:"step";ticks:number}
 | {type:"reset"};
```

`retreatHp` is integer 0..100; `ticks` integer 1..120. Pause/step/reset are training-only.
Step requires paused state; reset preserves credentials and seed and pauses simulation.
Movement is one adjacent hex edge. Building costs 25 materials, requires a living owned
actor in the room, no hostiles, and no duplicate building kind. Actor commands validate ownership.
Each actor accepts at most one successful manual command per tick (including movement).
That command replaces the actor's next autonomous turn rather than granting an extra action.
Towers restore 3 HP/tick to friendly occupants; catalog buildings award 1 point per 5 ticks.
Rooms containing living actors from another squad cannot be captured, and hostile
occupancy suspends existing room-control income. PVE defeat rewards are split evenly
among living squads in the room, discarding any remainder (no last-hit reward bias).
The parameterized rule controls autonomous actions every tick. Settled sessions reject all
commands except training reset.

## Snapshot

```ts
interface Snapshot {
 sessionId:string; mode:"training"|"online"; seed:number; tick:number;
 paused:boolean; phase:"running"|"settled";
 rooms: {id:string;q:number;r:number;name:string;
   kind:"base"|"resource"|"catalog"|"ruins";resources:number;enemyHp:number;owner:string|null}[];
 players: {id:string;name:string;materials:number;score:number;
   rule:{preset:"gather"|"defend"|"explore";retreatHp:number}}[];
 actors: {id:string;owner:string;role:"scout"|"gatherer"|"guard";roomId:string;
   hp:number;maxHp:number;state:string}[];
 buildings: {id:string;owner:string;roomId:string;kind:"tower"|"catalog"}[];
 events: {id:number;tick:number;kind:string;message:string;playerId:string|null}[];
 result:null|{winner:string;reason:string};
}
```

Player IDs `p1`…`p4`; actor IDs `p1-scout`, `p1-gatherer`, `p1-guard`.
Rooms `room-0`…`room-6`, axial coordinates `(0,0),(1,0),(0,1),(-1,1),(-1,0),(0,-1),(1,-1)`.
Event IDs increase within each run and only the latest 100 are retained. State is shared
between authenticated session participants; fog-of-war is not implemented. Sessions settle
after 120 ticks, winner highest catalog score, player ID breaks ties.
Snapshots describe current state; the authenticated replay routes below export recorded
operations and reconstruct the timeline.
Online rooms are casual integration-test rooms, not ranked/fair competitive matches:
there is no ready lobby, the clock starts immediately, and late joiners have less time.
# Gameplay additions

Actors expose `cargo` and `cargoCapacity`. Gathering fills carried cargo;
automatic hauling returns it to `room-0`, and unloading credits player materials.
`{type:"deliver",actorId}` unloads at the base. Actor states include
`transporting` and `delivering`.

Authenticated `GET /api/sessions/:id/replay` exports a command recording.
`GET /api/sessions/:id/replay/timeline` returns
`{sessionId,frames:[{operationIndex,tick,snapshot}]}`. Index 0 is the initial
world; operation indices increase through resets while tick follows the replayed
world clock. Playback owns a separate reconstructed session.

## First library expedition (simulationVersion 4)

New sessions use `simulationVersion:4`, `mapVersion` from `shared/world-map.json`, and
`tickDurationMs:500`. Training starts paused; `pause:false` starts the clock,
`reset` retries the same seed in preparation. Victory locks simulation at 60
catalogue progress with a survivor; 960 ticks or squad elimination loses.

The authority embeds `shared/world-map.json` as `snapshot.worldMap` (room
centers and road polylines) and `shared/first-expedition.json` as
`scenarioConfig`. Positions use ground tiles. Actors expose `worldPosition`,
`travel`, `task`, `retreating`, and `actionTick`. Travel advances 750 thousandths
of a tile each tick; the path includes legal role work slots. `roomId` stays at
the departure room until arrival, and travelling actors cannot interact.
`travel` contains `travelId,targetRoomId,path,segment,distanceMilli,
totalDistanceMilli,startedTick,speedMilliPerTick,progress`. Midroute changes are
rejected explicitly; low HP takes precedence and reroutes at the next path node.

Assign a persistent player task:

```json
{"type":"task","actorId":"p1-gatherer","kind":"gather","target":"room-1"}
{"type":"task","actorId":"p1-guard","kind":"guard","target":"room-3"}
{"type":"task","actorId":"p1-scout","kind":"build","target":"room-3","buildingKind":"catalog"}
```

Kinds are `gather|guard|build|return`; build requires
`warehouse|tower|catalog`. Actor task state contains
`kind,target,stage,stageStartedTick,blockedReason,buildingKind`; completed construction is a
successful `completed` stage. Scripts and manual tasks cannot drive an actor
simultaneously: manual tactical commands explicitly require disabling a
published script; publishing clears manual tasks. Script move intents use the
same travel integrator and repeated destinations preserve progress. An empty
script decision does not fire automatic player attacks.

`enemies` expose HP, world position and travel. Buildings expose HP and
`constructionTicks/requiredTicks`. `scenario` exposes `catalogProgress`,
`counterattackTick`, `counterattackSpawned`, `remainingTicks`, `blockedReason`,
and `report` with `materialsDelivered/materialsSpent/cargoLost/downed/catalogTicks`.
A single warning at progress 30 schedules the counterattack 20 ticks later.
Checkpoint and replay restore this state without respawning it. Replay exports
include `simulationVersion/mapVersion`; recordings without these fields retain
the historical v0.2 simulation and its time semantics. Missing old checkpoint
actor positions migrate to their room center.

Buildings now expose authoritative `worldPosition`, generated by the shared
map's `buildOffsets` for their room/kind. Construction requires an active
builder within 2 tiles; tower range and guardian approach/damage use this exact
point. Missing v3 save positions migrate to that anchor. Layout versions come
from the shared map so client geometry caches rebuild.

Actors and enemies expose nullable `actionCue` and `impactCue`, each
`{kind,startedTick,durationTicks,targetPosition}`. Real gather/delivery/attack
write active `gather|deliver|attack` cues. Damage writes `hit|down` to impactCue,
without replacing an attack in the same tick. Multiple hits preserve the first
source/tick; a lethal hit upgrades to terminal `down` (duration 0). HP=0 takes
presentation priority. Active cue ties use attack > deliver > work. Effective
cue interval is `[startedTick, startedTick+durationTicks)`; down holds its last
pose. Continuous build/catalog work uses the actual task stage rather than a
second cue. `approaching`/`blocked` stages do not imply active construction.
`cataloging` means a guard or completed catalog-builder actually participates in
clear, completed, live, owned objective-room work; travel, retreat, hostiles or
a destroyed station stop this stage. Stages commit after all tick outcomes.

`motionDistanceMilli` accumulates actual road segment and room approach distance
in thousandths of a ground tile; bends count each segment. `lastMoveDirection`
keeps the last nonzero world displacement vector (not necessarily normalized),
including after long idle periods. `task.stageStartedTick` changes only when the
committed task stage changes or a different task starts; repeated work/intents
retain its anchor. These facts persist in checkpoints and replay snapshots, so
random seek needs no scan of earlier frames.

Simulation version 4 introduces these presentation facts; product version is
still v0.3. Old checkpoints keep their simulation version. Version 3 replay uses
its original single-cue overwrite behavior and leaves new facts at defaults:
`impactCue:null`, `motionDistanceMilli:0`, `lastMoveDirection:{x:1,y:1}`,
`stageStartedTick:0`. Historical v0.2 exports no new cues. Consumers of old v3
snapshots may display `actionCue.hit/down` as impact; the authority preserves the
recorded facts for strict replay comparison rather than silently upgrading.
Replay comparison permits decorative `worldMap.props`/version refresh only when
all other map fields (room geometry, roads and build anchors) match; actor,
combat, task and scenario state remain strict.

`rule` accepts optional `assignTasks` (default false). Publishing a preset with
`assignTasks:true` disables TS and generates the configured role tasks from
`scenarioConfig.presetTasks` (gather/defend/explore). Updating a retreat threshold
without this flag preserves the current tasks, in-flight travel and TS source.
Disabling TS restores the current preset as actual tasks. Generated tasks use
the same travel/economy/construction implementation as manual tasks. Warehouse
delivery requires a completed owned warehouse within 1.5 world tiles, and
records its actual world position in the delivery cue.

`deliver` queues the actor's `pendingDelivery` interaction. It never advances
position during command handling: room approach and deposit execute on authority
ticks, so repeated HTTP/TS delivery commands cannot exceed movement speed.
`lastMovedTick` enforces one movement budget across road arrival and room
approach (including builder, guard and warehouse work). Script actors can thus
move to a warehouse room and issue `deliver` without a world-move API.
