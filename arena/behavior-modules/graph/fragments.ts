import type { ActorRole } from '../types';
import type { GraphFragment, GraphFragmentBindings, ModuleRef } from './composition-types';
import type { GraphPatch, RuleGraph, RuleNode } from './types';
import { nodeChildren } from './diagnostics';
import { remapNode } from './edit';
/** A fragment contains a decision subtree and only its referenced module instances. */
export function exportGraphFragment(graph:RuleGraph,rootId:string):GraphFragment {
 const nodes:RuleNode[]=[];const visited=new Set<string>();
 const walk=(id:string)=>{if(visited.has(id))return;const node=graph.nodes.find(n=>n.id===id);if(!node)throw new Error('Missing fragment node '+id);visited.add(id);nodes.push(structuredClone(node));nodeChildren(node).forEach(walk);};walk(rootId);
 const ids=new Set(nodes.flatMap(n=>n.type==='module'?[n.moduleId]:[]));
 const modules=[...ids].map(id=>{const module=graph.modules.find(m=>m.moduleId===id);if(!module)throw new Error('Missing fragment module '+id);return structuredClone(module);});
 return {schemaVersion:1,rootId,nodes,modules};
}
/** Explicit binding inventory includes existing room conditions/modules, not only new capabilities. */
export function graphFragmentRefs(fragment:GraphFragment):ModuleRef[] {
 const refs:ModuleRef[]=[];const seen=new Set<string>();
 const add=(ref:ModuleRef)=>{const key=JSON.stringify(ref);if(!seen.has(key)){seen.add(key);refs.push(ref);}};
 const walk=(value:unknown):void=>{if(!value||typeof value!=='object')return;const record=value as Record<string,unknown>;
  for(const [key,item] of Object.entries(record)){
   if((key==='roomId'||key==='targetRoomId'||key==='viaRoomId')&&typeof item==='string')add({type:'room',roomId:item});
   else if(key==='role'&&record.type==='ownRole')add({type:'ownRole',role:item as ActorRole});else walk(item);
  }
 };
 walk(fragment.nodes);walk(fragment.modules);for(const m of fragment.modules)for(const role of m.roleFilter??[])add({type:'ownRole',role});return refs;
}
/** One patch: avoid all target IDs, copy dependencies once, preserve internal sharing. */
export function importGraphFragment(graph:RuleGraph,fragment:GraphFragment,bindings:GraphFragmentBindings):{patch:GraphPatch;rootId:string;idMap:Record<string,string>} {
 for(const ref of graphFragmentRefs(fragment))if(ref.type==='room'?!bindings.rooms[ref.roomId]:!bindings.ownRoles[ref.role])throw new Error('Missing explicit fragment binding '+JSON.stringify(ref));
 const taken=new Set([...graph.roles,...graph.states,...graph.transitions,...graph.nodes].map(x=>x.id));
 for(const m of graph.modules)taken.add(m.moduleId);for(const n of graph.nodes)if(n.type==='score')for(const c of n.candidates)taken.add(c.id);
 const ids=[...fragment.nodes.flatMap(n=>[n.id,...(n.type==='score'?n.candidates.map(c=>c.id):[])]),...fragment.modules.map(m=>m.moduleId)];
 const idMap:Record<string,string>={};for(const id of ids){let next=id;for(let i=2;taken.has(next);i++)next=id+'-'+i;taken.add(next);idMap[id]=next;}
 const bind=(value:unknown):unknown=>{if(Array.isArray(value))return value.map(bind);if(!value||typeof value!=='object')return value;const record=value as Record<string,unknown>;return Object.fromEntries(Object.entries(record).map(([key,item])=>[key,(key==='roomId'||key==='targetRoomId'||key==='viaRoomId')&&typeof item==='string'?bindings.rooms[item]:key==='role'&&record.type==='ownRole'?bindings.ownRoles[item as ActorRole]:key==='roleFilter'?(item as ActorRole[]).map(r=>bindings.ownRoles[r]):bind(item)]));};
 const nodes=fragment.nodes.map(node=>bind(remapNode(node,idMap)) as RuleNode);
 const modules=fragment.modules.map(module=>({...bind(module) as typeof module,moduleId:idMap[module.moduleId]}));
 return {rootId:idMap[fragment.rootId],idMap,patch:{graphId:graph.graphId,baseRevision:graph.revision,operations:[...modules.map(module=>({type:'putModule' as const,module})),...nodes.map(node=>({type:'putNode' as const,node}))]}};
}
