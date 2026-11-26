import type { RuleGraph, GraphDiagnostic } from './types';
import { diagnoseCustomModule } from './custom-definition';
import { customDefinitionKey } from './custom-source';
export function diagnoseCustomGraph(graph:RuleGraph):GraphDiagnostic[] {
 const errors:GraphDiagnostic[]=[];const keys=new Set<string>();
 const add=(objectId:string,code:string,message:string)=>errors.push({severity:'error',objectId,code,message});
 for(const definition of graph.customDefinitions??[]){
  const key=customDefinitionKey(definition);
  if(keys.has(key))add(definition.definitionId,'custom-definition','Duplicate definition version');keys.add(key);
  if(!/^[a-f0-9]{64}$/.test(definition.revisionId))add(definition.definitionId,'custom-revision','Invalid content revision ID');
  for(const diagnostic of diagnoseCustomModule(definition))add(definition.definitionId,'custom-'+diagnostic.code,diagnostic.message);
 }
 for(const module of graph.modules){
  if(module.kind!=='custom')continue;
  const definition=graph.customDefinitions?.find(d=>customDefinitionKey(d)===customDefinitionKey(module));
  if(!definition){add(module.moduleId,'custom-definition','Missing locked definition version');continue;}
  for(const diagnostic of diagnoseCustomModule(definition,module.config))add(module.moduleId,'custom-'+diagnostic.code,diagnostic.message);
  const exits=new Set(definition.exits.map(exit=>exit.key));
  for(const node of graph.nodes)if(node.type==='module'&&node.moduleId===module.moduleId)for(const key of Object.keys(node.exits??{}))if(!exits.has(key))add(node.id,'custom-exit','Port is not declared by this module version: '+key);
 }
 for(const node of graph.nodes)if(node.type==='module'&&node.exits&&graph.modules.find(m=>m.moduleId===node.moduleId)?.kind!=='custom')add(node.id,'custom-exit','Named ports belong to custom module leaves');
 return errors;
}
