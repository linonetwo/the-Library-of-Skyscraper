import {mapFragmentRefs} from './fragment-references';
import type { GraphFragment, GraphFragmentBindings, RoomRef, OwnRoleRef } from './composition-types';
import type { GraphPatch, RuleGraph, RuleNode } from './types';
import { nodeChildren } from './diagnostics';
import { remapNode } from './edit';
import { referencedCustomDefinitions } from './custom-project';
/** A fragment contains a decision subtree and only its referenced module instances. */
export function exportGraphFragment(graph:RuleGraph,rootId:string):GraphFragment {
 const nodes:RuleNode[]=[];const visited=new Set<string>();
 const walk=(id:string)=>{if(visited.has(id))return;const node=graph.nodes.find(n=>n.id===id);if(!node)throw new Error('Missing fragment node '+id);visited.add(id);nodes.push(structuredClone(node));nodeChildren(node).forEach(walk);};walk(rootId);
 const ids=new Set(nodes.flatMap(n=>n.type==='module'?[n.moduleId]:[]));
 const modules=[...ids].map(id=>{const module=graph.modules.find(m=>m.moduleId===id);if(!module)throw new Error('Missing fragment module '+id);return structuredClone(module);});
 const definitions=referencedCustomDefinitions({...graph,modules});
 return {schemaVersion:1,rootId,nodes,modules,...(definitions.length?{customDefinitions:structuredClone(definitions)}:{})};
}
/** Explicit binding inventory includes existing room conditions/modules, not only new capabilities. */
export function graphFragmentRefs(fragment:GraphFragment):(RoomRef|OwnRoleRef)[] {
 const refs:(RoomRef|OwnRoleRef)[]=[];const seen=new Set<string>();
 const add=(ref:RoomRef|OwnRoleRef)=>{const key=JSON.stringify(ref);if(!seen.has(key)){seen.add(key);refs.push(ref);}};
 mapFragmentRefs(fragment,ref=>{add(ref);return ref;});return refs;
}
/** One patch: avoid all target IDs, copy dependencies once, preserve internal sharing. */
export function importGraphFragment(graph:RuleGraph,fragment:GraphFragment,bindings:GraphFragmentBindings):{patch:GraphPatch;rootId:string;idMap:Record<string,string>} {
 for(const ref of graphFragmentRefs(fragment))if(ref.type==='room'?!bindings.rooms[ref.roomId]:!bindings.ownRoles[ref.role])throw new Error('Missing explicit fragment binding '+JSON.stringify(ref));
 const taken=new Set([...graph.roles,...graph.states,...graph.transitions,...graph.nodes].map(x=>x.id));
 for(const m of graph.modules)taken.add(m.moduleId);for(const n of graph.nodes)if(n.type==='score')for(const c of n.candidates)taken.add(c.id);
 const ids=[...fragment.nodes.flatMap(n=>[n.id,...(n.type==='score'?n.candidates.map(c=>c.id):[])]),...fragment.modules.map(m=>m.moduleId)];
 const idMap:Record<string,string>={};for(const id of ids){let next=id;for(let i=2;taken.has(next);i++)next=id+'-'+i;taken.add(next);idMap[id]=next;}
 const bound=mapFragmentRefs(fragment,ref=>ref.type==='room'?{...ref,roomId:bindings.rooms[ref.roomId]}:{...ref,role:bindings.ownRoles[ref.role]!});
 const nodes=bound.nodes.map(node=>remapNode(node,idMap));
 const modules=bound.modules.map(module=>({...module,moduleId:idMap[module.moduleId]}));
 return {rootId:idMap[fragment.rootId],idMap,patch:{graphId:graph.graphId,baseRevision:graph.revision,operations:[...(fragment.customDefinitions??[]).map(definition=>({type:'putCustomDefinition' as const,definition})),...modules.map(module=>({type:'putModule' as const,module})),...nodes.map(node=>({type:'putNode' as const,node}))]}};
}
