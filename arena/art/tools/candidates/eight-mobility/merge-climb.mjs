import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {mergeMobility} from './merge-mobility.mjs';

// One explicitly accepted source per heading; no fallback to an earlier mixed batch.
export const climbSources={
 'ne-sw':{directions:['NE','SW'],variant:'B-ne-staff-offset-8',sha256:'68e0b6456900146eaf5bdb8f6fde0081225aff63262e80116d8461ce99addcff',files:{'freeze.json':'93b5704485d0b0e1443d3d1bd7a26210cb7aab869c5bda9cd7ed30d4341e5e7b','climb-weapon-staff-back-0.json':'683ef93f0fecb1c3963ba7c54fb69ec92bd5cdd43c2d9f3f3f367da3479b536e'}},
 w:{directions:['W'],sha256:'ed86ca738bdf2ac6148443a03b14c286167684188813746aa001f9761e608b4b'},
 'nw-socket-v2':{directions:['NW'],sha256:'75d5aa147ce15ff26476d032a8250e150c91b836d07b19738559c0c8803e469f'},
 'e-recovery':{directions:['E'],sha256:'f06e2c9da2983559653cdf317e1ef7505680fcc4a7abe0c724c6a2e8d24b445b'},
 'se-socket':{directions:['SE'],sha256:'be837d65474fb81fca8e94506aff2d70dd9277d28e026159aa00f5f8d645c8c0'},
 'n-thigh':{directions:['N'],sha256:'dc3365de74dc3e43529e8e6f0e4b2a77774069b1378593bf0bb36ae076313e75'},
 's-fold-d':{directions:['S'],sha256:'c95bb89aa8af672211b4638c76bffa6548081db1ea30039a2b1fd79f01647ed9',files:{'freeze.json':'6c5c4775b4d10dc7b513f497b86f18d4db199a920b67e38961bc5cfaab3813c2'}},
};
export async function mergeClimb(sources,target) {
 const selected={};
 for(const [batch,registration] of Object.entries(climbSources)) {
  const source=sources[batch];
  if(!source) throw Error('Missing accepted climb batch '+batch);
  const bytes=await readFile(path.join(source,'atlas-budget.json'));
  if(createHash('sha256').update(bytes).digest('hex')!==registration.sha256) throw Error('Climb source changed '+batch);
  for(const [file,hash] of Object.entries(registration.files??{})) {
   const actual=createHash('sha256').update(await readFile(path.join(source,file))).digest('hex');
   if(actual!==hash) throw Error('Climb variant changed '+batch+'/'+file);
  }
  const descriptor=JSON.parse(bytes);
  if(JSON.stringify(descriptor.directions)!==JSON.stringify(registration.directions)) throw Error('Wrong climb batch directions '+batch);
  selected[batch]=source;
 }
 // Require the complete explicitly selected set before creating any output.
 if(Object.values(climbSources).reduce((sum,batch)=>sum+batch.directions.length,0)!==8) throw Error('Incomplete accepted climb direction set');
 return mergeMobility('climb',selected,target);
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
 const [neSw,sixRoot,target]=process.argv.slice(2);
 if(!neSw||!sixRoot||!target) throw Error('Usage: merge-climb.mjs ACCEPTED_NE_SW_CLIP SIX_CANDIDATES_ROOT OUTPUT');
 const sources=Object.fromEntries(Object.keys(climbSources).map(batch=>[batch,batch==='ne-sw'?path.resolve(neSw):path.resolve(sixRoot,batch)]));
 await mergeClimb(sources,path.resolve(target));
}
