import {customProjectFiles,referencedCustomDefinitions,archivedCustomBodyRef} from './custom-project';
import {addCustomRuntime} from './custom-runtime';
import {compositionRuntimeSource} from './composition-source';
import {addCompositionRuntime} from './composition-injection';
import type { RuleSourceProject } from '../types';
import { runtimeSource } from '../runtime-source';
import { graphRuntimeSource } from './runtime-source';
import { addMobilityRuntime, mobilityRuntimeSource } from './mobility-source';
import { diagnoseGraph } from './diagnostics';
import type { RuleGraph, GraphSourceRef } from './types';
import { graphMarker as marker, canonical, graphPlanSource } from './source';
export function toGraphSourceProject(graph:RuleGraph):RuleSourceProject {
 const errors=diagnoseGraph(graph).filter(d=>d.severity==='error');if(errors.length)throw new Error(errors.map(e=>e.objectId+': '+e.message).join('\n'));
 return serializeGraphDraft(graph);
}
/** Save invalid drafts without granting publish/preview approval. */
export function serializeGraphDraft(graph:RuleGraph):RuleSourceProject {
 const custom=graph.modules.some(m=>m.kind==='custom');
 if(graph.customDefinitions){const {customDefinitions,...rest}=graph;graph=custom?{...rest,customDefinitions:referencedCustomDefinitions(graph)}:rest;}
 const composition=graph.modules.some(m=>m.kind==='scout'||m.kind==='patrol'||m.kind==='escort'||m.kind==='custom');
 const composedRuntime=composition?addCompositionRuntime(graphRuntimeSource):graphRuntimeSource;
 const baseRuntime=custom?addCustomRuntime(composedRuntime):composedRuntime;
 const mobility=graph.nodes.some(node=>node.type==='mobility');
 return {entry:'main.ts',files:{'main.ts':"export {decide} from './graph-runtime';\n",'graph-plan.ts':graphPlanSource(graph),...(custom?customProjectFiles(graph):{}),'graph-runtime.ts':mobility?addMobilityRuntime(baseRuntime):baseRuntime,...(mobility?{'mobility-runtime.ts':mobilityRuntimeSource}:{}),...(composition?{'composition-runtime.ts':compositionRuntimeSource}:{}),'module-runtime.ts':(composition?runtimeSource.replace('function move(', 'export function move('):runtimeSource).replace("import { plan } from './ai-plan';","import { modulePlan as plan } from './graph-plan';")}};
}
export function recoverRuleGraph(project:RuleSourceProject):RuleGraph|null {
 try{const line=project.files['graph-plan.ts']?.split('\n')[0];if(!line?.startsWith(marker))return null;const graph=JSON.parse(line.slice(marker.length)) as RuleGraph;const generated=serializeGraphDraft(graph);return (project.entry??'main.ts')===generated.entry&&canonical(project.files)===canonical(generated.files)?graph:null;}catch{return null;}
}
/** Read the archived declaration for recording queries; this grants no editing/publication recovery. */
export function readArchivedRuleGraph(project:RuleSourceProject):RuleGraph|null {
 try {
  const source=project.files['graph-plan.ts'];const line=source?.split('\n')[0];if(!line?.startsWith(marker))return null;
  const declared=JSON.parse(line.slice(marker.length));const prefix='\nexport const graph:RuleGraph = ';
  const start=source.indexOf(prefix);if(start<0)return null;
  const end=source.indexOf(';\nexport const modulePlan:',start+prefix.length);if(end<0)return null;
  const graph=JSON.parse(source.slice(start+prefix.length,end)) as RuleGraph;
  return graph.schemaVersion===2&&canonical(graph)===canonical(declared)?graph:null;
 } catch {return null;}
}
export function getGraphSourceRef(project:RuleSourceProject,objectId:string):GraphSourceRef|null {
 try{const graph=readArchivedRuleGraph(project);if(!graph)return null;const source=project.files['graph-plan.ts'];const lines=source.split('\n');
  const collections=['roles','states','transitions','nodes','modules'] as const;
  for(const key of collections){const index=graph[key].findIndex(item=>('id' in item?item.id:item.moduleId)===objectId);if(index<0)continue;const start=lines.findIndex(l=>l===JSON.stringify(key)+':[');if(start<0)return null;const actual=lines[start+index+1].replace(/,$/,'');if(actual!==canonical(graph[key][index]))return null;return {file:'graph-plan.ts',line:start+index+2,column:1};}
  for(const node of graph.nodes)if(node.type==='score'&&node.candidates.some(c=>c.id===objectId))return getGraphSourceRef(project,node.id);
  return null;
 }catch{return null;}
}

export function getCustomModuleSourceRef(project:RuleSourceProject,moduleId:string):GraphSourceRef|null {
 const graph=readArchivedRuleGraph(project);return graph?archivedCustomBodyRef(project,graph,moduleId):null;
}
