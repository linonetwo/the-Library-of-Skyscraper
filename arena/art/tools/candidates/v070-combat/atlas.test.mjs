import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import sharp from 'sharp';
import {loadRunJumpRig} from '../eight-mobility/rig.mjs';
const here=path.dirname(fileURLToPath(import.meta.url)),read=async file=>JSON.parse(await readFile(file,'utf8'));
test('frozen accepted cast and ink pages match every recorded SHA and actually decode',async()=>{
 const freeze=await read(path.join(here,'freeze-cast-ink.json'));
 for(const set of Object.values(freeze.sets))for(const[file,hash]of Object.entries(set.files)){
  const bytes=await readFile(path.join(here,set.path,file));assert.equal(createHash('sha256').update(bytes).digest('hex'),hash);
  if(file.endsWith('.png')){const image=await sharp(bytes).ensureAlpha().raw().toBuffer({resolveWithObject:true});assert(image.info.width>0&&image.info.height>0);}
 }
});
test('all 32 staff appearances have complete frame keys and real orig-pixel anchors',async()=>{
 const root=path.join(here,'candidates/eight/cast'),b=await read(root+'/atlas-budget.json'),rig=await loadRunJumpRig(b.directions),keys=new Map();
 assert.equal(b.directions.length,8);assert.equal(b.clip.frameCount,8);assert.deepEqual(b.sourceSize,[192,192]);assert.deepEqual(b.groundPivot,[96,172.8]);
 assert.deepEqual(b.clip.phaseFrames,{chanting:{first:0,last:2},release:{first:3,last:4},recovery:{first:5,last:7}});
 for(const layer of b.layers)keys.set(layer.layer,new Set((await Promise.all((layer.pages??[]).map(p=>read(path.join(root,p.json))))).flatMap(j=>Object.keys(j.frames))));
 const looks=Object.entries(rig.previewLooks).filter(([name])=>name.endsWith('-staff'));assert.equal(looks.length,4);
 for(const direction of b.directions)for(const[,layers]of looks)for(let frame=0;frame<8;frame++){
  for(const layer of b.layerOrderByDirection[direction].filter(layer=>layers.includes(layer)))assert(keys.get(layer)?.has(`cast/${layer}/${direction}/${String(frame).padStart(2,'0')}`),`${direction}/${layer}/${frame}`);
  const anchors=b.anchorsByDirection[direction][frame];for(const key of ['grip','staffTip'])assert(anchors[key].every(n=>Number.isFinite(n)&&n>=0&&n<=192));
 }
});
test('ink remains one uniformly scaled already-projected four-phase effect',async()=>{
 const b=await read(path.join(here,'candidates/ink-fx/atlas-budget.json'));assert.equal(b.clip.frameCount,4);assert.equal(b.clip.playback,'once');assert.deepEqual(b.clip.frameDurationsMs,[125,125,125,125]);assert.deepEqual(b.groundPivot,[96,96]);assert.equal(b.registration.uniformScale,157/627);assert.equal(b.registration.sourceAlreadyProjected,true);
 const manifest=await read(path.join(here,'../../../iso-v070-combat/ink-fx/manifest.json')),raw=await readFile(path.join(here,'../../../iso-v070-combat/ink-fx/ink-raw.png'));assert.equal(createHash('sha256').update(raw).digest('hex'),manifest.sha256);
});
test('accepted recover64 has complete layered appearances, frozen pages and matching production registration',async()=>{
 const freeze=await read(path.join(here,'freeze-recover.json')),root=path.join(here,freeze.path),b=await read(root+'/atlas-budget.json'),keys=new Map();
 assert.equal(freeze.appearanceCount,64);assert.equal(freeze.reviewEquivalence.comparedFrames,896);
 assert.equal(b.directions.length,8);assert.equal(b.clip.frameCount,8);assert.equal(b.clip.playback,'once');assert.deepEqual(b.sourceSize,[256,256]);assert.deepEqual(b.groundPivot,[128,204.8]);
 for(const[file,expected]of Object.entries(freeze.files)){
  const bytes=await readFile(path.join(root,file));assert.equal(createHash('sha256').update(bytes).digest('hex'),expected);
  if(file.endsWith('.png'))assert((await sharp(bytes).raw().toBuffer()).length>0);
 }
 for(const layer of b.layers)keys.set(layer.layer,new Set((await Promise.all(layer.pages.map(page=>read(path.join(root,page.json))))).flatMap(atlas=>Object.keys(atlas.frames))));
 const looks=(await import('./recover.mjs').then(m=>m.recoverConfig(b.directions))).previewLooks;assert.equal(Object.keys(looks).length,8);
 for(const direction of b.directions)for(const layers of Object.values(looks))for(let frame=0;frame<8;frame++)for(const layer of b.layerOrderByDirection[direction].filter(layer=>layers.includes(layer)))assert(keys.get(layer)?.has(`recover/${layer}/${direction}/${String(frame).padStart(2,'0')}`),`${direction}/${layer}/${frame}`);
 const publicRoot=path.resolve(here,'../../../../client/public/assets'),study=await read(path.join(publicRoot,'iso-v070-combat-study/index.json')),main=await read(path.join(publicRoot,'iso-v030-base/index.json'));
 for(const action of ['cast','recover']){assert.equal(main.clips.filter(c=>c.action===action).length,1);assert.deepEqual(main.clips.find(c=>c.action===action),study.clips.find(c=>c.action===action));}
 assert.deepEqual(study.effects.inkFx,{root:'/assets/iso-v070-combat-study/ink-fx',descriptor:'atlas-budget.json'});
 const manifest=await read(path.join(publicRoot,'iso-v070-combat-study/manifest.json'));
 for(const [name,set]of Object.entries(manifest.sets))for(const[file,expected]of Object.entries(set.files))assert.equal(createHash('sha256').update(await readFile(path.join(publicRoot,'iso-v070-combat-study',name,file))).digest('hex'),expected);
});
