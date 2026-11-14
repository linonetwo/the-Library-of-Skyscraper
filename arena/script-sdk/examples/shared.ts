import type {
  ActionIntentDraft, ActorScriptView, RoomScriptView, RuleContext, RuleDecisionResult,
} from '../src/index.ts';

export type ActorStrategy = (
  ctx: RuleContext, actor: ActorScriptView, room: RoomScriptView,
) => ActionIntentDraft | undefined;

export function moveToward(
  ctx: RuleContext, actor: ActorScriptView, target: RoomScriptView, priority = 40,
): ActionIntentDraft | undefined {
  if (actor.roomId === target.id) return;
  const base = ctx.world.rooms.find(room => room.kind === 'base')!;
  // v0 uses the same central-hub routing as the authority's autonomous turns.
  return { type: 'move', actorId: actor.id, roomId: actor.roomId === base.id ? target.id : base.id, priority };
}

export function resourceTarget(ctx: RuleContext, preferredId: string): RoomScriptView | undefined {
  const resources = ctx.world.rooms.filter(room => room.kind === 'resource' && room.resources > 0);
  return resources.find(room => room.id === preferredId)
    ?? [...resources].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0)[0]
    ?? ctx.world.rooms.find(room => room.kind === 'base');
}

export function captureHere(ctx: RuleContext, actor: ActorScriptView, room: RoomScriptView): ActionIntentDraft | undefined {
  if ((room.kind === 'catalog' || room.kind === 'ruins') && room.owner !== ctx.player.id
    && !ctx.world.actors.some(other => other.roomId === room.id && other.hp > 0 && other.owner !== ctx.player.id)) {
    return { type: 'capture', actorId: actor.id, priority: 60 };
  }
}

export function decideSquad(ctx: RuleContext, strategy: ActorStrategy): RuleDecisionResult {
  const intents: ActionIntentDraft[] = [];
  const base = ctx.world.rooms.find(room => room.kind === 'base')!;
  for (const actor of ctx.squad.actors) {
    if (actor.hp === 0) continue;
    const room = ctx.world.rooms.find(room => room.id === actor.roomId)!;
    let intent: ActionIntentDraft | undefined;
    if (actor.cargo > 0 && room.id === base.id) {
      intent = { type: 'deliver', actorId: actor.id, priority: 90 };
    } else if (actor.hp <= ctx.player.rule.retreatHp) {
      intent = moveToward(ctx, actor, base, 100);
    } else if (actor.cargo > 0 && (actor.cargo === actor.cargoCapacity
      || room.kind === 'resource' && room.resources === 0)) {
      intent = moveToward(ctx, actor, base, 80);
    } else if (room.enemyHp > 0) {
      intent = { type: 'attack', actorId: actor.id, priority: 70 };
    } else {
      intent = strategy(ctx, actor, room);
    }
    if (intent) intents.push(intent);
  }
  intents.sort((a, b) => b.priority - a.priority
    || (a.actorId < b.actorId ? -1 : a.actorId > b.actorId ? 1 : 0));
  return { intents: intents.slice(0, ctx.limits.maxIntents) };
}
