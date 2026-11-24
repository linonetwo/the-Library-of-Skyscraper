import { graphDraftSourceRef } from './source';
import type { GraphCondition, GraphDiagnostic, RuleGraph, RuleNode } from './types';
export function nodeChildren(node: RuleNode): string[] {
  switch(node.type) {
    case 'condition':return [node.yes,node.no];
    case 'priority':case 'sequence':return [...node.children,node.fallback];
    case 'score':return [...node.candidates.map(c=>c.nodeId),node.fallback];
    case 'module':return [node.fallback];case 'log':return [node.next];case 'hold':case 'check':return [];
  }
  return [];
}
export function diagnoseGraph(graph: RuleGraph): GraphDiagnostic[] {
  const diagnostics:GraphDiagnostic[]=[];
  const add=(id:string,code:string,message:string,severity:'error'|'warning'='error')=>diagnostics.push({objectId:id,code,message,severity});
  if(graph.schemaVersion!==2)add(graph.graphId,'schema','Unsupported graph schema');
  const all=[...graph.roles,...graph.states,...graph.transitions,...graph.nodes,...graph.modules.map(m=>({id:m.moduleId})),...graph.nodes.flatMap(n=>n.type==='score'?n.candidates:[])];
  const ids=new Set<string>();
  for(const object of all){if(!object.id||ids.has(object.id))add(object.id,'duplicate-id','IDs must be nonempty and globally unique');ids.add(object.id);}
  const states=new Set(graph.states.map(s=>s.id)),nodes=new Map(graph.nodes.map(n=>[n.id,n])),modules=new Set(graph.modules.map(m=>m.moduleId));
  const condition=(id:string,c:GraphCondition):void=>{
    if(c.type==='all'||c.type==='any'){c.conditions.forEach(x=>condition(id,x));return;}
    if(c.type==='not'){condition(id,c.condition);return;}
    if(c.type==='atRoom'){if(!c.roomId||typeof c.missing!=='boolean')add(id,'condition','Room condition requires roomId and explicit missing branch');return;}
    if(c.type!=='compare'||!['hp','cargo','cargoCapacity','materials','roomEnemyHp','targetEnemyHp','tickInState'].includes(c.field)||!['lt','lte','eq','gte','gt'].includes(c.op)||!Number.isFinite(c.value)||typeof c.missing!=='boolean')add(id,'condition','Invalid field, comparison or missing branch');
    if(c.type==='compare'&&c.field==='targetEnemyHp'&&!c.roomId)add(id,'condition','Target-room field requires roomId');
  };
  if(!graph.roles.length)add(graph.graphId,'entry','Graph requires at least one role entry');
  const roles=new Set<string>();
  for(const r of graph.roles){if(roles.has(r.role)||!['gatherer','guard','scout'].includes(r.role))add(r.id,'role','Each supported role has one entry');roles.add(r.role);if(!states.has(r.initialStateId)||!states.has(r.fallbackStateId))add(r.id,'entry','Missing initial/fallback state');}
  for(const s of graph.states){if(!nodes.has(s.treeId))add(s.id,'tree','Missing persistent tree');for(const e of [...s.entry,...s.exit]){if(e.type==='task'&&(!Number.isInteger(e.priority)||!e.roomId||!['move','gather','deliver','build','attack','capture'].includes(e.kind)))add(s.id,'effect','Invalid task plan');if(!['task','reason','remember'].includes(e.type))add(s.id,'effect','Unsupported effect');}}
  for(const t of graph.transitions){if(!states.has(t.from)||!states.has(t.to))add(t.id,'transition','Missing transition state');if(!Number.isInteger(t.priority)||!Number.isInteger(t.cooldownTicks)||t.cooldownTicks<0||!Number.isInteger(t.minStateTicks)||t.minStateTicks<0)add(t.id,'transition','Invalid transition priority/timing');condition(t.id,t.condition);}
  for(const m of graph.modules){
    if(!Number.isInteger(m.priority)||typeof m.enabled!=='boolean')add(m.moduleId,'module-config','Invalid module priority/enabled');
    const valid=m.kind==='gather'?(!m.config.targetRoomId||typeof m.config.targetRoomId==='string'):m.kind==='defend'?(!m.config.roomId||typeof m.config.roomId==='string'):m.kind==='haul'?Number.isFinite(m.config.minCargo)&&m.config.minCargo>=0:m.kind==='retreat'?Number.isFinite(m.config.hpThreshold)&&m.config.hpThreshold>=0:m.kind==='build'?!!m.config.roomId&&['tower','catalog'].includes(m.config.buildingKind)&&Number.isFinite(m.config.minMaterials)&&m.config.minMaterials>=0:false;
    if(!valid)add(m.moduleId,'module-config','Unsupported module kind/config');
  }
  for(const n of graph.nodes){
    if(!['check','condition','priority','sequence','score','log','module','hold'].includes(n.type))add(n.id,'node-kind','Unsupported executable node kind');
    for(const child of nodeChildren(n))if(!nodes.has(child))add(n.id,'reference','Missing node '+child);
    if(n.type==='condition'||n.type==='check')condition(n.id,n.condition);
    if(n.type==='module'&&!modules.has(n.moduleId))add(n.id,'module','Missing module binding');
    if(n.type==='score')for(const c of n.candidates){if(!Number.isInteger(c.weight))add(n.id,'score','Candidate weights must be integers');if(c.when)condition(n.id,c.when);}
  }
  const active=new Set<string>(),done=new Set<string>();
  const visit=(id:string)=>{if(active.has(id)){add(id,'tree-cycle','Decision tree must be acyclic');return;}if(done.has(id)||!nodes.has(id))return;active.add(id);nodeChildren(nodes.get(id)!).forEach(visit);active.delete(id);done.add(id);};
  graph.nodes.forEach(n=>visit(n.id));
  const reachable=new Set(graph.roles.flatMap(r=>[r.initialStateId,r.fallbackStateId]));
  let changed=true;while(changed){changed=false;for(const t of graph.transitions)if(reachable.has(t.from)&&!reachable.has(t.to)){reachable.add(t.to);changed=true;}}
  graph.states.filter(s=>!reachable.has(s.id)).forEach(s=>add(s.id,'unreachable','State is unreachable','warning'));
  const treeReachable=new Set<string>();const walk=(id:string)=>{if(treeReachable.has(id)||!nodes.has(id))return;treeReachable.add(id);nodeChildren(nodes.get(id)!).forEach(walk);};graph.states.filter(s=>reachable.has(s.id)).forEach(s=>walk(s.treeId));
  graph.nodes.filter(n=>!treeReachable.has(n.id)).forEach(n=>add(n.id,'unreachable','Node is unreachable','warning'));
  return diagnostics.map(d=>({...d,sourceRef:graphDraftSourceRef(graph,d.objectId)??undefined}));
}
