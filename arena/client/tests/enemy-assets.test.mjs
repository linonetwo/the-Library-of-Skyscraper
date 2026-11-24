import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolveAnimation } from '../src/resolveAnimation.ts';
const root = new URL('../public/assets/iso-v030-enemy-eight-final-1f8e013/', import.meta.url);
const json = async file => JSON.parse(await readFile(new URL(file, root), 'utf8'));

test('enemy registered bank resolves real eight-direction attack, impact and held collapse frames', async () => {
  const index = await json('index.json'), catalog = {}, descriptors = {};
  for (const entry of index.clips) {
    const d = await json(`${entry.action}/${entry.descriptor}`);
    catalog[entry.action] = {...d.clip, groundPivot:d.groundPivot, renderScale:d.renderScale};
    descriptors[entry.action] = d;
    const available = new Set();
    for (const layer of d.layers) for (const page of layer.pages) {
      const atlas = await json(`${entry.action}/${page.json}`);
      Object.keys(atlas.frames).forEach(key => available.add(key));
      await readFile(new URL(`${entry.action}/${page.image}`, root));
    }
    for (const direction of d.directions) for (let frame=0; frame<d.clip.frameCount; frame++)
      assert.ok(available.has(`${entry.action}/body/${direction}/${String(frame).padStart(2,'0')}`));
  }
  const entity = {hp:100,state:'idle',worldPosition:{x:0,y:0}};
  const motion = {moving:false,direction:'S',tickDurationMs:500,motionDistanceMilli:0};
  for (const [target, direction] of [[{x:-1,y:-1},'N'],[{x:0,y:-1},'NE'],[{x:1,y:-1},'E'],[{x:1,y:0},'SE'],[{x:1,y:1},'S'],[{x:0,y:1},'SW'],[{x:-1,y:1},'W'],[{x:-1,y:0},'NW']]) {
    const actionCue = {kind:'attack',startedTick:10,durationTicks:2,targetPosition:target};
    const result = resolveAnimation({...entity,actionCue},5250,motion,catalog);
    assert.equal(result.clip,'attack'); assert.equal(result.direction,direction);
  }
  const hit = resolveAnimation({...entity,impactCue:{kind:'hit',startedTick:10,durationTicks:1}},5100,motion,catalog);
  assert.equal(hit.clip,'hit'); assert.equal(hit.impact,true);
  const dead = resolveAnimation({...entity,hp:0},9000,motion,catalog);
  assert.equal(dead.clip,'down'); assert.equal(dead.frame,3);
  assert.deepEqual(descriptors.down.groundPivot,[128,204.8]);
  assert.deepEqual(descriptors.walk.groundPivot,[96,172.8]);
  assert.equal(catalog.walk.cycleWorldStride,1.08);
});

test('enemy movement uses display time while a 420ms snapshot advances the shared cue clock', async () => {
  const {ActorMotion} = await import('../src/actorMotion.ts');
  const {SimulationClock} = await import('../src/SimulationClock.ts');
  const clock = new SimulationClock(), snapshot = {sessionId:'enemy',tick:1,paused:false,tickDurationMs:500};
  const motion = new ActorMotion({x:0,y:0},500);
  clock.update(snapshot,0);
  motion.move({x:48,y:24},0,false,[],750,1.5,500);
  const before = motion.sample(420);
  clock.update({...snapshot,tick:2},420);
  assert.equal(clock.sample(420),1000);
  motion.move({x:96,y:48},420,false,[],1500,1.5,500);
  const after = motion.sample(420);
  assert.equal(after.x,before.x);
  assert.equal(after.motionDistanceMilli,630);
  assert.equal(motion.sample(500).motionDistanceMilli,750);
});
