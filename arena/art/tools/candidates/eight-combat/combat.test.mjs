import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import sharp from 'sharp';
const root=path.dirname(fileURLToPath(import.meta.url)),read=async p=>JSON.parse(await readFile(path.join(root,p),'utf8'));
const directions=['NE','SW','E','W','N','S','NW','SE'];
for(const [action,count,timings,size]of [['attack',4,[150,90,180,180],192],['hit',2,[120,240],192],['down',4,[150,180,180,600],256]]){
 test(`${action} has complete independent headings, timing and bounded trimmed pages`,async()=>{
  const budget=await read(`merged/${action}/atlas-budget.json`);
  assert.deepEqual(new Set(budget.directions),new Set(directions));
  assert.equal(budget.clip.frameCount,count);assert.deepEqual(budget.clip.frameDurationsMs,timings);assert.equal(budget.clip.playback,'once');assert.deepEqual(budget.sourceSize,[size,size]);assert.equal(budget.renderScale,1);
  const keys=new Set();
  for(const layer of budget.layers){
   for(const page of layer.pages){
    const atlas=await read(`merged/${action}/${page.json}`),meta=await sharp(path.join(root,'merged',action,page.image)).metadata();
    assert.ok(meta.width<=2048&&meta.height<=2048);
    for(const [key,f]of Object.entries(atlas.frames)){
     assert.ok(!keys.has(key),key);keys.add(key);
     assert.equal(f.sourceSize.w,size);assert.equal(f.sourceSize.h,size);
     assert.ok(f.spriteSourceSize.x>=0&&f.spriteSourceSize.y>=0);
     assert.ok(f.spriteSourceSize.x+f.spriteSourceSize.w<=size&&f.spriteSourceSize.y+f.spriteSourceSize.h<=size);
    }
   }
  }
  for(const direction of directions){
   const order=budget.layerOrderByDirection[direction];
   const actual=new Set([...keys].filter(key=>key.split('/')[2]===direction).map(key=>key.split('/')[1]));
   assert.deepEqual(new Set(order),actual,`${action}/${direction} must order exactly its registered layers`);
   for(let frame=0;frame<count;frame++){
    assert.ok(keys.has(`${action}/body/${direction}/${String(frame).padStart(2,'0')}`));
    for(const layer of order)assert.ok(keys.has(`${action}/${layer}/${direction}/${String(frame).padStart(2,'0')}`),`${action}/${layer}/${direction}/${frame} texture missing`);
   }
  }

 });
}
test('six combat directions retain planted feet, reachable wrists and exact staff contact',async()=>{
 for(const batch of ['e-w','n-s-nw-se'])for(const action of ['attack','hit']){
  const report=await read(`candidates/${batch}/${action}/contact-report.json`),first={};
  for(const frame of report.frames){
   first[frame.direction]??=frame;
   for(const wrist of Object.values(frame.wristTargets))assert.ok(wrist.errorPx<1e-8);
   assert.equal(frame.gripErrorPx,0);
   assert.deepEqual(frame.soleGroundWorld,first[frame.direction].soleGroundWorld);
  }
 }
});
test('down retains world limb lengths, floor contacts and exclusive grounded anatomy',async()=>{
 const pose=await read('candidates/eight/down/pose.json'),report=await read('candidates/eight/down/contact-report.json');
 assert.equal(Object.keys(pose.previewLooks).length,8);
 for(const [direction,d]of Object.entries(pose.directions))for(const [index,p]of d.poses.entries()){
  const w=p.supportContacts.world;
  for(const side of ['left','right']){
   assert.equal(w[side+'Foot'][2],0);
   if(index>0)assert.ok(w[side+'Wrist'][2]<=.03);
   for(const [a,b,length]of [['Hip','Knee',.3187701178],['Knee','Ankle',.3060520193],['Shoulder','Elbow',.252],['Elbow','Wrist',.214]])assert.ok(Math.abs(Math.hypot(...w[side+a].map((v,i)=>v-w[side+b][i]))-length)<1e-8,`${direction}/${index}/${side}${a}`);
  }
  for(const a of d.attachments.filter(a=>a.id.startsWith('grounded-')))assert.equal(p.hiddenAttachments.includes(a.id),index<2);
  if(index>=2)for(const id of ['head','torso'])assert.ok(p.hiddenAttachments.includes(id));
 }
 assert.equal(report.frames.length,32);
});
