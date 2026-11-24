import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {animationLayers} from '../src/walkLayers.ts';
import {resolveAnimation} from '../src/resolveAnimation.ts';
const root=new URL('../public/assets/iso-v030-combatpack/',import.meta.url);
const json=async p=>JSON.parse(await readFile(new URL(p,root),'utf8'));
test('registered combat pages support every appearance and preserve down pivot and timing',async()=>{
 const catalog={};
 for(const action of ['attack','hit','down']){
  const d=await json(`${action}/atlas-budget.json`),frames=new Set();
  catalog[action]={...d.clip,groundPivot:d.groundPivot,renderScale:d.renderScale};
  for(const layer of d.layers) for(const page of layer.pages){
   Object.keys((await json(`${action}/${page.json}`)).frames).forEach(k=>frames.add(k));
  }
  for(const outfit of ['scholar','warden']) for(const hair of ['ivory','midnight']) for(const weapon of [false,true]) for(const dir of d.directions){
   const layers=animationLayers('walk',{outfit,hair,weapon},d.activeLayers,d,dir);
   assert.ok(layers.includes(weapon?'hand-grip':'hand-front'));
   assert.ok(!layers.includes(weapon?'hand-front':'hand-grip'));
   for(let f=0;f<d.clip.frameCount;f++) for(const layer of layers)
    assert.ok(frames.has(`${action}/${layer}/${dir}/${String(f).padStart(2,'0')}`),`${action}/${layer}/${dir}/${f}`);
  }
  assert.deepEqual(d.groundPivot,action==='down'?[128,204.8]:[96,172.8]);
 }
 const actor={hp:0,state:'downed',actionCue:{kind:'attack',startedTick:10,durationTicks:3},impactCue:{kind:'down',startedTick:11,durationTicks:0}};
 const motion={moving:false,direction:'NW',tickDurationMs:500,motionDistanceMilli:0};
 assert.equal(resolveAnimation(actor,5550,motion,catalog).frame,0);
 assert.equal(resolveAnimation(actor,8000,motion,catalog).frame,3);
 assert.deepEqual(catalog.down.frameDurationsMs,[150,180,180,600]);
});
