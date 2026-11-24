import {test} from 'node:test';
import assert from 'node:assert/strict';
import {resolveAnimation} from '../src/resolveAnimation.ts';
import {frameAt} from '../src/animationTiming.ts';
import {SimulationClock} from '../src/SimulationClock.ts';
const clip={frameCount:4,frameDurationsMs:[100,200,100,100],playback:'once',groundPivot:[96,172.8],renderScale:1};
const catalog=Object.fromEntries(['idle','walk','carry','attack','unload','hit','down','collect','build','catalog'].map(k=>[k,{...clip,playback:['idle','walk','carry','collect','build','catalog'].includes(k)?'loop':'holdLast',...(['walk','carry'].includes(k)?{cycleWorldStride:1}:{} )}]));
const entity={hp:100,cargo:0,state:'idle',worldPosition:{x:0,y:0},lastMoveDirection:{x:0,y:1},motionDistanceMilli:0};
const motion={moving:false,direction:'NE',tickDurationMs:500,motionDistanceMilli:0};
const cue=(kind,startedTick=10,durationTicks=2)=>({kind,startedTick,durationTicks,targetPosition:{x:0,y:-1}});
const resolve=(actor={},time=5250,m={})=>resolveAnimation({...entity,...actor},time,{...motion,...m},catalog);

test('half-open unequal frame intervals, loops and held last frame',()=>{
 assert.deepEqual([0,99,100,299,300,399,400,500,999].map(t=>frameAt(clip,t)),[0,0,1,1,2,2,3,3,3]);
 assert.equal(frameAt({...clip,playback:'loop'},500),0);
});
test('nonlethal hit interrupts attack then resumes its original phase',()=>{
 const actor={actionCue:cue('attack',10,3),impactCue:cue('hit',11,1)};
 const before=resolve(actor,5499);assert.equal(before.clip,'attack');
 const interrupted=resolve(actor,5550);assert.equal(interrupted.clip,'hit');assert.equal(interrupted.impact,true);assert.equal(interrupted.direction,before.direction);
 assert.deepEqual(resolve({...actor},5550),interrupted);
 const resumed=resolve(actor,6000);assert.equal(resumed.clip,'attack');assert.equal(resumed.elapsedMs,1000);
 assert.equal(resumed.frame,resolve({actionCue:actor.actionCue},6000).frame);
});
test('death overrides simultaneous attack and hit and holds the final down frame',()=>{
 const actor={hp:0,actionCue:cue('attack',10,3),impactCue:cue('hit',11,1)};
 const dead=resolve(actor,5550);assert.equal(dead.clip,'down');assert.equal(dead.frame,3);
 assert.equal(resolve({...actor,impactCue:cue('down',11,0)},5550).frame,0);
 assert.equal(resolve({...actor,impactCue:cue('down',11,0)},9000).frame,3);
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
 assert.equal(resolve({task:{stage:'cataloging',stageStartedTick:10}}).clip,'catalog');
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

test('continuous work does not face an expired old attack target',()=>{
 const a=resolve({task:{stage:'cataloging',stageStartedTick:20},actionCue:cue('attack',10,1),lastMoveDirection:{x:0,y:1}},10500);
 assert.equal(a.direction,'SW');assert.equal(a.clip,'catalog');
});

test('jittered 420/580ms deliveries preserve world speed and distance phase',async()=>{
 const {ActorMotion}=await import('../src/actorMotion.ts');
 const {project,inverse}=await import('../src/isoGeometry.ts');
 for(const heading of [{x:1,y:0},{x:Math.SQRT1_2,y:Math.SQRT1_2}]){
  const motion=new ActorMotion(project(0,0),500);
  motion.move(project(0,0),0,true,[],0,1.5);
  const deliveries=[0,420,1000,1420,2000,2420];let next=0,last=motion.sample(0);
  for(let now=0;now<=3500;now+=10){
   if(now===deliveries[next]){
    const d=++next*750;
    motion.move(project(heading.x*d/1000,heading.y*d/1000),now,false,[],d,1.5,500);
   }
   const s=motion.sample(now),a=inverse(last.x,last.y),b=inverse(s.x,s.y);
   assert.ok(Math.hypot(b.x-a.x,b.y-a.y)<=.015000001,`world speed exceeded at ${now}`);
   assert.ok(Math.abs(Math.hypot(b.x,b.y)*1000-s.motionDistanceMilli)<1e-7);
   last=s;
  }
 }
});

test('terminal movement uses remaining authoritative distance and arrives without a full-tick tail',async()=>{
 const {ActorMotion}=await import('../src/actorMotion.ts');
 const motion=new ActorMotion({x:0,y:0},500);
 motion.move({x:0,y:0},0,true,[],0,1.5);
 motion.move({x:750,y:0},0,false,[],750,1.5,500);
 motion.move({x:1500,y:0},420,false,[],1500,1.5,500);
 assert.equal(motion.duration,580);
 const actor={motionDistanceMilli:1650,travel:null};
 const {readFile}=await import("node:fs/promises");
 const config=JSON.parse(await readFile(new URL("../../shared/first-expedition.json",import.meta.url),"utf8"));
 const speed=(actor.travel?.speedMilliPerTick ?? config.speedMilliPerTick)/500;
 motion.move({x:1650,y:0},1000,false,[],actor.motionDistanceMilli,speed,500);
 assert.equal(motion.duration,100);
 assert.equal(motion.sample(1099).moving,true);
 assert.equal(motion.sample(1100).moving,false);
 assert.equal(motion.sample(1100).motionDistanceMilli,1650);
 motion.move({x:0,y:0},1100,true,[],0,1.5);
 assert.equal(motion.sample(1200).motionDistanceMilli,0);
});

// Working hand mode is independent of staff appearance; directional order excludes absent hands.
import {animationLayers} from '../src/walkLayers.ts';
test('registered working props and hand modes share one layer selector',()=>{
 const available=['body','hand-front','hand-grip','hand-left-front','work-prop-mallet','weapon-staff-back'];
 const appearance={outfit:'scholar',hair:'ivory',weapon:true};
 const descriptor={handMode:'natural',layerOrderByDirection:{N:['work-prop-mallet','hand-front','body','weapon-staff-back']}};
 assert.deepEqual(animationLayers('walk',appearance,available,descriptor,'N'),['work-prop-mallet','hand-front','body','weapon-staff-back']);
 const grip=animationLayers('walk',{...appearance,weapon:false},available,{handMode:'grip'});
 assert.ok(grip.includes('hand-grip'));assert.ok(!grip.includes('hand-front'));assert.ok(!grip.includes('weapon-staff-back'));
 assert.ok(animationLayers('walk',appearance,available).includes('hand-grip'));
});

test('coincident attack target retains deterministic facing through hit and down',()=>{
 const actionCue={...cue('attack',10,3),targetPosition:{x:0,y:0}};
 const actor={actionCue,lastMoveDirection:{x:0,y:1}};
 const attack=resolve(actor,5250),hit=resolve({...actor,impactCue:cue('hit',10,1)},5250),down=resolve({...actor,hp:0},5250);
 assert.equal(attack.direction,'SW');assert.equal(hit.direction,'SW');assert.equal(down.direction,'SW');
 assert.equal(resolve({...actor},5250).direction,attack.direction);
 assert.equal(resolve({...actor,lastMoveDirection:undefined},5250,{direction:'NW'}).direction,'NW');
});
