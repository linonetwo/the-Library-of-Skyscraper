import type { RuleGraph, GraphPatch, GraphOperation } from './types';
import type { CustomModuleDefinition } from './custom-types';
import { customModuleDefaults, customParameterMatches } from './custom-definition';
export function addCustomModule(graph:RuleGraph,definition:CustomModuleDefinition,moduleId:string):GraphPatch {
  if(graph.modules.some(module=>module.moduleId===moduleId))throw new Error('Module ID already exists');
  return {graphId:graph.graphId,baseRevision:graph.revision,operations:[{type:'putCustomDefinition',definition},{type:'putModule',module:{moduleId,kind:'custom',definitionId:definition.definitionId,revisionId:definition.revisionId,config:customModuleDefaults(definition),enabled:true,priority:20}}]};
}
export function previewCustomModuleUpgrade(graph:RuleGraph,moduleId:string,definition:CustomModuleDefinition) {
  const module=graph.modules.find(m=>m.moduleId===moduleId);
  if(module?.kind!=='custom'||module.definitionId!==definition.definitionId)throw new Error('Upgrade must belong to the selected module definition');
  const old=graph.customDefinitions?.find(d=>d.definitionId===module.definitionId&&d.revisionId===module.revisionId);
  if(!old)throw new Error('Missing current module definition');
  const keys=new Set(definition.fields.map(f=>f.key)),exits=new Set(definition.exits.map(e=>e.key));
  const affectedNodes=graph.nodes.filter(n=>n.type==='module'&&n.moduleId===moduleId);
  return {removedFields:old.fields.filter(f=>!keys.has(f.key)).map(f=>f.key),removedExits:old.exits.filter(e=>!exits.has(e.key)).map(e=>e.key),affectedNodeIds:affectedNodes.map(n=>n.id)};
}
/** Explicit upgrade changes only the selected instance and its obsolete leaf ports. */
export function upgradeCustomModule(graph:RuleGraph,moduleId:string,definition:CustomModuleDefinition):GraphPatch {
  previewCustomModuleUpgrade(graph,moduleId,definition);
  const module=graph.modules.find(m=>m.moduleId===moduleId)!;if(module.kind!=='custom')throw new Error('Not a custom module');
  const config=Object.fromEntries(definition.fields.map(f=>[f.key,customParameterMatches(f,module.config[f.key])?module.config[f.key]:structuredClone(f.default)]));
  const exits=new Set(definition.exits.map(e=>e.key));
  const operations:GraphOperation[]=[{type:'putCustomDefinition',definition},{type:'putModule',module:{...module,revisionId:definition.revisionId,config}}];
  for(const node of graph.nodes)if(node.type==='module'&&node.moduleId===moduleId&&node.exits){const next=Object.fromEntries(Object.entries(node.exits).filter(([key])=>exits.has(key)));if(Object.keys(next).length!==Object.keys(node.exits).length)operations.push({type:'putNode',node:{...node,exits:next}});}
  return {graphId:graph.graphId,baseRevision:graph.revision,operations};
}
