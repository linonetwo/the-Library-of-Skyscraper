import sharp from 'sharp';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const output=new URL('equipment-staff-additional/',import.meta.url);
await mkdir(output,{recursive:true});
const base=JSON.parse(await readFile(new URL('attachments-six-directions/rig.json',import.meta.url)));
const clothes=JSON.parse(await readFile(new URL('equipment-warden-additional/attachments.json',import.meta.url)));
const hair=JSON.parse(await readFile(new URL('equipment-hair-additional/attachments.json',import.meta.url)));
const source={staff:await readFile(new URL('../source/walk-weapon-staff.png',import.meta.url)),
 hand:await readFile(new URL('../source/grip-hands.png',import.meta.url))};
const staffRegs=JSON.parse(await readFile(new URL('../source/walk-weapon-staff-registration.json',import.meta.url)));
const handRegs=JSON.parse(await readFile(new URL('../source/walk-hand-grip-registration.json',import.meta.url)));
const handPoints={
 E:{wrist:[65,30],palm:[145,220]},W:{wrist:[250,30],palm:[130,230]},
 N:{wrist:[70,30],palm:[150,230]},S:{wrist:[195,30],palm:[140,230]},
 NW:{wrist:[245,30],palm:[145,230]},SE:{wrist:[75,35],palm:[160,230]},
};
const order=['S','SW','W','NW','N','NE','E','SE'];
const report={status:'six-direction-grip-registration-candidate',releaseApproved:false,cell:[192,192],
 groundPivot:[96,172.8],renderScale:1,newGenerationRequests:0,
 sources:{staff:{path:'arena/art/source/walk-weapon-staff.png',sha256:createHash('sha256').update(source.staff).digest('hex')},
 hand:{path:'arena/art/source/grip-hands.png',sha256:createHash('sha256').update(source.hand).digest('hex')}},
 directions:{}},views=[];
async function crop(bytes,rect,scale){
 const{data,info}=await sharp(bytes).extract({left:rect.x,top:rect.y,width:rect.w,height:rect.h}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 for(let p=0;p<data.length;p+=4)if(data[p+3]<=8)data.fill(0,p,p+4);
 return sharp(data,{raw:info}).resize({width:Math.round(rect.w*scale)}).png().toBuffer();
}
for(const[column,[heading,points]]of Object.entries(handPoints).entries()){
 await mkdir(new URL(`${heading}/`,output),{recursive:true});
 const d=base.directions[heading],wrist=d.joints.rightWrist.cell,elbow=d.joints.rightElbow.cell,
  original=d.attachments.find(a=>a.id==='right-forearm-hand'),parts=[];
 const{data,info}=await sharp(new URL(`attachments-six-directions/${original.image}`,import.meta.url).pathname).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const vector=wrist.map((v,i)=>v-elbow[i]),length=Math.hypot(...vector);
 for(const mode of ['forearm','natural-hand']){
  const pixels=Buffer.from(data);
  for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++){
   const dx=original.restTopLeft[0]+x-wrist[0],dy=original.restTopLeft[1]+y-wrist[1],t=(dx*vector[0]+dy*vector[1])/length;
   if(mode==='forearm'?t>.7:t<=.7)pixels.fill(0,(y*info.width+x)*4,(y*info.width+x)*4+4);
  }
  const image=`${heading}/right-${mode}.png`,joint=mode==='forearm'?'rightElbow':'rightWrist',anchor=d.joints[joint].cell;
  await sharp(pixels,{raw:info}).png().toFile(new URL(image,output).pathname);
  parts.push({id:`right-${mode}`,layer:mode==='forearm'?original.layer:'hand-front',joint,image,
   restTopLeft:original.restTopLeft,pivot:anchor.map((v,i)=>v-original.restTopLeft[i]),size:[info.width,info.height],
   zOrder:original.zOrder,...(mode==='natural-hand'?{variant:'empty-hand',absoluteAngleFrom:'rightElbow'}:{})});
 }
 const sc=staffRegs.frames.find(f=>f.name===`walk/weapon-staff/${heading}/00`).crop,
  hc=handRegs.frames.find(f=>f.frame===`walk/hand-grip/${heading}/00`).sourceCrop,
  handScale=.025,staffScale=.5,row=order.indexOf(heading),
  shaft=[(row>=6?116:114)-sc.x,row*221.75+(row===7?133:row===2||row===4?135:134)-sc.y],
  offset=points.palm.map((v,i)=>(v-points.wrist[i])*handScale),
  gripPivot=points.wrist.map(v=>v*handScale),staffPivot=shaft.map((v,i)=>v*staffScale-offset[i]);
 const near=d.nearSide==='right'||d.nearSide==='both';
 for(const[id,layer,bytes,pivot]of [
  ['right-hand-grip','hand-grip',await crop(source.hand,hc,handScale),gripPivot],
  ['staff',near?'weapon-staff-front':'weapon-staff-back',await crop(source.staff,sc,staffScale),staffPivot],
 ]){
  const image=`${heading}/${id}.png`,m=await sharp(bytes).metadata();
  await writeFile(new URL(image,output),bytes);
  parts.push({id,layer,joint:'rightWrist',image,pivot,restTopLeft:wrist.map((v,i)=>v-pivot[i]),size:[m.width,m.height],
   zOrder:0,variant:'staff',gripOffset:offset,absoluteAngleFrom:'explicit-right-wrist-pose'});
 }
 report.directions[heading]={replaceIds:['right-forearm-hand'],attachments:parts,wristCell:wrist,gripOffset:offset,
  sourceRegistration:{staffCrop:sc,shaft,handCrop:hc,wrist:points.wrist,grip:points.palm},handScale,staffScale,
  naturalHandExclusiveWithGrip:true,clippingPlane:{normal:vector.map(v=>v/length),wrist,offset:.7}};
 for(const[row,weapon]of ['empty','staff'].entries()){
  const all=[...d.attachments.filter(a=>a.id!==original.id).map(a=>({...a,root:new URL('attachments-six-directions/',import.meta.url)})),
   ...parts.filter(a=>!a.variant||a.variant===(weapon==='empty'?'empty-hand':'staff')).map(a=>({...a,root:output})),
   ...clothes.directions[heading].map(a=>({...a,root:new URL('equipment-warden-additional/',import.meta.url)})),
   ...hair.directions[heading].filter(a=>a.layer.includes('midnight')).map(a=>({...a,root:new URL('equipment-hair-additional/',import.meta.url)}))];
  const depth={'weapon-staff-back':-110,'hair-midnight-back':-100,body:0,'outfit-warden':50,'weapon-staff-front':75,
   'body-front':100,'outfit-warden-front':125,'hand-front':140,'hand-grip':140,'hair-midnight-front':150};
  all.sort((a,b)=>depth[a.layer]+a.zOrder-depth[b.layer]-b.zOrder);
  const image=await sharp({create:{width:192,height:192,channels:4,background:'#00000000'}}).composite(
   await Promise.all(all.map(async a=>({input:await readFile(new URL(a.image,a.root)),left:Math.round(a.restTopLeft[0]),top:Math.round(a.restTopLeft[1])})))).png().toBuffer();
  views.push({input:image,left:column*192,top:row*192});
 }
}
await writeFile(new URL('attachments.json',output),JSON.stringify(report,null,2)+'\n');
await sharp({create:{width:1152,height:384,channels:4,background:'#d5dfd9'}}).composite(views).png()
 .toFile(new URL('staff-additional-directions-preview.png',import.meta.url).pathname);
