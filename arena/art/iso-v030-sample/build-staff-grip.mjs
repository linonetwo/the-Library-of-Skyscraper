import sharp from 'sharp';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root=new URL('equipment-staff/',import.meta.url);
await mkdir(root,{recursive:true});
const base=JSON.parse(await readFile(new URL('attachments-complete/rig.json',import.meta.url),'utf8'));
const staff=await readFile(new URL('../source/walk-weapon-staff.png',import.meta.url));
const hand=await readFile(new URL('../source/grip-hands.png',import.meta.url));
const specs={
  NE:{staff:[87,1130,45,188],shaft:[27,121],hand:[517,921,300,373],wrist:[95,30],grip:[160,230]},
  SW:{staff:[87,244,49,187],shaft:[28,111],hand:[510,34,304,375],wrist:[220,30],grip:[150,230]},
};
const report={status:'grip-registration-prototype',releaseApproved:false,cell:[192,192],groundPivot:[96,172.8],
  renderScale:1,handedness:'right',newGenerationRequests:0,
  sources:{staff:{file:'arena/art/source/walk-weapon-staff.png',sha256:createHash('sha256').update(staff).digest('hex')},
    grip:{file:'arena/art/source/grip-hands.png',sha256:createHash('sha256').update(hand).digest('hex')}},
  layerContract:'right forearm-hand is replaced by forearm plus exactly one of hand-front/hand-grip; staff registered to actual rightWrist',
  directions:{}};
const preview=[];
for(const [index,direction]of ['NE','SW'].entries()){
  await mkdir(new URL(`${direction}/`,root),{recursive:true});
  const d=base.directions[direction],s=specs[direction],parts=[];
  const original=d.attachments.find(a=>a.id==='right-forearm-hand');
  const bytes=await readFile(new URL(`attachments-complete/${original.image}`,import.meta.url));
  const {data,info}=await sharp(bytes).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const wrist=d.joints.rightWrist.cell,elbow=d.joints.rightElbow.cell;
  const vector=[wrist[0]-elbow[0],wrist[1]-elbow[1]],length=Math.hypot(...vector);
  for(const mode of ['forearm','natural-hand']){
    const pixels=Buffer.from(data);
    for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++){
      const cell=[original.restTopLeft[0]+x,original.restTopLeft[1]+y];
      const t=((cell[0]-wrist[0])*vector[0]+(cell[1]-wrist[1])*vector[1])/length;
      if(mode==='forearm'?t>.7:t<=.7)pixels.fill(0,(y*info.width+x)*4,(y*info.width+x)*4+4);
    }
    const image=`${direction}/right-${mode}.png`;
    await sharp(pixels,{raw:info}).png().toFile(new URL(image,root).pathname);
    const joint=mode==='forearm'?'rightElbow':'rightWrist',anchor=d.joints[joint].cell;
    parts.push({id:`right-${mode}`,layer:mode==='forearm'?original.layer:'hand-front',joint,image,
      restTopLeft:original.restTopLeft,pivot:[anchor[0]-original.restTopLeft[0],anchor[1]-original.restTopLeft[1]],
      size:[info.width,info.height],zOrder:original.zOrder,variant:mode==='natural-hand'?'empty-hand':undefined});
    if(mode==='natural-hand')parts.at(-1).absoluteAngleFrom='rightElbow';
  }
  async function crop(source,rect,scale){
    const [left,top,width,height]=rect;
    const {data,info}=await sharp(source).extract({left,top,width,height}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    for(let i=0;i<data.length;i+=4)if(data[i+3]<=8)data.fill(0,i,i+4);
    return sharp(data,{raw:info}).resize({width:Math.round(width*scale)}).png().toBuffer();
  }
  const handScale=.025,staffScale=.5;
  const handImage=await crop(hand,s.hand,handScale),staffImage=await crop(staff,s.staff,staffScale);
  const gripOffset=[(s.grip[0]-s.wrist[0])*handScale,(s.grip[1]-s.wrist[1])*handScale];
  const gripPivot=s.wrist.map(v=>v*handScale),staffPivot=s.shaft.map((v,i)=>v*staffScale-gripOffset[i]);
  for(const [id,layer,image,pivot]of [
    ['right-hand-grip','hand-grip',handImage,gripPivot],
    ['staff',direction==='NE'?'weapon-staff-back':'weapon-staff-front',staffImage,staffPivot],
  ]){
    const path=`${direction}/${id}.png`,m=await sharp(image).metadata();
    await writeFile(new URL(path,root),image);
    parts.push({id,layer,joint:'rightWrist',image:path,pivot,restTopLeft:[wrist[0]-pivot[0],wrist[1]-pivot[1]],
      size:[m.width,m.height],zOrder:0,variant:'staff',gripOffset});
    parts.at(-1).absoluteAngleFrom='explicit-right-wrist-pose';
  }
  report.directions[direction]={replaceIds:['right-forearm-hand'],attachments:parts,
    sourceRegistration:s,handScale,staffScale,wristCell:wrist,gripOffset,
    naturalHandExclusiveWithGrip:true,clippingPlane:{normal:vector.map(v=>v/length),wrist,offset:.7}};
  const depth={body:0,'weapon-staff-back':-10,'weapon-staff-front':50,'body-front':100,'hand-grip':150};
  const all=[...d.attachments.filter(a=>['body','body-front'].includes(a.layer)&&a.id!==original.id)
    .map(a=>({...a,root:new URL('attachments-complete/',import.meta.url)})),
    ...parts.filter(a=>a.variant!=='empty-hand').map(a=>({...a,root}))];
  all.sort((a,b)=>depth[a.layer]+a.zOrder-depth[b.layer]-b.zOrder);
  const image=await sharp({create:{width:192,height:192,channels:4,background:'#00000000'}})
    .composite(await Promise.all(all.map(async a=>({input:await readFile(new URL(a.image,a.root)),
      left:Math.round(a.restTopLeft[0]),top:Math.round(a.restTopLeft[1])})))).png().toBuffer();
  preview.push({input:image,left:index*192,top:0});
}
await writeFile(new URL('attachments.json',root),JSON.stringify(report,null,2)+'\n');
await sharp({create:{width:384,height:192,channels:4,background:'#d5dfd9'}}).composite(preview).png()
  .toFile(new URL('staff-grip-rest-preview.png',import.meta.url).pathname);
await sharp(new URL('staff-grip-rest-preview.png',import.meta.url).pathname).resize({width:1152,kernel:'nearest'}).png()
  .toFile(new URL('staff-grip-rest-detail.png',import.meta.url).pathname);
