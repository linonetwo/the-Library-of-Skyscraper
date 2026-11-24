import test from 'node:test';
import assert from 'node:assert/strict';
import {eventFrameIndex,resultEvent} from '../src/eventReplay.ts';
const event=(id,tick,kind='settlement',message='编目完成')=>({id,tick,kind,message,playerId:null});
const frame=(operationIndex,tick,events)=>({operationIndex,tick,snapshot:{events}});
test('settlement record preferred; fallback remains a real final event',()=>{
 const settled=event(8,25),later=event(9,25,'notice','真实记录');
 assert.equal(resultEvent({events:[settled,later]}),settled);
 assert.equal(resultEvent({events:[later]}),later);assert.equal(resultEvent({events:[]}),undefined);
});
test('reused ticks and ids resolve to first recorded frame in latest reset attempt',()=>{
 const target=event(8,25);
 const frames=[frame(0,0,[]),frame(1,25,[target]),frame(2,26,[target]),frame(3,0,[]),frame(4,25,[event(7,25,'attack','攻击')]),frame(5,27,[target]),frame(6,28,[target])];
 assert.equal(eventFrameIndex(frames,target,[3]),5);
 assert.equal(eventFrameIndex(frames.slice(0,5),target,[3]),null);
 assert.equal(eventFrameIndex(frames,target),5);
});
test('explicit reset disambiguates same-tick identical ids even without a tick rollback',()=>{
 const target=event(1,0,'join','进入');const frames=[frame(0,0,[target]),frame(1,0,[target]),frame(2,0,[target])];
 assert.equal(eventFrameIndex(frames,target,[2]),2);
});
test('matching requires actual id, kind, message and tick, never nearby time',()=>{
 const target=event(8,25);assert.equal(eventFrameIndex([frame(1,25,[event(9,25)]),frame(2,26,[event(8,25,'settlement','不同结算')])],target),null);
 assert.equal(eventFrameIndex([],target),null);
});
test('actual authority recording: UI step-reset-step selects the second join occurrence',async()=>{
 const {readFile}=await import('node:fs/promises');
 const recording=JSON.parse(await readFile(new URL('./fixtures/event-reset-frames.json',import.meta.url),'utf8'));
 const target=recording.frames.at(-1).snapshot.events[0];
 const index=eventFrameIndex(recording.frames,target,recording.resets);
 assert.equal(index,3);assert.equal(recording.frames[index].operationIndex,3);
 assert.equal(recording.frames[index].tick,0);
 assert.equal(eventFrameIndex(recording.frames,target),3);
});
