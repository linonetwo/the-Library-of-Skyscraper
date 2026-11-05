import type { RuleContext, RuleDecisionResult } from '../src/index.ts';
import { decideSquad, moveToward } from './shared.ts';

export function decide(ctx: RuleContext): RuleDecisionResult {
  return decideSquad(ctx, (ctx, actor) => {
    const base = ctx.world.rooms.find(room => room.kind === 'base')!;
    return moveToward(ctx, actor, base);
  });
}
