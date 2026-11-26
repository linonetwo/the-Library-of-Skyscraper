import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const read=async file=>JSON.parse(await readFile(file,'utf8'));
const directions=['S','SW','W','NW','N','NE','E','SE'];
const totals=['sourceFrames','nonemptyFrames','untrimmedPixels','trimmedPixels','decodedBytes'];

/** Merge reviewed direction batches; keep every atlas page byte-for-byte. */
export async function mergeMobility(action,sources,target) {
 if(!['run','jump'].includes(action)) throw Error('Expected run or jump');
 let out;
 const layers=new Map(),keys=new Set();
 await mkdir(target,{recursive:true});
 for(const [batch,source] of Object.entries(sources)) {
  const budget=await read(path.join(source,'atlas-budget.json'));
  if(!out) out={...budget,directions:[],layers:[],layerOrderByDirection:{}};
  for(const field of ['sourceSize','groundPivot','renderScale','appearanceOptions','handMode'])
   if(JSON.stringify(out[field])!==JSON.stringify(budget[field])) throw Error('Registration mismatch '+field);
  if(JSON.stringify(out.clip)!==JSON.stringify(budget.clip)||budget.clip.action!==action) throw Error('Timeline mismatch');
  for(const direction of budget.directions) {
   if(out.directions.includes(direction)) throw Error('Repeated direction '+direction);
   out.directions.push(direction);
   out.layerOrderByDirection[direction]=budget.layerOrderByDirection[direction];
  }
  for(const layer of budget.layers) {
   if(!layers.has(layer.layer)) layers.set(layer.layer,{...layer,pages:[],active:false,...Object.fromEntries(totals.map(key=>[key,0]))});
   const merged=layers.get(layer.layer);
   merged.active||=layer.active;
   for(const field of totals) merged[field]+=layer[field]??0;
   for(const page of layer.pages??[]) {
    if(page.width>2048||page.height>2048) throw Error('Page exceeds 2048');
    const atlas=await read(path.join(source,page.json));
    for(const key of Object.keys(atlas.frames)) {
     if(keys.has(key)) throw Error('Repeated frame '+key);
     keys.add(key);
    }
    for(const file of [page.image,page.json]) {
     const destination=path.join(target,batch,file);
     await mkdir(path.dirname(destination),{recursive:true});
     await copyFile(path.join(source,file),destination);
    }
    merged.pages.push({...page,image:`${batch}/${page.image}`,json:`${batch}/${page.json}`});
   }
  }
 }
 if(out.directions.length!==8||directions.some(direction=>!out.directions.includes(direction))) throw Error('Incomplete eight-direction coverage');
 const expectedCount=action==='run'?16:8,expectedDuration=action==='run'?500:2000;
 if(out.clip.frameCount!==expectedCount||out.clip.frameDurationsMs.reduce((a,b)=>a+b,0)!==expectedDuration) throw Error('Unexpected mobility timing');
 if(action==='run'&&out.clip.cycleWorldStride!==1.5) throw Error('Unexpected run stride');
 out.directions=directions;
 for(const direction of directions) {
  out.layerOrderByDirection[direction]=out.layerOrderByDirection[direction].filter(layer=>{
   const present=Array.from({length:expectedCount},(_,frame)=>keys.has(`${action}/${layer}/${direction}/${String(frame).padStart(2,'0')}`));
   if(!present.some(Boolean)) return false;
   if(!present.every(Boolean)) throw Error(`Incomplete frame coverage: ${action}/${layer}/${direction}`);
   return true;
  });
 }
 out.layers=[...layers.values()];
 out.activeLayers=out.layers.filter(layer=>layer.active).map(layer=>layer.layer);
 out.inactiveLayers=out.layers.filter(layer=>!layer.active).map(layer=>layer.layer);
 out.decodedBytes=out.layers.reduce((sum,layer)=>sum+layer.decodedBytes,0);
 await writeFile(path.join(target,'atlas-budget.json'),JSON.stringify(out,null,2)+'\n');
 return out;
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
 const root=path.dirname(fileURLToPath(import.meta.url));
 const [neSw,five,south]=process.argv.slice(2);
 if(!neSw||!five||!south) throw Error('Usage: merge-mobility.mjs NE_SW_ROOT FIVE_ROOT SOUTH_ROOT (each contains run/ and jump/)');
 for(const action of ['run','jump']) {
  const descriptor=await mergeMobility(action,Object.fromEntries(Object.entries({'ne-sw':neSw,'e-w-n-nw-se':five,s:south}).map(([batch,source])=>[batch,path.resolve(source,action)])),path.join(root,'merged',action));
  console.log(action,descriptor.directions.length,'directions',descriptor.decodedBytes,'decoded bytes');
 }
}
