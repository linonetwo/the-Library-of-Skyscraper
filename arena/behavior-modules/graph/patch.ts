import type { RuleGraph, GraphPatch } from './types';
export function applyGraphPatch(graph: RuleGraph, patch: GraphPatch): RuleGraph {
  if (graph.graphId!==patch.graphId || graph.revision!==patch.baseRevision) throw new Error('Graph patch baseline is stale');
  const result=structuredClone(graph);
  for (const operation of patch.operations) {
    const collection=operation.type.endsWith('Node')?'nodes':operation.type.endsWith('State')?'states':operation.type.endsWith('Transition')?'transitions':operation.type.endsWith('Role')?'roles':'modules';
    const value='node' in operation?operation.node:'state' in operation?operation.state:'transition' in operation?operation.transition:'role' in operation?operation.role:'module' in operation?operation.module:undefined;
    const id=value?('id' in value?value.id:value.moduleId):('id' in operation?operation.id:'');
    const items=result[collection] as {id?:string;moduleId?:string}[];
    const index=items.findIndex(item=>(item.id??item.moduleId)===id);
    if (!value) { if(index>=0)items.splice(index,1); }
    else if(index>=0)items[index]=structuredClone(value); else items.push(structuredClone(value));
  }
  result.revision++;
  return result;
}
