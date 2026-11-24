import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
const read=async p=>JSON.parse(await readFile(p,'utf8'));
const orders=(await read(path.resolve(root,'../eight-base/merged/idle/atlas-budget.json'))).layerOrderByDirection;
for(const action of (process.argv[2]||'attack,hit').split(',')){
 const sources=action==='down'?{'eight':path.join(root,'candidates/eight/down')}:{'ne-sw':path.resolve(root,`../ne-sw-${action}/output`),'e-w':path.join(root,'candidates/e-w',action),'n-s-nw-se':path.join(root,'candidates/n-s-nw-se',action)};
 const target=path.join(root,'merged',action);await mkdir(target,{recursive:true});
 let out;const layers=new Map(),keys=new Set();
 for(const [batch,source]of Object.entries(sources)){
  const budget=await read(path.join(source,'atlas-budget.json'));
  if(!out)out={...budget,directions:[],layers:[],activeLayers:[],inactiveLayers:[],decodedBytes:0,layerOrderByDirection:{}};
  for(const field of ['sourceSize','groundPivot','renderScale'])if(JSON.stringify(out[field])!==JSON.stringify(budget[field]))throw Error('Registration mismatch '+field);
  for(const field of ['frameCount','frameDurationsMs','playback'])if(JSON.stringify(out.clip[field])!==JSON.stringify(budget.clip[field]))throw Error('Clip mismatch '+field);
  for(const direction of budget.directions){if(out.directions.includes(direction))throw Error('Repeated direction '+direction);out.directions.push(direction);out.layerOrderByDirection[direction]=budget.layerOrderByDirection?.[direction]||orders[direction];}
  await mkdir(path.join(target,batch),{recursive:true});
  for(const layer of budget.layers){
   if(!layers.has(layer.layer))layers.set(layer.layer,{...layer,pages:[],active:false,sourceFrames:0,nonemptyFrames:0,untrimmedPixels:0,trimmedPixels:0,decodedBytes:0});
   const merged=layers.get(layer.layer);merged.active||=layer.active;
   for(const field of ['sourceFrames','nonemptyFrames','untrimmedPixels','trimmedPixels','decodedBytes'])merged[field]+=(layer[field]||0);
   for(const page of layer.pages||[]){
    if(page.width>2048||page.height>2048)throw Error('Page exceeds 2048');
    const atlas=await read(path.join(source,page.json));
    for(const key of Object.keys(atlas.frames)){if(keys.has(key))throw Error('Frame collision '+key);keys.add(key);}
    for(const name of [page.image,page.json])await copyFile(path.join(source,name),path.join(target,batch,name));
    merged.pages.push({...page,image:`${batch}/${page.image}`,json:`${batch}/${page.json}`});
   }
  }
 }
 if(out.directions.length!==8)throw Error('Incomplete direction coverage');
 for(const direction of out.directions){
  out.layerOrderByDirection[direction]=out.layerOrderByDirection[direction].filter(layer=>{
   const frames=Array.from({length:out.clip.frameCount},(_,frame)=>keys.has(`${action}/${layer}/${direction}/${String(frame).padStart(2,'0')}`));
   if(!frames.some(Boolean))return false;
   if(!frames.every(Boolean))throw Error(`Incomplete frame coverage: ${action}/${layer}/${direction}`);
   return true;
  });
 }

 out.layers=[...layers.values()];out.activeLayers=out.layers.filter(l=>l.active).map(l=>l.layer);out.inactiveLayers=out.layers.filter(l=>!l.active).map(l=>l.layer);out.decodedBytes=out.layers.reduce((n,l)=>n+l.decodedBytes,0);
 await writeFile(path.join(target,'atlas-budget.json'),JSON.stringify(out,null,2)+'\n');
 console.log(action,out.directions.length,'directions',keys.size,'unique frame keys',out.decodedBytes,'decoded bytes');
}
