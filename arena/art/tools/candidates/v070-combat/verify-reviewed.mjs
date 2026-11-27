import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
const [finalRoot,baseRoot,updatedRoot]=process.argv.slice(2);
if(!updatedRoot)throw Error('Usage: verify-reviewed.mjs FINAL BASE_FIVE UPDATED_N_NW_S');
const read=async p=>JSON.parse(await readFile(p,'utf8')),hash=bytes=>createHash('sha256').update(bytes).digest('hex');
async function index(root){
 const descriptor=await read(path.join(root,'atlas-budget.json')),frames=new Map();
 for(const layer of descriptor.layers)for(const page of layer.pages){
  const atlas=await read(path.join(root,page.json)),image=await sharp(path.join(root,page.image)).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  for(const [key,frame]of Object.entries(atlas.frames)){assert(!frames.has(key),key);frames.set(key,{frame,image});}
 }
 return {descriptor,frames,descriptorSha256:hash(await readFile(path.join(root,'atlas-budget.json')))};
}
function pixels({frame:{frame},image:{data,info}}){
 return Buffer.concat(Array.from({length:frame.h},(_,row)=>data.subarray(((frame.y+row)*info.width+frame.x)*4,((frame.y+row)*info.width+frame.x+frame.w)*4)));
}
const final=await index(finalRoot),base=await index(baseRoot),updated=await index(updatedRoot);
let comparedFrames=0;
for(const [key,entry]of final.frames){
 const direction=key.split('/')[2],reference=(['N','NW','S'].includes(direction)?updated:base).frames.get(key);assert(reference,key);
 for(const field of ['spriteSourceSize','sourceSize','anchor'])assert.deepEqual(entry.frame[field],reference.frame[field],key+'/'+field);
 assert.equal(entry.frame.frame.w,reference.frame.frame.w,key+'/width');assert.equal(entry.frame.frame.h,reference.frame.frame.h,key+'/height');
 assert(pixels(entry).equals(pixels(reference)),key+'/RGBA');comparedFrames++;
}
for(const direction of final.descriptor.directions){
 const reference=(['N','NW','S'].includes(direction)?updated:base).descriptor;
 assert.deepEqual(final.descriptor.layerOrderByDirection[direction],reference.layerOrderByDirection[direction],direction+'/order');
 assert.deepEqual(final.descriptor.anchorsByDirection[direction],reference.anchorsByDirection[direction],direction+'/anchors');
}
const report={comparedFrames,restoredTrimRGBA:'byte identical: same sourceSize/spriteSourceSize and every RGBA trim pixel',layerOrdersAndAnchors:'exactly equal',finalDescriptorSha256:final.descriptorSha256,baseFiveDescriptorSha256:base.descriptorSha256,updatedThreeDescriptorSha256:updated.descriptorSha256};
await writeFile(path.join(finalRoot,'review-equivalence.json'),JSON.stringify(report,null,2)+'\n');console.log(report);
