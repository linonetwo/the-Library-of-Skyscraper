/** Only added to a generated project which actually uses custom module instances. */
export const customRuntimeSource=`import type {RuleContext,ActorScriptView,ActionIntentDraft,MemoryValue,CustomModuleInput,CustomModuleResult} from '@skyscraper/arena-script-sdk';
import type {CustomModuleBinding,CustomParameter,ModuleVisit} from './graph-plan';
import {customBodies} from './custom-registry';
export function selectCustom(ctx:RuleContext,actor:ActorScriptView,module:CustomModuleBinding,nodeId:string,fallback:string,exits:Record<string,string>|undefined,memory:MemoryValue):{visit:ModuleVisit;intent?:ActionIntentDraft;memory?:MemoryValue;next?:string} {
 const visit:ModuleVisit={moduleId:module.moduleId,nodeId,outcome:'fallback',reasonCode:'disabled',fallbackNodeId:fallback};
 if(!module.enabled)return {visit,next:fallback};
 if(module.roleFilter&&!module.roleFilter.includes(actor.role)){visit.reasonCode='role-filtered';return {visit,next:fallback};}
 const body=customBodies[JSON.stringify([module.definitionId,module.revisionId])];
 const result=body({tick:ctx.tick,actor,player:ctx.player,squad:ctx.squad,world:ctx.world,tasks:ctx.tasks,params:module.config,memory:JSON.parse(JSON.stringify(memory))});
 visit.reason=result.reason.slice(0,240);
 const saved='memory' in result?{memory:JSON.parse(JSON.stringify(result.memory)) as MemoryValue}:{};
 if(result.type==='fallback'){visit.reasonCode='custom-fallback';return {visit,...saved,next:fallback};}
 if(result.type==='exit'){
  const target=exits?.[result.key];visit.exitKey=result.key;visit.reasonCode=target?'custom-exit':'custom-unconnected-exit';visit.fallbackNodeId=target??fallback;
  return {visit,...saved,next:target??fallback};
 }
 delete visit.fallbackNodeId;
 if(result.type==='hold'){visit.outcome='hold';visit.reasonCode='custom-hold';return {visit,...saved};}
 if(result.type==='action'){visit.outcome='selected';visit.reasonCode='custom-selected';return {visit,...saved,intent:{...result.intent,actorId:actor.id,priority:module.priority}};}
 throw new Error('Custom module returned an invalid result');
}
`;
export function addCustomRuntime(source:string):string {
 return "import {selectCustom} from './custom-runtime';\nimport type {MemoryValue} from '@skyscraper/arena-script-sdk';\n"+source
 .replace('type ActorMemory={','type ActorMemory={customState?:Record<string,MemoryValue>;')
 .replace('  trace.moduleVisits=[];', '  memory.customState=JSON.parse(JSON.stringify(old?.customState??{}));\n  trace.moduleVisits=[];')
 .replace('     if(isCompositionModule(module)){',`     if(module.kind==='custom'){
      const choice=selectCustom(ctx,actor,module,id,node.fallback,node.exits,old?.customState?.[module.moduleId]??null);
      if('memory' in choice)memory.customState![module.moduleId]=choice.memory!;
      if(trace.moduleVisits!.length<8)trace.moduleVisits!.push(choice.visit);else trace.moduleVisitsTruncated=true;
      if(choice.visit.outcome==='fallback')return evaluate(choice.next!);
      return {selected:true,nodeId:id,moduleId:module.moduleId,intent:choice.intent,reason:choice.visit.reason??choice.visit.reasonCode,logs:[]};
     }
     if(isCompositionModule(module)){`);
}
