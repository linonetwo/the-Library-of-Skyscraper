import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {mergeMobility} from '../../art/tools/candidates/eight-mobility/merge-mobility.mjs';

test('one descriptor preserves reviewed pages and actual per-direction layers',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'mobility-merge-'));
 try {
  for(const action of ['run','jump','climb']) {
   const count=action==='climb'?66:action==='run'?16:8;
   const sources={};
   for(const [batch,directions] of Object.entries({'ne-sw':['NE','SW'],five:['E','W','N','NW','SE'],s:['S']})) {
    const source=path.join(root,action,batch);sources[batch]=source;await mkdir(source,{recursive:true});
    const frames=Object.fromEntries(directions.flatMap(direction=>Array.from({length:count},(_,frame)=>[`${action}/body/${direction}/${String(frame).padStart(2,'0')}`,{}])));
    await writeFile(path.join(source,'body.json'),JSON.stringify({frames}));
    await writeFile(path.join(source,'body.png'),`reviewed-${action}-${batch}`);
    await writeFile(path.join(source,'atlas-budget.json'),JSON.stringify({clip:{action,frameCount:count,frameDurationsMs:action==='climb'?[...Array(50).fill(60),...Array(2).fill([60,60,60,70,60,60,60,70]).flat()]:Array(count).fill((action==='run'?500:2000)/count),playback:action==='run'?'loop':'once',...(action==='run'?{cycleWorldStride:1.5}:action==='climb'?{phaseFrames:{grip:{first:0,last:24},descend:{first:25,last:49},crestUp:{first:50,last:57},crestDown:{first:58,last:65}}}:{})},directions,sourceSize:[640,640],renderScale:0.2,groundPivot:[320,500],layerOrderByDirection:Object.fromEntries(directions.map(direction=>[direction,['body','empty']])),layers:[{layer:'body',active:true,sourceFrames:directions.length*count,decodedBytes:16,pages:[{image:'body.png',json:'body.json',width:2,height:2}]},{layer:'empty',active:false,pages:[]}]}));
   }
   const target=path.join(root,'merged',action);
   const out=await mergeMobility(action,sources,target);
   assert.equal(out.directions.length,8);
   assert.deepEqual(out.layerOrderByDirection.S,['body']);
   assert.equal(out.layers.find(layer=>layer.layer==='body').sourceFrames,8*count);
   for(const batch of Object.keys(sources)) for(const file of ['body.png','body.json']) assert.deepEqual(await readFile(path.join(target,batch,file)),await readFile(path.join(sources[batch],file)));
   await assert.rejects(mergeMobility(action,{'ne-sw':sources['ne-sw'],five:sources.five},path.join(root,'incomplete',action)),/Incomplete eight-direction/);
  }
 } finally {await rm(root,{recursive:true,force:true});}
});
