import sharp from 'sharp';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const original=JSON.parse(await readFile(new URL('attachments/rig.json',import.meta.url),'utf8'));
const source=await readFile(new URL('../source/iso-v030-complete-limbs.png',import.meta.url));
const out=new URL('attachments-complete/',import.meta.url);
await mkdir(out,{recursive:true});
const sourceInfo=await sharp(source).metadata();
if(sourceInfo.width!==1536||sourceInfo.height!==1024)throw new Error('Review source grid before changing dimensions.');
const bodyFrames=JSON.parse(await readFile(new URL('../../client/public/assets/iso-v030-sample/registration.json',import.meta.url),'utf8'));
const coordinates={
  NE:{
    leftArm:{column:0,scale:.18,shoulder:[205,143],elbow:[174,248],wrist:[138,333]},
    rightArm:{column:1,scale:.18,shoulder:[175,143],elbow:[207,248],wrist:[241,333]},
    leftLeg:{column:2,scale:.14,hip:[194,51],knee:[181,229],ankle:[170,400],sole:[181,463]},
    rightLeg:{column:3,scale:.14,hip:[194,51],knee:[181,229],ankle:[170,400],sole:[181,463]},
  },
  SW:{
    leftArm:{column:0,scale:.18,shoulder:[216,143],elbow:[183,246],wrist:[147,336]},
    rightArm:{column:1,scale:.18,shoulder:[215,143],elbow:[183,246],wrist:[147,336]},
    leftLeg:{column:2,scale:.14,hip:[195,47],knee:[197,220],ankle:[194,385],sole:[180,469]},
    rightLeg:{column:3,scale:.14,hip:[195,47],knee:[197,220],ankle:[194,385],sole:[180,469]},
  },
};
const rig={
  schemaVersion:1,status:'prototype',releaseApproved:false,walkApproved:false,sourcePoseOnly:false,
  source:'arena/art/source/iso-v030-complete-limbs.png',
  sourceSha256:createHash('sha256').update(source).digest('hex'),
  sourceGeneration:'GPT Image 2 proxy-imagegen; first attempt success; text-only; no reference upload',
  cell:[192,192],groundPivot:[96,172.8],ground:[96,172.8],renderScale:1,tile:[128,64],
  camera:{yaw:45,elevation:30,zScale:78.3837},action:'walk',
  previewLayers:['hair-ivory-back','body','outfit-scholar','body-front','hair-ivory-front'],
  notes:[
    'Complete limbs are new independent source attachments, not elongated old foreshortened sprites.',
    'Hip articular center is 10px above old crotch landmark, beneath torso overlap; torso/head unchanged.',
    'Left/right limb sources are independent cells with equal registered length; no whole-body mirroring.',
    'Near/far shading, knee seams, support contacts and pose loop still require visual approval.',
  ],directions:{},
};
const preview=[];
for(const [row,direction]of ['NE','SW'].entries()) {
  await mkdir(new URL(`${direction}/`,out),{recursive:true});
  const previous=original.directions[direction];
  const joints=structuredClone(previous.joints);
  const attachments=[];
  const hips=bodyFrames.frames.find(f=>f.direction===direction).joints;
  for(const id of ['head','torso']) {
    const a=previous.attachments.find(a=>a.id===id), image=await readFile(new URL(`attachments/${a.image}`,import.meta.url));
    await writeFile(new URL(a.image,out),image);
    attachments.push({...a,sourceSet:'camera-body'});
  }
  const near=direction==='NE'?'right':'left';
  const absolute=Object.fromEntries(Object.entries(joints).map(([id,j])=>[id,[...j.cell]]));
  for(const side of ['left','right']) {
    for(const kind of ['Arm','Leg']) {
      const c=coordinates[direction][`${side}${kind}`],isArm=kind==='Arm';
      const first=isArm?'shoulder':'hip',middle=isArm?'elbow':'knee',last=isArm?'wrist':'ankle';
      const name=p=>side+p[0].toUpperCase()+p.slice(1);
      const target=[...hips[name(first)]];
      if(!isArm)target[1]-=10;
      const point=p=>[target[0]+(p[0]-c[first][0])*c.scale,target[1]+(p[1]-c[first][1])*c.scale];
      for(const joint of [first,middle,last])absolute[name(joint)]=point(c[joint]);
      if(!isArm)absolute[`${side}Foot`]=point(c.sole);
      const {data,info}=await sharp(source).extract({left:c.column*384,top:row*512,width:384,height:512})
        .ensureAlpha().raw().toBuffer({resolveWithObject:true});
      for(let p=0;p<data.length;p+=4)if(data[p+3]<=8)data.fill(0,p,p+4);
      const parts=isArm?[
        {id:`${side}-upper-arm`,joint:name(first),from:0,to:c[middle][1]+7,z:side===near?9:1},
        {id:`${side}-forearm-hand`,joint:name(middle),from:c[middle][1]-7,to:512,z:side===near?10:2},
      ]:[
        {id:`${side}-thigh`,joint:name(first),from:0,to:c[middle][1]+8,z:side===near?2:0},
        {id:`${side}-shin`,joint:name(middle),from:c[middle][1]-8,to:c[last][1]+7,z:side===near?5.1:.1},
        {id:`${side}-boot`,joint:name(last),from:c[last][1]-7,to:512,z:side===near?5.2:.2},
      ];
      for(const part of parts) {
        const pixels=Buffer.from(data);
        let x0=384,y0=512,x1=-1,y1=-1;
        for(let y=0;y<512;y++)for(let x=0;x<384;x++) {
          const p=(y*384+x)*4;
          if(y<part.from||y>part.to)pixels.fill(0,p,p+4);
          if(pixels[p+3]){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}
        }
        const image=await sharp(pixels,{raw:info}).extract({left:x0,top:y0,width:x1-x0+1,height:y1-y0+1})
          .resize({width:Math.max(1,Math.round((x1-x0+1)*c.scale))}).png().toBuffer();
        const imageInfo=await sharp(image).metadata(),tl=point([x0,y0]);
        const anchor=absolute[part.joint];
        const a={
          id:part.id,joint:part.joint,layer:isArm&&side===near?'body-front':'body',zOrder:part.z,
          image:`${direction}/${part.id}.png`,pivot:[anchor[0]-tl[0],anchor[1]-tl[1]],
          restTopLeft:tl,size:[imageInfo.width,imageInfo.height],
          sourceCell:[c.column*384,row*512,384,512],sourceCrop:[x0,y0,x1-x0+1,y1-y0+1],
          sourceScale:c.scale,sourceSet:'complete-limbs',
        };
        await writeFile(new URL(a.image,out),image);attachments.push(a);
      }
    }
  }
  for(const [id,j]of Object.entries(joints)) {
    const a=absolute[id],p=j.parent?absolute[j.parent]:[96,172.8];
    j.cell=a;j.restOffset=[a[0]-p[0],a[1]-p[1]];
  }
  for(const [layer,joint]of [['outfit-scholar','pelvis'],['hair-ivory-back','neck'],['hair-ivory-front','neck']]) {
    const atlas=await readFile(new URL(`../../client/public/assets/iso-v030-sample/${layer}.png`,import.meta.url));
    const image=await sharp(atlas).extract({left:row*196+2,top:2,width:192,height:192}).png().toBuffer();
    const a={id:layer,layer,joint,zOrder:0,image:`${direction}/${layer}.png`,
      pivot:absolute[joint],restTopLeft:[0,0],size:[192,192],sourceSet:'scholar-ivory'};
    await writeFile(new URL(a.image,out),image);attachments.push(a);
  }
  const feet={};
  for(const side of ['left','right'])feet[side]={
    joint:`${side}Ankle`,soleOffset:[absolute[`${side}Foot`][0]-absolute[`${side}Ankle`][0],absolute[`${side}Foot`][1]-absolute[`${side}Ankle`][1]],
    bend:direction==='NE'?1:-1,contactVerified:false,
  };
  rig.directions[direction]={joints,attachments,feet,
    worldForward:direction==='NE'?[0,-1]:[0,1],
    projectedWorldForward:direction==='NE'?[64,-32]:[-64,32],
    legLengthReport:Object.fromEntries(['left','right'].map(side=>[side,{
      thigh:Math.hypot(...joints[`${side}Knee`].restOffset),shin:Math.hypot(...joints[`${side}Ankle`].restOffset),
    }])),
  };
  const layerDepth={'hair-ivory-back':-100,body:0,'outfit-scholar':50,'body-front':100,'hair-ivory-front':150};
  const sorted=[...attachments].sort((a,b)=>layerDepth[a.layer]+a.zOrder-layerDepth[b.layer]-b.zOrder);
  const input=await sharp({create:{width:192,height:192,channels:4,background:'#00000000'}})
    .composite(await Promise.all(sorted.map(async a=>({input:await readFile(new URL(a.image,out)),left:Math.round(a.restTopLeft[0]),top:Math.round(a.restTopLeft[1])}))))
    .png().toBuffer();
  preview.push({input,left:row*192,top:0});
}
await writeFile(new URL('rig.json',out),JSON.stringify(rig,null,2)+'\n');
await sharp({create:{width:384,height:192,channels:4,background:'#d5dfd9'}}).composite(preview).png()
  .toFile(new URL('complete-limbs-rest-preview.png',import.meta.url).pathname);
console.log('Built full-length direction-specific limb rig, pose/contact approval pending.');
