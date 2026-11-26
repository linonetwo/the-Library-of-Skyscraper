# sim8 tactical interface — T1a

This slice freezes typed authority data and examples. It does not enable sim8, add a second command processor, or claim live tactical effects. The domain slices below extend the existing `Command`, session creation, checkpoint and operation replay together before new games switch to sim8. Existing sessions/replays ≤7 retain their original serialized fields and algorithms.

## Creation and targets

`POST /api/sessions` gains optional `scenarioId: "first-expedition" | "seal-contest"`; omission selects first-expedition. `mode` remains training/online. The original credentials response is unchanged. The snapshot and replay header carry `scenarioId` for sim8; old recordings omit it. Reset keeps the selected scenario. Seal contest reuses the registered `world-map-v5.json` floor/roads and adds the facts in `arena/shared/seal-contest-v1.json`; no old geometry is edited.

The exact future command JSON is in `tests/fixtures/tactics-wire.json`:

```json
{"type":"attack","actorId":"p1-guard","targetId":"drill-guardian-b"}
{"type":"repair","actorId":"p1-scout","buildingId":"p1-drill-warehouse"}
{"type":"claim","actorId":"p1-guard","roomId":"room-2"}
{"type":"cast","actorId":"p1-guard","skillId":"ink-strike","targetId":"drill-guardian-b"}
```

Attack without targetId retains ordinary attack. Capture retains the guard behavior. New targeted actions require sim8. Actors are token-owner scoped, attack/cast targets are live authorized PVE enemies, repair targets are that owner's completed buildings, and claim targets are registered non-base rooms. Enemy/building/room identity comes from existing snapshot objects; the command carries the resolved exact ID, not a client selection query.

SDK refs are owned by Core and are not a second Rust target parser. Proposed names to freeze with Core: `{type:"enemy",enemyId}` or `{type:"enemyInRoom",roomId,select:"lowestHp"}`; `{type:"ownBuilding",buildingId}` or `{type:"ownBuildingInRoom",roomId,select:"mostDamaged"}`; `{type:"controlPoint",roomId}`. Equal candidates sort by ID. Resolved IDs and observed values enter the actual intent/trace; Rust evaluates the current object.

## Single authority state and public view

`TacticalState` lives in one private checkpoint field. The existing Room.owner, Player.score and Appearance.weapon remain the writable ownership/score/weapon sources. Actor IDs key independent state; public `snapshot.tactics.actorStates` is a read-only projection. Public point state gives roomId, challengerId, progressTicks, requiredTicks, contested and current blockedReason; ownership is read from Room.owner.

The public fixture contains actual wire examples only; its ticks and HP values are illustrative data, not runtime evidence. `snapshot.tactics` is omitted for ≤7. Cast state locks skillId, targetId, start/release/end ticks and sourceHash in private authority state; cooldown persists in actor castReadyTick. Private invocation records will use Core's separately frozen worker-result contract. They are not accepted as browser or ordinary ScriptAction proof fields and are not exposed in public snapshots/events.

Tick-derived phases (one existing 500ms clock):

| State | Authoritative ticks | Public phase |
|---|---|---|
| Ink strike | N, N+1 | chanting |
| Release and first recovery sample | N+2 | release |
| Remaining recovery | N+3 | recovery |
| Actionable again | N+4; next cast ≥N+8 | no active cast |
| Nonlethal heavy hit | H, H+1 | downed |
| Rising | H+2, H+3 | rising |
| Actionable again | H+4 | no recovery |

`endsTick` is exclusive. Both phase samples derive from saved boundaries. Public weapon maps existing appearance.weapon to staff/unarmed; changing clothes/hair does not change authority timelines. The two-tick death cue remains separate from nonlethal recovery and cannot revive HP0.

## Results and the existing recording

The existing Event gains an optional typed tactical result in the integration slice: action, actorId, exact targetId, phase, reasonCode and material/HP/energy/control before/after values. No private file or sourceHash appears there. The original operation owns that event; there is no independent tactical event log or clock.

Unauthorized or malformed input uses the existing Err path without public state changes. Authorized, well-formed commands whose world judgment fails (target-gone, insufficient-materials, etc.) produce a structured domain result and typed event and are recorded through the same Command operation, so replay evaluates the same original command. Script rejection uses the existing owner script-rejected path once, without double counting. HTTP keeps the existing returned Snapshot, whose events carry the result.

Command ordering remains recorded order, automatic actor ordering remains ID order. Targets/last material/last HP resolve against the state after preceding actors. Full T1b regressions test those real changes and replay rather than only schema decoding.

## Ownership and implementation slices

- WorkSol: `arena/server/**`, `arena/shared/seal-contest-v1.json` and any necessary new tactical map data. T1a is `src/tactics/{state,view}.rs`, DTO fixture and this interface note. T1b adds small attack/repair/claim domains, session/scenario selection and replay/checkpoint integration; then skill/recovery phases and ordering after Core's invocation boundary freezes. `commands.rs` dispatches; it does not become the domain implementation.
- CoreSol: SDK/shared TS refs, four graph modules, bounded visits, compiler/V8 skill invocation records. Coordinate Rust adapter edits with WorkSol before touching server files. No ordinary user-supplied proof can authorize a cast.
- UISol: current command UI/workbench/render consumers, using these wire facts. No client HP/cost/claim/phase simulation.

T1a has format/JSON checks only until root provides Cargo space. The DTO serde fixture is a schema regression, not combat/claim/skill evidence. Full world tests and normal-clock fixed-package verification follow the domain slices.
