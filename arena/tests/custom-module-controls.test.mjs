import test from 'node:test';
import assert from 'node:assert/strict';
import {z} from '../tools/node_modules/zod/index.js';
import {customModuleActionSchemas,performCustomModuleAction} from '../tools/browser-custom-modules.mjs';
import {tacticalActionSchemas,performTacticalAction} from '../tools/browser-tactical.mjs';
import {graphActionSchemas} from '../tools/browser-rule-graph.mjs';
import {compositionActionSchemas} from '../tools/browser-composition.mjs';
import {recordingActionSchemas} from '../tools/browser-recording.mjs';
const union=z.discriminatedUnion('type',[...customModuleActionSchemas,...tacticalActionSchemas,...graphActionSchemas,...compositionActionSchemas,...recordingActionSchemas]);
test('custom and tactical actions compose with graph/recording and reject model injection',()=>{
 for(const action of [
  {type:'createCustomModule'}, {type:'setCustomModuleField',label:'参数 1 默认值',value:4},
  {type:'setCustomModuleField',scope:'instance',label:'采撷师',value:true},
  {type:'editCustomModuleSource',source:'export function decide() { return {kind:"hold",reason:"idle"}; }'},
  {type:'connectRuleGraph',port:'满载 · bagFull',target:'haul-node'},
  {type:'locateCustomModuleBody'}, {type:'selectRecordedCustomExit',exitKey:'bagFull'},
  {type:'chooseTacticalAction',kind:'claim'}, {type:'selectSessionScenario',scenarioId:'seal-contest'},
 ])assert(union.safeParse(action).success,JSON.stringify(action));
 for(const action of [{type:'createCustomModule',graph:{}},{type:'setCustomModuleField',scope:'react',label:'x',value:1},{type:'useCustomModuleLibraryItem',operation:'add',name:'x',revisionPrefix:''},{type:'chooseTacticalAction',kind:'destroy'}])assert(!union.safeParse(action).success);
});
test('unrelated actions keep the existing dispatch route',async()=>{
 assert.equal(await performCustomModuleAction(null,{type:'seekReplay',operationIndex:2}),false);
 assert.equal(await performTacticalAction(null,{type:'editCustomModuleSource',source:''}),false);
});
