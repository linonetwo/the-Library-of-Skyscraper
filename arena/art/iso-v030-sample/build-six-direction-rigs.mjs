import sharp from 'sharp';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
const norm=JSON.parse(await readFile(new URL('direction-prototypes/registration.json',import.meta.url),'utf8'));
const output=new URL('attachments-six-directions/',import.meta.url);
await mkdir(output,{recursive:true});
const specs={
  E:{forward:[Math.SQRT1_2,-Math.SQRT1_2],near:'right',shoulders:[[99,81],[94,87]],
    torso:[[253,117],[280,125],[302,153],[309,220],[291,281],[244,282],[247,220],[245,150]],
    arms:[[[650,174],[644,267],[646,347]],[[843,174],[845,267],[848,347]]],
    legs:[[[1147,180],[1140,280],[1135,382],[1160,425]],[[1370,180],[1363,280],[1358,382],[1383,425]]]},
  W:{forward:[-Math.SQRT1_2,Math.SQRT1_2],near:'left',shoulders:[[99,87],[94,81]],
    torso:[[260,631],[278,642],[286,687],[281,736],[289,789],[238,790],[227,738],[232,671]],
    arms:[[[647,687],[645,785],[642,873]],[[843,689],[845,789],[848,873]]],
    legs:[[[1143,699],[1142,795],[1140,902],[1113,940]],[[1370,699],[1369,795],[1367,902],[1340,940]]]},
  N:{forward:[-Math.SQRT1_2,-Math.SQRT1_2],near:'none',shoulders:[[86,83],[106,83]],
    torso:[[231,110],[285,110],[300,142],[292,200],[308,272],[294,289],[217,289],[210,272],[227,200],[216,142]],
    arms:[[[681,145],[669,250],[646,346]],[[853,145],[870,250],[883,346]]],
    legs:[[[1160,140],[1163,270],[1170,385],[1169,438]],[[1340,140],[1343,270],[1350,385],[1349,438]]]},
  S:{forward:[Math.SQRT1_2,Math.SQRT1_2],near:'both',shoulders:[[108,86],[84,86]],
    torso:[[235,631],[283,631],[301,659],[292,709],[307,781],[293,798],[218,798],[212,780],[226,710],[218,660]],
    arms:[[[300,645],[312,717],[321,775]],[[212,645],[201,715],[190,773]]],
    armRegions:[[294,628,52,180],[174,628,52,180]],
    legs:[[[284,773],[291,854],[298,934],[303,993]],[[236,773],[226,852],[220,934],[214,994]]],
    legRegions:[[262,755,88,269],[175,755,87,269]],bootScale:.16},
  NW:{forward:[-1,0],near:'left',shoulders:[[87,87],[104,81]],
    torso:[[280,102],[320,93],[349,124],[340,189],[350,268],[330,299],[252,292],[248,260],[260,203],[249,144]],
    arms:[[[690,150],[663,255],[635,364]],[[850,150],[855,258],[863,366]]],
    legs:[[[1200,148],[1185,278],[1175,410],[1170,465]],[[1380,148],[1365,278],[1355,410],[1350,465]]]},
  SE:{forward:[1,0],near:'right',shoulders:[[87,81],[104,87]],
    torso:[[267,617],[302,620],[328,644],[330,710],[329,750],[344,790],[310,809],[254,803],[246,768],[249,699],[246,648]],
    arms:[[[690,669],[663,777],[635,883]],[[850,668],[855,776],[863,882]]],
    legs:[[[1200,660],[1185,791],[1175,921],[1190,985]],[[1380,660],[1365,791],[1355,921],[1370,985]]]},
};
const project=(x,y,z=0)=>[64*(x-y),32*(x+y)-78.38367177*z];
const inPolygon=(x,y,poly)=>{
  let inside=false;
  for(let i=0,j=poly.length-1;i<poly.length;j=i++){
    const [xi,yi]=poly[i],[xj,yj]=poly[j];
    if((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)inside=!inside;
  }
  return inside;
};
const rig={schemaVersion:1,status:'registered-neutral-prototype',releaseApproved:false,walkApproved:false,
  cell:[192,192],groundPivot:[96,172.8],ground:[96,172.8],renderScale:1,
  worldLeg:{upper:.3187701178,lower:.3060520193,ankleZ:.11,standingHipZ:.7348221371,walkHipZ:.66,trackWidth:.18},
  camera:{yaw:45,elevation:30,zScale:78.38367177},directions:{}};
const preview=[];
for(const [direction,s]of Object.entries(specs)) {
  const n=norm.directions[direction],row=['W','S','SE'].includes(direction)?1:0;
  await mkdir(new URL(`${direction}/`,output),{recursive:true});
  const source=await readFile(new URL(`../source/${n.source}`,import.meta.url));
  const {data,info}=await sharp(source).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const absolute={root:[96,172.8],pelvis:[96,120],neck:n.parts[1].targetAnchor};
  const attachments=[];
  const save=async(id,layer,joint,image,topLeft,extra={})=>{
    const path=`${direction}/${id}.png`,m=await sharp(image).metadata();
    await writeFile(new URL(path,output),image);
    attachments.push({id,layer,joint,image:path,restTopLeft:topLeft,
      pivot:[absolute[joint][0]-topLeft[0],absolute[joint][1]-topLeft[1]],
      size:[m.width,m.height],zOrder:0,...extra});
  };
  const head=n.parts.find(p=>p.id==='head');
  await save('head','body','neck',await readFile(new URL(`direction-prototypes/${head.image}`,import.meta.url)),
    head.placement,{zOrder:20,sourcePart:head});
  const body=n.parts.find(p=>p.id==='body'),b=Buffer.from(data);
  let x0=info.width,y0=info.height,x1=-1,y1=-1;
  for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++){
    const p=(y*info.width+x)*4;
    if(!inPolygon(x,y,s.torso)||b[p+3]<=8)b.fill(0,p,p+4);
    if(b[p+3]){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}
  }
  const torsoWidthFit=1;
  const torso=await sharp(b,{raw:info}).extract({left:x0,top:y0,width:x1-x0+1,height:y1-y0+1})
    .resize({width:Math.round((x1-x0+1)*body.scale*torsoWidthFit),
      height:Math.round((y1-y0+1)*body.scale),fit:'fill'}).png().toBuffer();
  const torsoTL=[96+(x0-body.sourceAnchor[0])*body.scale*torsoWidthFit,172.8+(y0-body.sourceAnchor[1])*body.scale];
  await save('torso','body','pelvis',torso,torsoTL,{zOrder:10,sourcePolygon:s.torso,sourceScale:body.scale,
    torsoWidthFit,thicknessFitReviewPending:torsoWidthFit!==1});
  const feet={};
  for(const [i,side]of ['left','right'].entries()) {
    const cap=t=>t[0].toUpperCase()+t.slice(1),near=s.near===side||s.near==='both';
    for(const kind of ['arm','leg']){
      const arm=kind==='arm',points=arm?s.arms[i]:s.legs[i];
      const names=arm?['shoulder','elbow','wrist']:['hip','knee','ankle'];
      const targetLengths=arm?[19.7,16.7]:[24.98637,23.98948];
      let target;
      if(arm)target=s.shoulders[i];
      else {
        const sign=side==='left'?1:-1;
        const lateral=[s.forward[1]*.09*sign,-s.forward[0]*.09*sign];
        const p=project(...lateral,rig.worldLeg.standingHipZ);
        target=[96+p[0],172.8+p[1]];
      }
      absolute[side+cap(names[0])]=target;
      const scales=[];
      for(let k=0;k<2;k++){
        const v=[points[k+1][0]-points[k][0],points[k+1][1]-points[k][1]],
          scale=targetLengths[k]/Math.hypot(...v);
        scales.push(scale);
        absolute[side+cap(names[k+1])]=[target[0]+v[0]*scale,target[1]+v[1]*scale];
        target=absolute[side+cap(names[k+1])];
      }
      const region=(arm?s.armRegions:s.legRegions)?.[i]??[(arm?512:1024)+i*256,row*512,256,512];
      const partSpecs=[
        {id:arm?'upper-arm':'thigh',joint:side+cap(names[0]),from:region[1],to:points[1][1]+12,sourceJoint:points[0],scale:scales[0],z:near?4:0},
        {id:arm?'forearm-hand':'shin',joint:side+cap(names[1]),from:points[1][1]-12,to:arm?region[1]+region[3]:points[2][1]+10,sourceJoint:points[1],scale:scales[1],z:near?6:1},
      ];
      if(!arm)partSpecs.push({id:'boot',joint:side+'Ankle',from:points[2][1]-10,to:region[1]+region[3],sourceJoint:points[2],scale:s.bootScale??scales[1],z:near?7:2});
      for(const part of partSpecs) {
        const raw=Buffer.from(data);let ax=info.width,ay=info.height,bx=-1,by=-1;
        for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++){
          const p=(y*info.width+x)*4;
          if(x<region[0]||x>=region[0]+region[2]||y<part.from||y>=part.to||raw[p+3]<=8)raw.fill(0,p,p+4);
          if(raw[p+3]){ax=Math.min(ax,x);ay=Math.min(ay,y);bx=Math.max(bx,x);by=Math.max(by,y);}
        }
        const widthFit=direction==='S'?(arm?.7:part.id==='boot'?.9:.65):
          direction==='N'?(arm?.8:.65):['NW','SE'].includes(direction)?(arm?.85:.8):1;
        const piece=await sharp(raw,{raw:info}).extract({left:ax,top:ay,width:bx-ax+1,height:by-ay+1})
          .resize({width:Math.max(1,Math.round((bx-ax+1)*part.scale*widthFit)),
            height:Math.max(1,Math.round((by-ay+1)*part.scale)),fit:'fill'}).png().toBuffer();
        const a=absolute[part.joint],tl=[a[0]+(ax-part.sourceJoint[0])*part.scale*widthFit,a[1]+(ay-part.sourceJoint[1])*part.scale];
        await save(`${side}-${part.id}`,arm&&near?'body-front':'body',part.joint,piece,tl,{
          zOrder:part.z,sourceRect:[ax,ay,bx-ax+1,by-ay+1],sourceScale:part.scale,sourceJoint:part.sourceJoint,
          scaleMode:widthFit===1?'isotropic':'explicit-neutral-thickness-fit',widthFit,
          thicknessFitReviewPending:widthFit!==1});
      }
      if(!arm){
        const soleScale=s.bootScale??scales[1];
        const soleOffset=[(points[3][0]-points[2][0])*soleScale,(points[3][1]-points[2][1])*soleScale];
        absolute[side+'Foot']=[target[0]+soleOffset[0],target[1]+soleOffset[1]];
        feet[side]={joint:side+'Ankle',soleOffset,contactVerified:false};
      }
    }
  }
  const parents={root:null,pelvis:'root',neck:'pelvis'};
  for(const side of ['left','right'])Object.assign(parents,{
    [side+'Shoulder']:'neck',[side+'Elbow']:side+'Shoulder',[side+'Wrist']:side+'Elbow',
    [side+'Hip']:'pelvis',[side+'Knee']:side+'Hip',[side+'Ankle']:side+'Knee',[side+'Foot']:side+'Ankle'});
  const joints={};
  for(const [id,parent]of Object.entries(parents)){
    const a=absolute[id],p=parent?absolute[parent]:[96,172.8];
    joints[id]={parent,cell:a,restOffset:[a[0]-p[0],a[1]-p[1]]};
  }
  rig.directions[direction]={joints,feet,attachments,worldForward:s.forward,projectedWorldForward:project(...s.forward),
    source:n.source,sourceSha256:n.sourceSha256,nearSide:s.near,neutralOnly:true};
  const ordered=[...attachments].sort((a,b)=>(a.layer==='body-front'?100:0)+a.zOrder-(b.layer==='body-front'?100:0)-b.zOrder);
  const image=await sharp({create:{width:192,height:192,channels:4,background:'#00000000'}})
    .composite(await Promise.all(ordered.map(async a=>({input:await readFile(new URL(a.image,output)),
      left:Math.round(a.restTopLeft[0]),top:Math.round(a.restTopLeft[1])})))).png().toBuffer();
  preview.push({input:image,left:preview.length*192,top:0});
}
await writeFile(new URL('rig.json',output),JSON.stringify(rig,null,2)+'\n');
await sharp({create:{width:1152,height:192,channels:4,background:'#d5dfd9'}}).composite(preview).png()
  .toFile(new URL('six-direction-rig-preview.png',import.meta.url).pathname);
await sharp(preview[3].input).resize({width:576,kernel:'nearest'}).flatten({background:'#d5dfd9'}).png()
  .toFile(new URL('six-direction-s-seam-detail.png',import.meta.url).pathname);
