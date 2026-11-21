import {test} from 'node:test';
import assert from 'node:assert/strict';
import {resolveAnimation} from '../src/resolveAnimation.ts';
import {frameAt} from '../src/animationTiming.ts';
import {SimulationClock} from '../src/SimulationClock.ts';
const clip={frameCount:4,frameDurationsMs:[100,200,100,100],playback:'once',groundPivot:[96,172.8],renderScale:1};
const catalog=Object.fromEntries(['idle','walk','carry','attack','unload','hit','down','collect','build-catalog'].map(k=>[k,{...clip,playback:['idle','walk','carry','collect','build-catalog'].includes(k)?'loop':'holdLast',...(['walk','carry'].includes(k)?{cycleWorldStride:1}:{} )}]));
const entity={hp:100,cargo:0,state:'idle',worldPosition:{x:0,y:0},lastMoveDirection:{x:0,y:1},motionDistanceMilli:0};
const motion={moving:false,direction:'NE',tickDurationMs:500,motionDistanceMilli:0};
const cue=(kind,startedTick=10,durationTicks=2)=>({kind,startedTick,durationTicks,targetPosition:{x:0,y:-1}});
const resolve=(actor={},time=5250,m={})=>resolveAnimation({...entity,...actor},time,{...motion,...m},catalog);

test('half-open unequal frame intervals, loops and held last frame',()=>{
 assert.deepEqual([0,99,100,299,300,399,400,500,999].map(t=>frameAt(clip,t)),[0,0,1,1,2,2,3,3,3]);
 assert.equal(frameAt({...clip,playback:'loop'},500),0);
});
test('same-tick attack and impact preserve main clip with hit tint',()=>{
 const actor={actionCue:cue('attack'),impactCue:cue('hit')};
 const a=resolve(actor);assert.equal(a.clip,'attack');assert.equal(a.impact,true);assert.equal(a.direction,'NE');assert.equal(a.frame,1);
 assert.deepEqual(resolve({...actor}),a);
 assert.equal(resolve({...actor,actionCue:null}).clip,'hit');
});
test('dead actors play down then hold, old data holds final frame directly',()=>{
 assert.equal(resolve({hp:0,impactCue:cue('down',10,0)},5050).frame,0);
 assert.equal(resolve({hp:0,impactCue:cue('down',10,0)},9000).frame,3);
 assert.equal(resolve({hp:0},5050).frame,3);
});
test('unload survives cargo becoming empty and ends exactly at cue boundary',()=>{
 assert.equal(resolve({cargo:0,actionCue:cue('deliver')}).clip,'unload');
 assert.equal(resolve({cargo:0,actionCue:cue('deliver')},6000).clip,'idle');
 assert.equal(resolve({actionCue:cue('attack')},4999).clip,'idle');
});
test('moving work uses route phase; cargo idle and blocked work stay idle',()=>{
 assert.equal(resolve({actionCue:cue('gather')},5250,{moving:true}).clip,'walk');
 assert.equal(resolve({cargo:4},5250,{moving:true}).clip,'carry');
 assert.equal(resolve({cargo:4}).clip,'idle');
 assert.equal(resolve({task:{stage:'blocked',stageStartedTick:0}}).clip,'idle');
 assert.equal(resolve({task:{stage:'construction',stageStartedTick:10}},5150).frame,1);
 assert.equal(resolve({task:{stage:'cataloging',stageStartedTick:10}}).clip,'build-catalog');
 const a=resolve({},5250,{moving:true,motionDistanceMilli:500});
 const b=resolve({},9000,{moving:true,motionDistanceMilli:500,direction:'SW'});
 assert.equal(a.frame,b.frame);assert.equal(a.frame,1);
});
test('stationary random seek recovers persistent direction without history',()=>{
 assert.equal(resolve({lastMoveDirection:{x:0,y:-1}},9000).direction,'NE');
 assert.equal(resolve({lastMoveDirection:{x:0,y:1}},9000).direction,'SW');
});
test('unavailable clips are not registered as finished actions',()=>{
 const a=resolveAnimation({...entity,actionCue:cue('attack')},5250,motion);
 assert.equal(a.requestedClip,'attack');assert.equal(a.clip,'idle');
});
test('one scene clock caps extrapolation, preserves rerenders, freezes pause and seeks',()=>{
 const clock=new SimulationClock();const s={sessionId:'a',tick:10,paused:false,tickDurationMs:500};
 clock.update(s,1000);assert.equal(clock.sample(1200),5200);
 clock.update(s,1200);assert.equal(clock.sample(1300),5300);assert.equal(clock.sample(2000),5500);
 clock.update({...s,paused:true},2100);assert.equal(clock.sample(9999),5000);
 clock.update({...s,paused:true,tick:3},2200);assert.equal(clock.sample(9999),1500);
 clock.update({...s,sessionId:'b',tick:0},2300);assert.equal(clock.sample(2350),50);
});

test('display distance follows the same interpolation as position and snaps on seek',async()=>{
 const {ActorMotion}=await import('../src/actorMotion.ts');
 const motion=new ActorMotion({x:0,y:0},500);
 motion.move({x:0,y:0},0,true,[],1000);
 motion.move({x:64,y:32},100,false,[],2000);
 assert.equal(motion.sample(350).x,32);assert.equal(motion.sample(350).motionDistanceMilli,1500);
 motion.move({x:64,y:32},350,false,[],2000);
 assert.equal(motion.sample(350).motionDistanceMilli,1500);
 motion.move({x:0,y:0},400,true,[],1000);
 assert.equal(motion.sample(450).motionDistanceMilli,1000);
});
