import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import sharp from 'sharp';
import {packTrimmedLayer} from '../../trim-atlas.mjs';
const source=path.resolve(process.argv[2]??'/home/user/arena-v070-art-sources/manifest.json'),out=path.resolve(process.argv[3]??'/var/lib/mwc/build-scratch/arena-v070-art/ink-fx');
const manifest=JSON.parse(await readFile(source,'utf8')),raw=await readFile(path.resolve(path.dirname(source),manifest.raw));
if(createHash('sha256').update(raw).digest('hex')!==manifest.sha256)throw Error('Ink source hash mismatch');
// Visual ellipse centers, not each phase's opaque bounding-box center. One scale
// preserves the first tiny bead and the last arcs; the source is already 2:1.
const centers=[[313.5,328],[313.5,329],[313.5,323],[313.5,326]],scale=157/627,pivot=[96,96],cell=[192,192];
const config={action:'inkFx',cell,groundPivot:pivot,renderScale:1,directions:{ground:{poses:Array.from({length:4},()=>({durationMs:125}))}}};
await mkdir(out,{recursive:true});const cells=[];
for(let frame=0;frame<4;frame++){
 const crop=await sharp(raw).extract({left:(frame%2)*627,top:Math.floor(frame/2)*627,width:627,height:627}).resize(157,157).png().toBuffer();
 const input=await sharp({create:{width:192,height:192,channels:4,background:'#00000000'}}).composite([{input:crop,left:Math.round(pivot[0]-centers[frame][0]*scale),top:Math.round(pivot[1]-centers[frame][1]*scale)}]).png().toBuffer();
 cells.push({input,left:frame*192,top:0});
}
const layer=await packTrimmedLayer('ink',cells,config,out);
const descriptor={clip:{action:'inkFx',frameCount:4,frameDurationsMs:[125,125,125,125],playback:'once'},sourceSize:cell,groundPivot:pivot,renderScale:1,directions:['ground'],layerOrderByDirection:{ground:['ink']},activeLayers:['ink'],inactiveLayers:[],layers:[layer],decodedBytes:layer.decodedBytes,maxPageDimension:2048,registration:{sourceSha256:manifest.sha256,uniformScale:scale,sourceCenters:centers,sourceAlreadyProjected:true},status:'unreviewed-packed-source-candidate'};
await writeFile(path.join(out,'atlas-budget.json'),JSON.stringify(descriptor,null,2)+'\n');
await sharp({create:{width:4*192,height:192,channels:4,background:'#e6e2dc'}}).composite(cells).png().toFile(path.join(out,'contact-sheet.png'));
console.log(JSON.stringify({out,frames:4,decodedBytes:layer.decodedBytes}));
