import type { ActionIntentDraft, ActorScriptView, RoomScriptView, RuleContext, RuleDecisionResult } from '../src/index.ts';

const distance = (a: RoomScriptView, b: RoomScriptView) =>
  (Math.abs(a.q - b.q) + Math.abs(a.r - b.r) + Math.abs(a.q + a.r - b.q - b.r)) / 2;

/** 疾跑赶路: adjacent targets walk; distance-two routes use the first roomId. */
export function travel(ctx: RuleContext, actor: ActorScriptView, roomId: string, priority: number): ActionIntentDraft | undefined {
  const from = ctx.world.rooms.find(room => room.id === actor.roomId);
  const to = ctx.world.rooms.find(room => room.id === roomId);
  if (!from || !to || from.id === to.id) return;
  if (distance(from, to) === 1) return { type: 'move', actorId: actor.id, roomId, priority };
  if (distance(from, to) !== 2) return;
  const via = ctx.world.rooms.filter(room => distance(from, room) === 1 && distance(room, to) === 1)
    .sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0)[0];
  if (via) return { type: 'run', actorId: actor.id, viaRoomId: via.id, roomId, priority };
}

export function decide(ctx: RuleContext): RuleDecisionResult {
  const intents: ActionIntentDraft[] = [];
  for (const actor of ctx.squad.actors) {
    if (actor.hp === 0) continue;
    const task = ctx.tasks.items.filter(task => task.actorId === actor.id && task.kind === 'move'
      && (task.status === 'queued' || task.status === 'running'))
      .sort((a, b) => b.priority - a.priority || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))[0];
    // Without a move plan, demonstrate travel toward the western resource room.
    const intent = travel(ctx, actor, task?.roomId ?? 'room-4', task?.priority ?? 40);
    if (intent) intents.push(intent);
  }
  return { intents: intents.sort((a, b) => b.priority - a.priority
    || (a.actorId < b.actorId ? -1 : a.actorId > b.actorId ? 1 : 0)).slice(0, ctx.limits.maxIntents) };
}
