import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {loadRig} from '../eight-mobility/rig.mjs';
import {castPoses} from './cast.mjs';
import {recoverConfig} from './recover.mjs';
const read=async url=>JSON.parse(await readFile(url,'utf8'));
test('cast is eight finite reachable stationary poses with one release interval',async()=>{
 const rig=await loadRig(['NE','SW']);
 for(const d of Object.values(rig.directions)){
  const poses=castPoses(d);assert.equal(poses.length,8);
  assert.deepEqual(poses.map(p=>p.supportContacts.phase),['chanting','chanting','chanting','release','release','recovery','recovery','recovery']);
  for(const p of poses){assert.deepEqual(p.rootScreenDelta,[0,0]);assert.equal(p.attachmentAngles.staff,p.attachmentAngles['right-hand-grip']);for(const t of Object.values(p.wristTargets))assert(t.point.every(Number.isFinite));}
 }
});
test('recover starts at exact down final geometry and joins the registered idle at the larger pivot',async()=>{
 const config=await recoverConfig(),down=await read(new URL('../eight-combat/candidates/eight/down/pose.json',import.meta.url)),idle=await read(new URL('../ne-sw-idle/pose.json',import.meta.url));
 assert.deepEqual(config.cell,[256,256]);assert.deepEqual(config.groundPivot,[128,204.8]);
 for(const [name,d] of Object.entries(config.directions)){
  assert.equal(d.poses.length,8);
  for(const field of ['jointPositions','jointAngles','attachmentMappings','attachmentAngles'])assert.deepEqual(d.poses[0][field],down.directions[name].poses[3][field]);
  assert.equal(d.poses[7].worldStanding,true);
  for(const [id,target] of Object.entries(idle.directions[name].poses[0].wristTargets))assert.deepEqual(d.poses[7].wristTargets[id].point,target.point.map(v=>v+32));
 }
});
test('recover active load transfer keeps real limb lengths and world root fixed',async()=>{
 const config=await recoverConfig();
 for(const d of Object.values(config.directions))for(const p of d.poses.slice(1,7)){
  assert.deepEqual(p.rootScreenDelta,[0,0]);const w=p.supportContacts.world;
  for(const s of ['left','right'])for(const [a,b,length] of [['Hip','Knee',.3187701178],['Knee','Ankle',.3060520193],['Shoulder','Elbow',.252],['Elbow','Wrist',.214]])assert(Math.abs(Math.hypot(...w[s+a].map((v,i)=>v-w[s+b][i]))-length)<1e-9);
  for(const s of p.supportContacts.feet)assert.equal(w[s+'Foot'][2],0);
 }
});
