import type { ActionRuleModule, RuleContext, ActionIntentDraft } from '../src/index.ts';
import * as gather from '../examples/gather.ts';
import * as defend from '../examples/defend.ts';
import * as explore from '../examples/explore.ts';

const officialRules: readonly ActionRuleModule[] = [gather, defend, explore];
void officialRules;

function readonlyContract(ctx: RuleContext): void {
  // @ts-expect-error Snapshot fields are read-only.
  ctx.player.materials = 0;
  // @ts-expect-error Snapshot collections are read-only.
  ctx.squad.actors.push({});
  // @ts-expect-error Nested strategy memory is read-only.
  ctx.memory.target = 'room-1';
  // @ts-expect-error Asynchronous entry points are outside the v0 contract.
  const asynchronous: ActionRuleModule = { async decide() { return { intents: [] }; } };
  // @ts-expect-error Skill intents are reserved for a future contract revision.
  const skill: ActionIntentDraft = { type: 'castSkill', actorId: 'p1-scout', priority: 1 };
  // @ts-expect-error Segment metadata is a read-only authority view.
  ctx.squad.actors[0]!.travel!.segments![0]!.to.z = 42;
  // @ts-expect-error Mobility edges are read-only authority topology.
  ctx.world.worldMap!.mobilityEdges![0]!.segments.push({});
  const run: ActionIntentDraft = { type: 'run', actorId: 'p1-scout', viaRoomId: 'room-0', roomId: 'room-3', priority: 1 };
  const jump: ActionIntentDraft = { type: 'jump', actorId: 'p1-scout', edgeId: 'jump-room-1-room-2', priority: 1 };
  const climb: ActionIntentDraft = { type: 'climb', actorId: 'p1-scout', edgeId: 'climb-room-4-room-3', priority: 1 };
  // @ts-expect-error Run requires the actual via room.
  const missingVia: ActionIntentDraft = { type: 'run', actorId: 'a', roomId: 'room-3', priority: 1 };
  void run; void jump; void climb; void missingVia;
  void asynchronous;
  void skill;
}
void readonlyContract;
