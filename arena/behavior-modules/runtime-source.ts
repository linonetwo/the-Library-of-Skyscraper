/** Embedded source goes through the same strict compiler and V8 as handwritten rules. */
export const runtimeSource = `import type { ActionIntentDraft, ActorScriptView, RoomScriptView, RuleContext, RuleDecisionResult } from '@skyscraper/arena-script-sdk';
import { plan } from './ai-plan';
function move(ctx: RuleContext, actor: ActorScriptView, room: RoomScriptView, priority: number): ActionIntentDraft | undefined {
  if (actor.roomId === room.id) return;
  const queue = [{id:actor.roomId, first:''}];
  const visited = new Set([actor.roomId]);
  for (const node of queue) {
    const from = ctx.world.rooms.find(r=>r.id===node.id)!;
    for (const next of ctx.world.rooms) {
      const distance=(Math.abs(from.q-next.q)+Math.abs(from.r-next.r)+Math.abs(from.q+from.r-next.q-next.r))/2;
      if (distance!==1 || visited.has(next.id)) continue;
      const first=node.first || next.id;
      if (next.id===room.id) return {type:'move',actorId:actor.id,roomId:first,priority};
      visited.add(next.id); queue.push({id:next.id,first});
    }
  }
}
export function decide(ctx: RuleContext): RuleDecisionResult {
  const intents: ActionIntentDraft[] = [];
  const actors: {actorId:string;moduleId:string;visited:string[];reason:string}[] = [];
  const modules = plan.modules.map((module, index) => ({module,index})).sort((a,b) => b.module.priority-a.module.priority || a.index-b.index);
  for (const actor of ctx.squad.actors) {
    const trace = {actorId:actor.id,moduleId:'hold',visited:[] as string[],reason:'no applicable module'};
    actors.push(trace);
    if (actor.hp <= 0) { trace.reason='actor downed'; continue; }
    if (actor.travel) { trace.reason='travel in progress'; continue; }
    const room = ctx.world.rooms.find(r => r.id === actor.roomId);
    const base = ctx.world.rooms.find(r => r.kind === 'base');
    if (!room) { trace.reason='room unavailable'; continue; }
    for (const {module:m} of modules) {
      if (!m.enabled || (m.roleFilter && !m.roleFilter.includes(actor.role))) continue;
      trace.visited.push(m.moduleId);
      let intent: ActionIntentDraft | undefined;
      let selected = false;
      let reason = '';
      const action = (type: 'gather'|'deliver'|'attack'|'capture'): ActionIntentDraft => ({type,actorId:actor.id,priority:m.priority});
      switch(m.kind) {
        case 'retreat':
          if (actor.hp <= m.config.hpThreshold && base) { selected=true; intent=move(ctx,actor,base,m.priority); reason='health threshold reached'; }
          break;
        case 'haul':
          if (actor.cargo >= m.config.minCargo && actor.cargo > 0 && base) { selected=true; intent=actor.roomId===base.id ? action('deliver') : move(ctx,actor,base,m.priority); reason='cargo ready for delivery'; }
          break;
        case 'gather': {
          if (actor.cargo >= actor.cargoCapacity) break;
          const target = ctx.world.rooms.find(r => r.id===m.config.targetRoomId && r.resources>0)
            ?? (!m.config.targetRoomId ? [...ctx.world.rooms].filter(r=>r.kind==='resource' && r.resources>0).sort((a,b)=>a.id.localeCompare(b.id))[0] : undefined);
          if (target) { selected=true; intent=actor.roomId===target.id ? action('gather') : move(ctx,actor,target,m.priority); reason='resource available'; }
          break;
        }
        case 'defend': {
          const target = m.config.roomId ? ctx.world.rooms.find(r=>r.id===m.config.roomId) : room;
          if (target && (m.config.roomId || target.enemyHp>0 || ctx.world.enemies?.some(e=>e.roomId===target.id && e.hp>0))) {
            selected=true; reason='guard assigned room';
            if (actor.roomId!==target.id) intent=move(ctx,actor,target,m.priority);
            else if (actor.task?.kind!=='guard' || actor.task.target!==target.id) { intent=action('capture'); reason='assigning guard task'; }
            else {
              const enemy=ctx.world.enemies?.find(e=>e.roomId===target.id && e.hp>0);
              const config=ctx.world.scenarioConfig as {attackRange?:number;combatIntervalTicks?:number}|undefined;
              const distance=enemy && actor.worldPosition ? Math.hypot(enemy.worldPosition.x-actor.worldPosition.x,enemy.worldPosition.y-actor.worldPosition.y) : undefined;
              if (enemy && distance!==undefined && config?.attackRange!==undefined && distance>config.attackRange) reason='approaching hostile with guard task';
              else if ((enemy || target.enemyHp>0) && config?.combatIntervalTicks!==undefined && actor.actionTick!==undefined && ctx.tick<actor.actionTick+config.combatIntervalTicks) reason='attack cooldown';
              else if (enemy || target.enemyHp>0) { intent=action('attack'); reason='hostile in attack range'; }
              else reason='holding catalog guard task';
            }
          }
          break;
        }
        case 'build': {
          const target=ctx.world.rooms.find(r=>r.id===m.config.roomId);
          const building=ctx.world.buildings.find(b=>b.owner===ctx.player.id && b.roomId===m.config.roomId && b.kind===m.config.buildingKind && (b.hp??1)>0);
          if (!target || target.enemyHp>0 || ctx.world.enemies?.some(e=>e.roomId===target.id && e.hp>0)) break;
          if (building && (building.constructionTicks??0)>=(building.requiredTicks??0)) break;
          if (!building && ctx.player.materials<m.config.minMaterials) break;
          selected=true; reason='construction requested';
          if (building && actor.task?.kind==='build' && actor.task.target===target.id && 'buildingKind' in actor.task && actor.task.buildingKind===m.config.buildingKind) reason='construction in progress';
          else intent=actor.roomId!==target.id ? move(ctx,actor,target,m.priority) : {type:'build',actorId:actor.id,roomId:target.id,kind:m.config.buildingKind,priority:m.priority};
          break;
        }
      }
      if (!selected) continue;
      trace.moduleId=m.moduleId; trace.reason=reason;
      if (intent) {
        if (intents.length<ctx.limits.maxIntents) intents.push(intent);
        else { trace.moduleId='hold'; trace.reason='intent limit reached'; }
      }
      break;
    }
  }
  return {intents,memoryPatch:{set:{aiTrace:{v:1,tick:ctx.tick,actors}}}};
}
`;
