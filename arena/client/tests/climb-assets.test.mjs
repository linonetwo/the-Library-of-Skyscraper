import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {animationLayers} from '../src/walkLayers.ts';
const root=new URL('../public/assets/iso-v050-mobility/climb/',import.meta.url);
const json=async file=>JSON.parse(await readFile(new URL(file,root),'utf8'));
test('normal index registers only the reviewed NE/SW climb with all four phase ranges',async()=>{
 const index=JSON.parse(await readFile(new URL('../public/assets/iso-v030-base/index.json',import.meta.url),'utf8'));
 assert.equal(index.clips.filter(clip=>clip.action==='climb').length,1);
 assert.equal(index.clips.find(clip=>clip.action==='climb').root,'/assets/iso-v050-mobility/climb');
 const descriptor=await json('atlas-budget.json');
 assert.deepEqual(descriptor.directions,['NE','SW']);assert.deepEqual(descriptor.groundPivot,[128,204.8]);
 assert.deepEqual(descriptor.sourceSize,[256,256]);assert.equal(descriptor.renderScale,1);
 assert.equal(descriptor.clip.frameCount,66);assert.equal(descriptor.handMode,'natural');
 const expected={grip:[0,24,1500],descend:[25,49,1500],crestUp:[50,57,500],crestDown:[58,65,500]};
 for(const [phase,[first,last,duration]] of Object.entries(expected)) {
  assert.deepEqual(descriptor.clip.phaseFrames[phase],{first,last});
  assert.equal(descriptor.clip.frameDurationsMs.slice(first,last+1).reduce((a,b)=>a+b,0),duration);
 }
 const frames=new Set();
 for(const layer of descriptor.layers) for(const page of layer.pages) Object.keys((await json(page.json)).frames).forEach(frame=>frames.add(frame));
 for(const direction of descriptor.directions) for(const outfit of ['scholar','warden']) for(const hair of ['ivory','midnight']) for(const weapon of [false,true]) {
  const layers=animationLayers('climb',{outfit,hair,weapon},descriptor.activeLayers,descriptor,direction);
  assert(layers.includes('hand-front'));assert(!layers.includes('hand-grip'));
  assert.equal(layers.includes('weapon-staff-back'),weapon);
  for(let frame=0;frame<66;frame++) for(const layer of layers) assert(frames.has(`climb/${layer}/${direction}/${String(frame).padStart(2,'0')}`));
 }
 const hashes=await json('source-hashes.json');
 const freeze=JSON.parse(await readFile(new URL('../../art/tools/candidates/eight-mobility/freeze-climb.json',import.meta.url),'utf8'));
 assert.deepEqual(hashes,freeze.files);
 for(const [file,hash] of Object.entries(hashes)) assert.equal(createHash('sha256').update(await readFile(new URL(file,root))).digest('hex'),hash);
 assert.equal(hashes['atlas-budget.json'],'68e0b6456900146eaf5bdb8f6fde0081225aff63262e80116d8461ce99addcff');
});
