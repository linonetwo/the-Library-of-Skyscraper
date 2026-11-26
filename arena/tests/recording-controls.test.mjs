import test from 'node:test';
import assert from 'node:assert/strict';
import {z} from '../tools/node_modules/zod/index.js';
import {recordingActionSchemas,performRecordingAction} from '../tools/browser-recording.mjs';
const schema=z.discriminatedUnion('type',recordingActionSchemas);
test('recording selectors bind explicit actor/version/object and retain original operations',()=>{
 for(const a of [{type:'selectRecordingVersion',sourceHash:'archive-hash'},{type:'selectRecordingActor',actorId:'p1-guard'},{type:'selectRecordingObjectType',target:'module'},{type:'setRecordingHitKind',kind:'fallback'},{type:'setRecordingCursor',operationIndex:-1},{type:'saveRecordingRange',name:'有货缺目标',fromOperation:4,toOperation:18},{type:'setRuleComparisonOperation',operationIndex:17}])assert(schema.safeParse(a).success);
 assert(!schema.safeParse({type:'nextRecording',trace:{}}).success);
 assert(!schema.safeParse({type:'setRecordingCursor',operationIndex:-2}).success);
 assert(!schema.safeParse({type:'saveRecordingRange',name:'x',fromOperation:0,toOperation:1.5}).success);
});
test('recording controls never intercept ordinary world commands',async()=>{assert.equal(await performRecordingAction(null,{type:'startExpedition'}),false);});
