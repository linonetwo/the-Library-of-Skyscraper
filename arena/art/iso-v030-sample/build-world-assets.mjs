import sharp from 'sharp';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const out=new URL('../../client/public/assets/iso-v030-world/',import.meta.url);
const sourceRoot=new URL('../source/',import.meta.url);
await mkdir(out,{recursive:true});
const hash=b=>createHash('sha256').update(b).digest('hex');
const json=v=>JSON.stringify(v,null,2)+'\n';
const sources={};
async function clean(name) {
  const bytes=await readFile(new URL(name,sourceRoot));
  const {data,info}=await sharp(bytes).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  for(let p=0;p<data.length;p+=4)if(data[p+3]<=8)data.fill(0,p,p+4);
  sources[name]={sha256:hash(bytes),size:[info.width,info.height]};
  return {bytes:await sharp(data,{raw:info}).png().toBuffer(),data,info};
}
const resource=await clean('iso-v030-resource-bundle.png');
const enemy=await clean('iso-v030-inkguard-neutral.png');
const construction=await clean('iso-v030-construction-site.png');
const entries={};
const cropBounds=(data,info,region)=>{
  let x0=region[0]+region[2],y0=region[1]+region[3],x1=-1,y1=-1;
  for(let y=region[1];y<region[1]+region[3];y++)for(let x=region[0];x<region[0]+region[2];x++)if(data[(y*info.width+x)*4+3]>8){
    x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);
  }
  return [x0,y0,x1-x0+1,y1-y0+1];
};
async function prop(id,source,crop,scale,canvas,pivot,sourcePivot,extra={}) {
  const [left,top,width,height]=crop;
  const piece=await sharp(source.bytes).extract({left,top,width,height}).resize({width:Math.round(width*scale)}).png().toBuffer();
  const placement=[Math.round(pivot[0]-(sourcePivot[0]-left)*scale),Math.round(pivot[1]-(sourcePivot[1]-top)*scale)];
  const result=await sharp({create:{width:canvas[0],height:canvas[1],channels:4,background:'#00000000'}})
    .composite([{input:piece,left:placement[0],top:placement[1]}]).png().toBuffer();
  await writeFile(new URL(`${id}.png`,out),result);
  entries[id]={image:`${id}.png`,canvas,pivot,anchor:[pivot[0]/canvas[0],pivot[1]/canvas[1]],
    sourceCrop:crop,sourcePivot,sourceScale:scale,placement,status:'prototype',releaseApproved:false,...extra};
  return result;
}
await prop('resource-cache',resource,cropBounds(resource.data,resource.info,[0,0,980,resource.info.height]),.18,
  [192,224],[96,176],[470,800],{kind:'prop',footprint:[1.3,1.0],heightMeters:.8,source:'iso-v030-resource-bundle.png'});
const cargo=await prop('cargo-bundle',resource,cropBounds(resource.data,resource.info,[980,0,resource.info.width-980,resource.info.height]),.09,
  [40,40],[20,25],[1190,840],{kind:'attachment',heightMeters:.2,source:'iso-v030-resource-bundle.png',
    attachJoint:'pelvis',jointOffset:[0,4],leftHandContact:[6,18],rightHandContact:[34,18],
    directionLayer:{NE:'behind-body',SW:'in-front-of-outfit-behind-hands'},handPosePending:true});
const site=await prop('construction-site',construction,cropBounds(construction.data,construction.info,[0,0,construction.info.width,construction.info.height]),.14,
  [192,224],[96,176],[765,650],{kind:'construction-overlay',footprint:[1,1],heightMeters:.55,
    source:'iso-v030-construction-site.png',emptyInterior:true});
const siteEntry=entries['construction-site'];
const siteFrontPolygons=[
  [[270,540],[385,540],[815,775],[815,915],[690,915],[690,825],[270,700]],
  [[690,640],[1240,390],[1330,750],[1020,900],[690,915]],
];
const inside=(x,y,poly)=>{
  let hit=false;
  for(let i=0,j=poly.length-1;i<poly.length;j=i++) {
    const [xi,yi]=poly[i],[xj,yj]=poly[j];
    if((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)hit=!hit;
  }
  return hit;
};
const {data:siteData,info:siteInfo}=await sharp(site).raw().toBuffer({resolveWithObject:true});
const siteBack=Buffer.from(siteData),siteFront=Buffer.alloc(siteData.length);
for(let y=0;y<siteInfo.height;y++)for(let x=0;x<siteInfo.width;x++) {
  const sx=(x-siteEntry.placement[0])/.14+siteEntry.sourceCrop[0];
  const sy=(y-siteEntry.placement[1])/.14+siteEntry.sourceCrop[1];
  if(!siteFrontPolygons.some(p=>inside(sx,sy,p)))continue;
  const at=(y*siteInfo.width+x)*4;siteData.copy(siteFront,at,at,at+4);siteBack.fill(0,at,at+4);
}
for(const [suffix,pixels,depth]of [['back',siteBack,-.1],['front',siteFront,.1]]) {
  await sharp(pixels,{raw:siteInfo}).png().toFile(new URL(`construction-site-${suffix}.png`,out).pathname);
  entries[`construction-site-${suffix}`]={...siteEntry,image:`construction-site-${suffix}.png`,depthOffset:depth,sourceFrontMasks:siteFrontPolygons};
}
const enemyCells=[];
for(const [index,direction]of ['NE','SW'].entries()) {
  const sourcePivot=[index*768+385,950];
  enemyCells.push(await prop(`inkguard-${direction}`,enemy,[index*768,0,768,1024],.11328125,
    [128,160],[64,144],sourcePivot,{kind:'enemy-neutral',footprint:[.65,.65],heightMeters:1.35,
      source:'iso-v030-inkguard-neutral.png',direction,actionsApproved:[],rigPending:true}));
}
const frames={};
for(const [index,direction]of ['NE','SW'].entries())frames[`sample/inkguard/${direction}/00`]={
  frame:{x:index*132+2,y:2,w:128,h:160},rotated:false,trimmed:false,
  spriteSourceSize:{x:0,y:0,w:128,h:160},sourceSize:{w:128,h:160},anchor:{x:.5,y:.9},
};
await sharp({create:{width:264,height:164,channels:4,background:'#00000000'}})
  .composite(enemyCells.map((input,index)=>({input,left:index*132+2,top:2}))).png().toFile(new URL('inkguard-neutral.png',out).pathname);
await writeFile(new URL('inkguard-neutral.json',out),json({frames,meta:{image:'inkguard-neutral.png',format:'RGBA8888',size:{w:264,h:164},scale:'1'}}));
await writeFile(new URL('manifest.json',out),json({
  schemaVersion:1,status:'prototype',releaseApproved:false,
  camera:{yaw:45,elevation:30,tileSize:[128,64],zScale:78.3837,worldUnitMeters:1},sources,assets:entries,
  pending:['Resource depleted components','Cargo actual hand/pelvis pose attachment','Inkguard 8-view rig and actions','Construction product occlusion review'],
}));
await sharp({create:{width:680,height:224,channels:4,background:'#d5dfd9'}})
  .composite([
    {input:await readFile(new URL('resource-cache.png',out)),left:0,top:0},
    {input:cargo,left:195,top:120},
    {input:enemyCells[0],left:230,top:50},
    {input:enemyCells[1],left:350,top:50},
    {input:site,left:480,top:0},
  ]).png().toFile(new URL('world-assets-preview.png',import.meta.url).pathname);
console.log('Built resource, carried bundle, and two neutral inkguard world sprites.');
