import { contractSource } from '../contract-source';
import { graphContractSource } from './contract-source';
import type { RuleGraph, GraphSourceRef } from './types';
export const graphMarker='// @arena-graph/v2 ';
export function canonical(value:unknown):string {if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';if(value!==null&&typeof value==='object')return '{'+Object.entries(value).sort(([a],[b])=>a<b?-1:a>b?1:0).filter(([,v])=>v!==undefined).map(([k,v])=>JSON.stringify(k)+':'+canonical(v)).join(',')+'}';return JSON.stringify(value);}
export function graphPlanSource(graph:RuleGraph):string {
 const {roles,states,transitions,nodes,modules,...header}=graph;
 const source=canonical(header).slice(0,-1)+',\n'+Object.entries({roles,states,transitions,nodes,modules}).map(([key,items])=>JSON.stringify(key)+':[\n'+items.map(canonical).join(',\n')+'\n]').join(',\n')+'}';
 return graphMarker+canonical(graph)+'\n'+contractSource+'\n'+graphContractSource+'\nexport const graph:RuleGraph = '+source+';\nexport const modulePlan:BehaviorPlan={schemaVersion:1,compositionId:graph.graphId,mode:"priority",modules:[],fallbackModuleId:"hold"};\n';
}
/** Deterministic draft coordinates remain available while diagnostics block compiling. */
export function graphDraftSourceRef(graph:RuleGraph,objectId:string):GraphSourceRef|null {
 const lines=graphPlanSource(graph).split('\n');
 for(const key of ['roles','states','transitions','nodes','modules'] as const){const index=graph[key].findIndex(item=>('id' in item?item.id:item.moduleId)===objectId);if(index<0)continue;const start=lines.findIndex(l=>l===JSON.stringify(key)+':[');return {file:'graph-plan.ts',line:start+index+2,column:1};}
 for(const node of graph.nodes)if(node.type==='score'&&node.candidates.some(c=>c.id===objectId))return graphDraftSourceRef(graph,node.id);
 return null;
}
