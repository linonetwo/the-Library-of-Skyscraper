# Arena protocol v1

Local authority: `http://127.0.0.1:8787`, fixed tick 500 ms, integer deterministic simulation.
In-memory prototype: restarting loses sessions. Each online session supports four players;
training sessions are private. No arbitrary scripts or code evaluation.

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
Snapshots are diagnostic state, **not a complete replay stream**; persistent replay remains planned.
Online rooms are casual integration-test rooms, not ranked/fair competitive matches:
there is no ready lobby, the clock starts immediately, and late joiners have less time.
