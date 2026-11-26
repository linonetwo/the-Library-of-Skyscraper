/** Keep the original runtime string untouched for graphs that do not use composition. */
export function addCompositionRuntime(source:string):string {
 return "import {isCompositionModule,selectComposition} from './composition-runtime';\nimport type {ModuleState} from './composition-runtime';\n"+source
 .replace('type ActorMemory={','type ActorMemory={moduleState?:Record<string,ModuleState>;')
 .replace('  stateMemory[actor.id]=memory;', '  memory.moduleState=JSON.parse(JSON.stringify(old?.moduleState??{}));\n  trace.moduleVisits=[];\n  stateMemory[actor.id]=memory;')
 .replace('     modulePlan.modules=[module];',`     if(isCompositionModule(module)){
      const moduleState=memory.moduleState![module.moduleId]??(memory.moduleState![module.moduleId]={});
      const choice=selectComposition(ctx,actor,module,moduleState,id,node.fallback);
      if(trace.moduleVisits!.length<8)trace.moduleVisits!.push(choice.visit);else trace.moduleVisitsTruncated=true;
      if(choice.visit.outcome!=='fallback')return {selected:true,nodeId:id,moduleId:module.moduleId,intent:choice.intent,reason:choice.visit.reasonCode,logs:[]};
      return evaluate(node.fallback);
     }
     modulePlan.modules=[module];`)
 .replace("     if(item && item.moduleId===module.moduleId)", `     const matched=item?.moduleId===module.moduleId;
     const reasonCode=item?.reason==='travel in progress'?'travel-active':!module.enabled?'disabled':module.roleFilter&&!module.roleFilter.includes(actor.role)?'role-filtered':matched?'official-selected':'official-unavailable';
     const visit={nodeId:id,moduleId:module.moduleId,outcome:matched?(result.intents[0]?'selected':'hold'):'fallback',reasonCode,...(!matched?{fallbackNodeId:node.fallback}:{})} as const;
     if(trace.moduleVisits!.length<8)trace.moduleVisits!.push(visit);else trace.moduleVisitsTruncated=true;
     if(item && item.moduleId===module.moduleId)`);
}
