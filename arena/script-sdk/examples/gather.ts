import type { RuleContext, RuleDecisionResult } from '../src/index.ts';
import { captureHere, decideSquad, moveToward, resourceTarget } from './shared.ts';

export function decide(ctx: RuleContext): RuleDecisionResult {
  return decideSquad(ctx, (ctx, actor, room) => {
    if (room.resources > 0) return { type: 'gather', actorId: actor.id, priority: 50 };
    const capture = captureHere(ctx, actor, room);
    if (capture) return capture;
    const target = actor.role === 'gatherer'
      ? resourceTarget(ctx, 'room-1')
      : ctx.world.rooms.find(candidate => candidate.id === (actor.role === 'scout' ? 'room-2' : 'room-3'));
    return target ? moveToward(ctx, actor, target) : undefined;
  });
}
