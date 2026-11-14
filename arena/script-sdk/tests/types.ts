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
  void asynchronous;
  void skill;
}
void readonlyContract;
