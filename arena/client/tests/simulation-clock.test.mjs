import {test} from 'node:test';
import assert from 'node:assert/strict';
import {SimulationClock} from '../src/SimulationClock.ts';
import {clipDuration,frameAt} from '../src/animationTiming.ts';
const recorded=Object.freeze({sessionId:'release-recording',tick:29,paused:false,tickDurationMs:500});
test('paused replay stays at T29 and the same release ink frame after wall time and redraws',()=>{
 const clock=new SimulationClock(),ink={frameCount:4,frameDurationsMs:[125,125,125,125],playback:'once'};
 clock.update(recorded,1000,true);
 for(const now of [1000,1750,8000]){
  clock.update(recorded,now,true);
  const age=clock.sample(now)-recorded.tick*recorded.tickDurationMs;
  assert.equal(clock.sample(now),14500);assert.ok(age<clipDuration(ink));assert.equal(frameAt(ink,age),0);
 }
 assert.equal(recorded.paused,false);
});
test('resume advances the original clock; seek and authority pause freeze its new tick',()=>{
 const clock=new SimulationClock();clock.update(recorded,1000,true);
 clock.update(recorded,2000,false);assert.equal(clock.sample(2250),14750);
 clock.update(recorded,2250,false);assert.equal(clock.sample(2400),14900);
 assert.equal(clock.sample(3000),15000);
 const sought=Object.freeze({...recorded,tick:12});
 clock.update(sought,3500,true);assert.equal(clock.sample(9000),6000);
 clock.update(sought,10000,false);assert.equal(clock.sample(10100),6100);
 clock.update({...sought,paused:true},11000,false);assert.equal(clock.sample(20000),6000);
 assert.equal(sought.paused,false);
});
