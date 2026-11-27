import {test} from 'node:test';
import assert from 'node:assert/strict';
import {sampleRecovery} from '../src/tacticalAnimation.ts';
import {resolveAnimation} from '../src/resolveAnimation.ts';
import {neededMainActions} from '../src/mainActionNeeds.ts';
const state={actorId:'p1-guard',weapon:'unarmed',energy:0,maxEnergy:3,castReadyTick:0,recovery:{phase:'downed',startedTick:10,risingTick:12,endsTick:14}};
const actor={hp:30,state:'idle',worldPosition:{x:2,y:3},cargo:0,roomId:'room-2'};
const motion={moving:false,direction:'SW',tickDurationMs:500,motionDistanceMilli:0,tacticalState:state};
const catalog={idle:{frameCount:4,frameMs:400,playback:'loop',groundPivot:[96,172.8]},down:{frameCount:4,frameDurationsMs:[150,180,180,600],playback:'once',groundPivot:[128,204.8]},recover:{frameCount:8,frameMs:140,playback:'once',groundPivot:[128,204.8]}};
test('living knockdown plays original down timing then all eight rising frames on the same clock',()=>{
 for(const [time,clip,frame]of [[5000,'down',0],[5150,'down',1],[5330,'down',2],[5510,'down',3],[5999,'down',3],[6000,'recover',0],[6125,'recover',1],[6250,'recover',2],[6375,'recover',3],[6500,'recover',4],[6625,'recover',5],[6750,'recover',6],[6875,'recover',7],[6999,'recover',7],[7000,'idle',1]]){
  const actual=resolveAnimation(actor,time,motion,catalog);
  assert.equal(actual.clip,clip,`clip at ${time}`);assert.equal(actual.frame,frame,`frame at ${time}`);
 }
 assert.equal(resolveAnimation({...actor,state:'downed'},6500,motion,catalog).clip,'recover');
});
test('death keeps old down; missing or unsupported recovery holds same-direction final down',()=>{
 const dead=resolveAnimation({...actor,hp:0},6500,motion,catalog);
 assert.equal(dead.clip,'down');assert.equal(dead.frame,3);
 for(const c of [{idle:catalog.idle,down:catalog.down},{...catalog,recover:{...catalog.recover,directions:['NE']}}]){
  const fallback=resolveAnimation(actor,6500,motion,c);
  assert.equal(fallback.requestedClip,'recover');assert.equal(fallback.clip,'down');assert.equal(fallback.frame,3);assert.equal(fallback.direction,'SW');
 }
});
test('pause, reverse seek and weapon changes do not create another recovery timeline',()=>{
 const saved=resolveAnimation(actor,6500,motion,catalog);
 assert.deepEqual(resolveAnimation(actor,6500,motion,catalog),saved);
 assert.equal(resolveAnimation(actor,6000,motion,catalog).frame,0);
 assert.deepEqual(resolveAnimation(actor,6500,{...motion,tacticalState:{...state,weapon:'staff'}},catalog),saved);
 assert.equal(sampleRecovery(state,4999,500),undefined);assert.equal(sampleRecovery(state,7000,500),undefined);
 assert.deepEqual(neededMainActions({actors:[actor],enemies:[],tick:10,tactics:{actorStates:[state],controlPoints:[]}}),['down','recover']);
});
