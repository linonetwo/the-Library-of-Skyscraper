import sharp from 'sharp';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const source=await readFile(new URL('../source/iso-v030-midnight-ne-sw.png',import.meta.url));
const output=new URL('../../client/public/assets/iso-v030-sample/',import.meta.url);
const originalSize=await sharp(source).metadata();
const {data,info}=await sharp(source).resize(1280,1280,{fit:'contain'}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
if(info.width!==1280||info.height!==1280)throw new Error('Review changed source dimensions');
const frames={NE:{},SW:{}},entries=[];
const rig=JSON.parse(await readFile(new URL('attachments-complete/rig.json',import.meta.url),'utf8'));
const attachmentRoot=new URL('equipment-midnight/',import.meta.url);
await mkdir(attachmentRoot,{recursive:true});
const attachments={};
for(const direction of ['NE','SW'])for(const layer of ['back','front']) {
  const pixels=Buffer.from(data);
  let scale,left,top;
  const crop=direction==='NE'?[640,0,640,640]:layer==='front'?[0,640,640,640]:[640,640,640,640];
  for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++) {
    const i=(y*info.width+x)*4;
    const allowed=x>=crop[0]&&x<crop[0]+crop[2]&&y>=crop[1]&&y<crop[1]+crop[3]
      &&(direction!=='NE'||layer==='front');
    if(!allowed||pixels[i+3]<=8)pixels.fill(0,i,i+4);
  }
  if(direction==='NE'){scale=.105;left=69;top=31;}
  else if(layer==='front'){scale=.105;left=60;top=35;}
  else {scale=.09;left=69;top=38;}
  const cropped=await sharp(pixels,{raw:info}).extract({left:crop[0],top:crop[1],width:crop[2],height:crop[3]})
    .resize({width:Math.round(crop[2]*scale)}).png().toBuffer();
  const registered=await sharp({create:{width:192,height:192,channels:4,background:'#00000000'}})
    .composite([{input:cropped,left,top}]).png().toBuffer();
  frames[direction][layer]=registered;
  await mkdir(new URL(`${direction}/`,attachmentRoot),{recursive:true});
  const image=`${direction}/hair-midnight-${layer}.png`;
  await writeFile(new URL(image,attachmentRoot),registered);
  (attachments[direction]??=[]).push({id:`hair-midnight-${layer}`,layer:`hair-midnight-${layer}`,
    joint:'neck',image,pivot:rig.directions[direction].joints.neck.cell,restTopLeft:[0,0],size:[192,192],zOrder:0,
    sourceSet:'midnight-independent-silhouette'});
  entries.push({direction,layer,sourceCrop:crop,scale,placement:[left,top],groundPivot:[96,172.8],
    sourcePartition:direction==='NE'?'rear view: cap and visible nape tail both in front of body; back layer transparent':'separate source front/back pieces'});
}
for(const layer of ['back','front']) {
  const name=`hair-midnight-${layer}`,image=`${name}.png`,atlasFrames={};
  await sharp({create:{width:392,height:196,channels:4,background:'#00000000'}})
    .composite(['NE','SW'].map((d,i)=>({input:frames[d][layer],left:2+i*196,top:2}))).png()
    .toFile(new URL(image,output).pathname);
  for(const [i,d]of ['NE','SW'].entries())atlasFrames[`sample/${name}/${d}/00`]={
    frame:{x:2+i*196,y:2,w:192,h:192},rotated:false,trimmed:false,
    spriteSourceSize:{x:0,y:0,w:192,h:192},sourceSize:{w:192,h:192},
    anchor:{x:.5,y:.9},
  };
  await writeFile(new URL(`${name}.json`,output),JSON.stringify({frames:atlasFrames,meta:{
    image,scale:'1',size:{w:392,h:196},status:'static-hair-prototype',releaseApproved:false
  }},null,2)+'\n');
}
const preview=[];
for(const [row,direction]of ['NE','SW'].entries()) {
  const get=async name=>sharp(await readFile(new URL(`${name}.png`,output)))
    .extract({left:row*196+2,top:2,width:192,height:192}).png().toBuffer();
  const body=await get('body'),front=await get('body-front');
  for(const [column,hair]of ['bare','ivory','midnight'].entries()) {
    const stack=[];
    if(hair!=='bare')stack.push({input:hair==='midnight'?frames[direction].back:await get('hair-ivory-back'),left:0,top:0});
    stack.push({input:body,left:0,top:0},{input:front,left:0,top:0});
    if(hair!=='bare')stack.push({input:hair==='midnight'?frames[direction].front:await get('hair-ivory-front'),left:0,top:0});
    const image=await sharp({create:{width:192,height:192,channels:4,background:'#00000000'}}).composite(stack).png().toBuffer();
    preview.push({input:image,left:column*192,top:row*192});
  }
}
await sharp({create:{width:576,height:384,channels:4,background:'#d5dfd9'}}).composite(preview).png()
  .toFile(new URL('hair-three-states-preview.png',import.meta.url).pathname);
await sharp(new URL('hair-three-states-preview.png',import.meta.url).pathname)
  .resize({width:1152,kernel:'nearest'}).png()
  .toFile(new URL('hair-three-states-detail.png',import.meta.url).pathname);
await writeFile(new URL('midnight-registration.json',import.meta.url),JSON.stringify({
  source:'arena/art/source/iso-v030-midnight-ne-sw.png',sha256:createHash('sha256').update(source).digest('hex'),
  status:'static-prototype',releaseApproved:false,referenceUpload:false,sourceSuccessCount:1,
  sourceSize:[originalSize.width,originalSize.height],samplingCanvas:[1280,1280],
  samplingScale:1280/originalSize.width,entries,
  style:'blue-black swept fringe and short low tied tail; independent silhouette, not ivory recolor',
},null,2)+'\n');
await writeFile(new URL('attachments.json',attachmentRoot),JSON.stringify({
  status:'static-prototype',cell:[192,192],groundPivot:[96,172.8],renderScale:1,
  baseRig:'../attachments-complete/rig.json',directions:attachments
},null,2)+'\n');
