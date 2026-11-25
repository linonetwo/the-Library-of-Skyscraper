import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import path from 'node:path';
const root=path.dirname(new URL(import.meta.url).pathname);
const read=async p=>JSON.parse(await readFile(p,'utf8'));
for(const action of ['walk','idle']){
 const sources={ 'ne-sw':path.join(root,'inputs/frozen-ne-sw',action), 'e-w':path.join(root,'e-w',action), 'n-s-nw-se':path.join(root,'n-s-nw-se',action)};
 const target=path.join(root,'merged',action);await mkdir(target,{recursive:true});
 let out;const map=new Map(),keys=new Set();
 for(const [batch,source] of Object.entries(sources)){
  const b=await read(path.join(source,'atlas-budget.json'));
  if(!out)out={...b,directions:[],layers:[],activeLayers:[],inactiveLayers:[],decodedBytes:0,layerOrderByDirection:{}};
  for(const field of ['renderScale','groundPivot','sourceSize'])if(JSON.stringify(out[field])!==JSON.stringify(b[field]))throw Error('Registration mismatch '+field);
  for(const field of ['frameCount','frameDurationsMs','playback'])if(JSON.stringify(out.clip[field])!==JSON.stringify(b.clip[field]))throw Error('Clip mismatch '+field);
  for(const d of b.directions){if(out.directions.includes(d))throw Error('Repeated direction '+d);out.directions.push(d);out.layerOrderByDirection[d]=b.layerOrderByDirection?.[d]||['weapon-staff-back','hair-ivory-back','hair-midnight-back','body','outfit-scholar','outfit-warden','weapon-staff-front','body-front','outfit-warden-front','hand-front','hand-grip','hair-ivory-front','hair-midnight-front'];}
  await mkdir(path.join(target,batch),{recursive:true});
  for(const l of b.layers){
   if(!map.has(l.layer))map.set(l.layer,{...l,pages:[],sourceFrames:0,nonemptyFrames:0,untrimmedPixels:0,trimmedPixels:0,decodedBytes:0,active:false});
   const merged=map.get(l.layer);merged.active||=l.active;
   for(const field of ['sourceFrames','nonemptyFrames','untrimmedPixels','trimmedPixels','decodedBytes'])merged[field]+=(l[field]||0);
   for(const page of l.pages||[]){
    if(page.width>2048||page.height>2048)throw Error('Page over budget');
    const atlas=await read(path.join(source,page.json));
    for(const key of Object.keys(atlas.frames)){if(keys.has(key))throw Error('Frame collision '+key);keys.add(key);}
    for(const name of [page.image,page.json])await copyFile(path.join(source,name),path.join(target,batch,name));
    merged.pages.push({...page,image:`${batch}/${page.image}`,json:`${batch}/${page.json}`});
   }
  }
 }
 for(const direction of out.directions) out.layerOrderByDirection[direction]=out.layerOrderByDirection[direction].filter(layer=>{
  const present=Array.from({length:out.clip.frameCount},(_,frame)=>keys.has(`${action}/${layer}/${direction}/${String(frame).padStart(2,'0')}`));
  if(present.some(Boolean)&&!present.every(Boolean))throw Error(`Partial layer ${action}/${layer}/${direction}`);
  return present.every(Boolean);
 });
 out.layers=[...map.values()];out.activeLayers=out.layers.filter(l=>l.active).map(l=>l.layer);out.inactiveLayers=out.layers.filter(l=>!l.active).map(l=>l.layer);out.decodedBytes=out.layers.reduce((s,l)=>s+l.decodedBytes,0);
 await writeFile(path.join(target,'atlas-budget.json'),JSON.stringify(out,null,2));
 console.log(action,out.directions.length,'directions',keys.size,'unique frames',out.decodedBytes,'decoded bytes');
}
