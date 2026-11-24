import type { RuleSourceProject } from '../types';
import { contractSource } from '../contract-source';
import { runtimeSource } from '../runtime-source';
import { graphRuntimeSource } from './runtime-source';
import { graphContractSource } from './contract-source';
import { diagnoseGraph } from './diagnostics';
import type { RuleGraph, GraphSourceRef } from './types';
const marker='// @arena-graph/v2 ';
function canonical(value:unknown):string {if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';if(value!==null&&typeof value==='object')return '{'+Object.entries(value).sort(([a],[b])=>a<b?-1:a>b?1:0).filter(([,v])=>v!==undefined).map(([k,v])=>JSON.stringify(k)+':'+canonical(v)).join(',')+'}';return JSON.stringify(value);}
export function toGraphSourceProject(graph:RuleGraph):RuleSourceProject {
 const errors=diagnoseGraph(graph).filter(d=>d.severity==='error');if(errors.length)throw new Error(errors.map(e=>e.objectId+': '+e.message).join('\n'));
 const {roles,states,transitions,nodes,modules,...header}=graph;
 const collections={roles,states,transitions,nodes,modules};
 const source=canonical(header).slice(0,-1)+',\n'+Object.entries(collections).map(([key,items])=>JSON.stringify(key)+':[\n'+items.map(canonical).join(',\n')+'\n]').join(',\n')+'}';
 return {entry:'main.ts',files:{'main.ts':"export {decide} from './graph-runtime';\n",'graph-plan.ts':marker+canonical(graph)+'\n'+contractSource+'\n'+graphContractSource+'\nexport const graph:RuleGraph = '+source+';\nexport const modulePlan:BehaviorPlan={schemaVersion:1,compositionId:graph.graphId,mode:"priority",modules:[],fallbackModuleId:"hold"};\n','graph-runtime.ts':graphRuntimeSource,'module-runtime.ts':runtimeSource.replace("import { plan } from './ai-plan';","import { modulePlan as plan } from './graph-plan';")}};
}
export function recoverRuleGraph(project:RuleSourceProject):RuleGraph|null {
 try{const line=project.files['graph-plan.ts']?.split('\n')[0];if(!line?.startsWith(marker))return null;const graph=JSON.parse(line.slice(marker.length)) as RuleGraph;const generated=toGraphSourceProject(graph);return (project.entry??'main.ts')===generated.entry&&canonical(project.files)===canonical(generated.files)?graph:null;}catch{return null;}
}
export function getGraphSourceRef(project:RuleSourceProject,objectId:string):GraphSourceRef|null {
 try{const source=project.files['graph-plan.ts'];const line=source?.split('\n')[0];if(!line?.startsWith(marker))return null;const graph=JSON.parse(line.slice(marker.length)) as RuleGraph;const lines=source.split('\n');
  const collections=['roles','states','transitions','nodes','modules'] as const;
  for(const key of collections){const index=graph[key].findIndex(item=>('id' in item?item.id:item.moduleId)===objectId);if(index<0)continue;const start=lines.findIndex(l=>l===JSON.stringify(key)+':[');if(start<0)return null;const actual=lines[start+index+1].replace(/,$/,'');if(actual!==canonical(graph[key][index]))return null;return {file:'graph-plan.ts',line:start+index+2,column:1};}
  for(const node of graph.nodes)if(node.type==='score'&&node.candidates.some(c=>c.id===objectId))return getGraphSourceRef(project,node.id);
  return null;
 }catch{return null;}
}
