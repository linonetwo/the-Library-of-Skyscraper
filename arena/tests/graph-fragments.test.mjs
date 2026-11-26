import test from 'node:test';
import assert from 'node:assert/strict';
import {z} from '../tools/node_modules/zod/index.js';
import {fragmentActionSchemas,performFragmentAction} from '../tools/browser-graph-fragments.mjs';
const schema=z.discriminatedUnion('type',fragmentActionSchemas);
test('fragment actions accept typed bindings and reject hidden graph/state payloads',()=>{
 for(const action of [{type:'openRuleGraphFragments'},{type:'saveRuleGraphFragment',name:'护送回退'},{type:'previewRuleGraphFragment',fragmentId:'saved-id'},{type:'bindRuleGraphFragmentRoom',fromRoomId:'room-1',roomId:'room-3'},{type:'bindRuleGraphFragmentRole',fromRole:'gatherer',role:'guard'},{type:'confirmRuleGraphFragment'}])assert(schema.safeParse(action).success);
 assert(!schema.safeParse({type:'saveRuleGraphFragment',name:'x',graph:{nodes:[]}}).success);
 assert(!schema.safeParse({type:'bindRuleGraphFragmentRole',fromRole:'enemy',role:'guard'}).success);
 assert(!schema.safeParse({type:'saveRuleGraphFragment',name:'  '}).success);
});
test('unrelated actions pass through without touching any page state',async()=>{
 assert.equal(await performFragmentAction(null,{type:'seekReplay',operationIndex:1}),false);
});
