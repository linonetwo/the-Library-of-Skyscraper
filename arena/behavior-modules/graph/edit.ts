import type { RuleGraph, RuleNode, GraphPatch, GraphOperation } from './types';
import { nodeChildren } from './diagnostics';
const identity=(item:{id?:string;moduleId?:string})=>item.id??item.moduleId!;
const collections=['roles','states','transitions','nodes','modules'] as const;
const kinds={roles:'Role',states:'State',transitions:'Transition',nodes:'Node',modules:'Module'} as const;
function allIds(graph:RuleGraph):Set<string>{return new Set([...collections.flatMap(key=>graph[key].map(identity)),...graph.nodes.flatMap(n=>n.type==='score'?n.candidates.map(c=>c.id):[])]);}
export function freshGraphId(graph:RuleGraph, preferred:string):string {
 const ids=allIds(graph);let id=preferred;for(let n=2;ids.has(id);n++)id=preferred+'-'+n;return id;
}
export function remapNode(node:RuleNode,map:Record<string,string>):RuleNode {
 const ref=(id:string)=>map[id]??id;const result=structuredClone(node);result.id=ref(result.id);
 switch(result.type){case 'condition':result.yes=ref(result.yes);result.no=ref(result.no);break;
 case 'priority':case 'sequence':result.children=result.children.map(ref);result.fallback=ref(result.fallback);break;
 case 'score':result.candidates=result.candidates.map(c=>({...c,id:ref(c.id),nodeId:ref(c.nodeId)}));result.fallback=ref(result.fallback);break;
 case 'mobility':result.fallback=ref(result.fallback);break;
 case 'log':result.next=ref(result.next);break;case 'module':result.moduleId=ref(result.moduleId);result.fallback=ref(result.fallback);if(result.exits)result.exits=Object.fromEntries(Object.entries(result.exits).map(([key,id])=>[key,ref(id)]));break;}
 return result;
}
/** Renaming a stable ID rewrites every executable reference atomically. */
export function renameGraphObject(graph:RuleGraph,id:string,newId:string):GraphPatch {
 if(!allIds(graph).has(id)||!newId||(newId!==id&&allIds(graph).has(newId)))throw new Error('Unknown or duplicate graph ID');
 const map={[id]:newId};const ref=(value:string)=>map[value]??value;const next=structuredClone(graph);
 next.roles=next.roles.map(r=>({...r,id:ref(r.id),initialStateId:ref(r.initialStateId),fallbackStateId:ref(r.fallbackStateId)}));
 next.states=next.states.map(s=>({...s,id:ref(s.id),treeId:ref(s.treeId)}));next.transitions=next.transitions.map(t=>({...t,id:ref(t.id),from:ref(t.from),to:ref(t.to)}));
 next.nodes=next.nodes.map(n=>remapNode(n,map));next.modules=next.modules.map(m=>({...m,moduleId:ref(m.moduleId)}));
 const operations:GraphOperation[]=[];
 for(const key of collections)graph[key].forEach((before,index)=>{const after=next[key][index];if(JSON.stringify(before)===JSON.stringify(after))return;
  if(identity(before)!==identity(after))operations.push({type:'remove'+kinds[key],id:identity(before)} as GraphOperation);
  operations.push({type:'put'+kinds[key],[key==='roles'?'role':key==='states'?'state':key==='transitions'?'transition':key==='nodes'?'node':'module']:after} as GraphOperation);
 });
 return {graphId:graph.graphId,baseRevision:graph.revision,operations};
}
/** Copy one reachable decision-tree fragment; module bindings intentionally stay shared. */
export function cloneGraphFragment(graph:RuleGraph,rootId:string):{patch:GraphPatch;rootId:string;idMap:Record<string,string>} {
 const selected:RuleNode[]=[];const visited=new Set<string>();
 const walk=(id:string)=>{if(visited.has(id))return;const node=graph.nodes.find(n=>n.id===id);if(!node)throw new Error('Unknown fragment node '+id);visited.add(id);selected.push(node);nodeChildren(node).forEach(walk);};walk(rootId);
 const taken=allIds(graph);const map:Record<string,string>={};
 for(const id of selected.flatMap(n=>[n.id,...(n.type==='score'?n.candidates.map(c=>c.id):[])])){let copy=id+'-copy';for(let n=2;taken.has(copy);n++)copy=id+'-copy-'+n;taken.add(copy);map[id]=copy;}
 return {patch:{graphId:graph.graphId,baseRevision:graph.revision,operations:selected.map(node=>({type:'putNode',node:remapNode(node,map)}))},rootId:map[rootId],idMap:map};
}
