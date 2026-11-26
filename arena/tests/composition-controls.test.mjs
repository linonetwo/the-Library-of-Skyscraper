import test from 'node:test';
import assert from 'node:assert/strict';
import {z} from '../tools/node_modules/zod/index.js';
import {compositionActionSchemas,performCompositionAction} from '../tools/browser-composition.mjs';
import {graphActionSchemas} from '../tools/browser-rule-graph.mjs';
const schema=z.discriminatedUnion('type',[...compositionActionSchemas,...graphActionSchemas]);
test('composition controls cover all eight visible kinds without accepting direct graph writes',()=>{
 for(const kind of ['scout','patrol','escort','gather','haul','build','defend','retreat'])assert(schema.safeParse({type:'previewRuleModule',kind}).success);
 assert(!schema.safeParse({type:'previewRuleModule',kind:'attack'}).success);
 assert(!schema.safeParse({type:'previewRuleModule',kind:'escort',graph:{}}).success);
 assert(schema.safeParse({type:'setRuleGraphField',scope:'modulePreview',label:'受护岗位',value:'gatherer'}).success);
 assert(schema.safeParse({type:'setRuleGraphField',label:'模块优先级',value:5}).success);
 assert(!schema.safeParse({type:'setRuleGraphField',scope:'react',label:'x',value:1}).success);
 assert(!schema.safeParse({type:'removeRulePatrolStop',index:-1}).success);
});
test('unrelated actions remain with the original graph/replay adapter',async()=>{
 assert.equal(await performCompositionAction(null,{type:'seekReplay',operationIndex:10}),false);
});
