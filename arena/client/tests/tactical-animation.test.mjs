import {test} from 'node:test';
import assert from 'node:assert/strict';
import {sampleCast,inkRelease} from '../src/tacticalAnimation.ts';
import {resolveAnimation} from '../src/resolveAnimation.ts';
const state={actorId:'p1-caster',weapon:'staff',energy:2,maxEnergy:3,castReadyTick:30,cast:{skillId:'ink-strike',targetId:'guardian-1',phase:'chanting',startedTick:10,releaseTick:12,endsTick:14}};
test('cast uses actual chant, one-tick release and recovery boundaries without skipping frames',()=>{
 const samples=[[4999,undefined],[5000,0],[5334,1],[5667,2],[5999,2],[6000,3],[6250,4],[6499,4],[6500,5],[6667,6],[6834,7],[6999,7],[7000,undefined]];
 for(const [time,frame]of samples)assert.equal(sampleCast(state,time,500)?.frame,frame,`sim ${time}`);
 assert.deepEqual(sampleCast(state,6250,500),sampleCast(state,6250,500));
 assert.equal(sampleCast({...state,weapon:'unarmed'},6250,500),undefined);
 assert.equal(sampleCast({...state,cast:undefined},6250,500),undefined);
});
test('only a real damaging release with historical target coordinates makes ground ink',()=>{
 const event={action:'cast',actorId:'p1-caster',targetId:'guardian-1',phase:'released',values:{hpBefore:30,hpAfter:14},targetPosition:{x:2,y:3}};
 assert.deepEqual(inkRelease(event),{x:2,y:3});
 assert.equal(inkRelease({...event,phase:'interrupted'}),undefined);
 assert.equal(inkRelease({...event,phase:'rejected'}),undefined);
 assert.equal(inkRelease({...event,targetPosition:undefined}),undefined);
 assert.equal(inkRelease({...event,action:'attack'}),undefined);
});
test('same resolver uses registered cast frames and preserves hit, death and missing-art fallbacks',()=>{
 const actor={hp:30,state:'idle',worldPosition:{x:0,y:0}},motion={moving:false,direction:'SW',tickDurationMs:500,motionDistanceMilli:0,tacticalState:state,tacticalTargetPosition:{x:1,y:0}};
 const spec={frameCount:8,frameMs:125,playback:'once',groundPivot:[96,172.8]};
 const catalog={idle:{...spec,frameCount:4},cast:spec,hit:{...spec,frameCount:2},down:{...spec,frameCount:4}};
 const result=resolveAnimation(actor,6250,motion,catalog);
 assert.equal(result.clip,'cast');assert.equal(result.frame,4);assert.equal(result.direction,'SE');
 assert.equal(resolveAnimation({...actor,impactCue:{kind:'hit',startedTick:12,durationTicks:1}},6250,motion,catalog).clip,'hit');
 assert.equal(resolveAnimation({...actor,hp:0},6250,motion,catalog).clip,'down');
 assert.equal(resolveAnimation(actor,6250,motion,{idle:catalog.idle}).clip,'idle');
});
