# Behavior modules v1

`toRuleSourceProject(plan)` emits an ordinary RuleSourceProject for existing compile,
preview, publish and version history APIs. No additional execution service is used.
Modules run in descending priority, with array order breaking ties. The first
applicable module wins per actor. Travel and completed actors hold without intents.
`memoryPatch.set.aiTrace` records module ID, visited modules, reason and tick.
Pair that trace with the authority sourceHash and `getModuleSourceRef` to inspect
the exact published configuration. Task patches remain optional plans; intents drive actions.

`recoverBehaviorPlan` permits editing only when every source file matches a fresh
generation byte for byte. Manual changes return null and remain preserved.

Run `npm ci --prefix arena/script-toolchain` and
`node --test arena/behavior-modules/behavior.test.mjs`.
Set `ARENA_MODULE_TEST_URL=http://127.0.0.1:8790` to also exercise the existing
production compiler, independent V8 worker, publish and tick routes in a fresh
training session. The same unit suite is included by script-toolchain tests.

`createFirstExpeditionPlan()` supplies the seed-42 expedition template: gatherers
collect room-1 and deliver eight-unit loads; guards defend room-3; scouts build a
catalog after 25 materials are stored and then defend it. Defend uses the existing
capture intent to establish an authority guard task, whose pursuit moves toward
enemies. It sends attacks only within scenario range and cooldown, then holds the
guard task to catalog the room. All actors retreat at 20 HP.

The optional authority test checks actual guardian damage, material deposits,
construction progress and scout cataloging. At seed 42 it completed at tick 233
with both guardians defeated and a successful expedition result.
