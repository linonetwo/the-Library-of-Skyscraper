import type { RuleContext, RuleDecisionResult } from '../src/index.ts';
import { decide as gather } from './gather.ts';

/** Persist a version-local counter and report the actions our squad is planning. */
export function decide(ctx: RuleContext): RuleDecisionResult {
  const { intents } = gather(ctx);
  const previous = ctx.memory.ticks;
  return {
    intents,
    memoryPatch: { set: { ticks: typeof previous === 'number' ? previous + 1 : 1 } },
    taskPatches: [
      ...ctx.tasks.items.filter(task => !intents.some(intent => task.id === 'plan-' + intent.actorId))
        .map(task => ({ type: 'remove' as const, taskId: task.id })),
      ...intents.map(intent => ({
        type: 'upsert' as const,
        task: {
          id: 'plan-' + intent.actorId,
          actorId: intent.actorId,
          roomId: 'roomId' in intent ? intent.roomId : ctx.squad.actors.find(actor => actor.id === intent.actorId)!.roomId,
          kind: intent.type === 'run' ? 'move' : intent.type,
          priority: intent.priority,
          status: 'running' as const,
          blockedReason: null,
        },
      })),
    ].slice(0, ctx.limits.maxTaskPatches),
  };
}
