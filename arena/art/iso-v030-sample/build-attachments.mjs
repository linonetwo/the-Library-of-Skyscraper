import sharp from 'sharp';
import { readFile,writeFile,mkdir } from 'node:fs/promises';
import { poses,scale } from './build-static.mjs';
const source=await readFile(new URL('../source/iso-v030-body-sample.png',import.meta.url));
const out=new URL('attachments/',import.meta.url);
await mkdir(out,{recursive:true});
const json=value=>JSON.stringify(value,null,2)+'\n';
const inside=(x,y,polygon)=>{
  let hit=false;
  for(let i=0,j=polygon.length-1;i<polygon.length;j=i++) {
    const [xi,yi]=polygon[i],[xj,yj]=polygon[j];
    if((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)hit=!hit;
  }
  return hit;
};
const distance=(x,y,a,b)=>{
  const dx=b[0]-a[0],dy=b[1]-a[1];
  const t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy||1)));
  return Math.hypot(x-a[0]-t*dx,y-a[1]-t*dy);
};
const output={schemaVersion:1,status:'prototype',releaseApproved:false,
  source:'../source/iso-v030-body-sample.png',cell:[192,192],ground:[96,172.8],tile:[128,64],renderScale:1,
  anatomy:{heads:4,heightMeters:1.7},camera:{yaw:45,elevation:30,zScale:78.3837},
  directionConvention:'screen NE upper-right away; screen SW lower-left toward camera',
  sourcePoseOnly:true,walkApproved:false,
  notes:['Each direction independently cut from actual source; no mirroring.',
    'Rest joint offsets describe the frozen source pose, not a neutral straight-leg rig.',
    'Joint disks overlap only existing source pixels; hidden surfaces are NOT fabricated.',
    'Foot contacts, silhouette seams and inferred soles require live review; not release approved.'],
  directions:{}};
const previewComposites=[];
for(const [row,pose] of poses.entries()) {
  const dir=new URL(`${pose.direction}/`,out);await mkdir(dir,{recursive:true});
  const [left,top,width,height]=pose.sourceCell;
  const {data,info}=await sharp(source).extract({left,top,width,height}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  for(let p=0;p<data.length;p+=4)if(data[p+3]<=8)data.fill(0,p,p+4);
  const sourceJoints={root:pose.ground,pelvis:pose.pelvis,neck:pose.neck,...pose.joints};
  const parents={root:null,pelvis:'root',neck:'pelvis',
    leftShoulder:'neck',rightShoulder:'neck',leftElbow:'leftShoulder',rightElbow:'rightShoulder',
    leftWrist:'leftElbow',rightWrist:'rightElbow',leftHip:'pelvis',rightHip:'pelvis',
    leftKnee:'leftHip',rightKnee:'rightHip',leftAnkle:'leftKnee',rightAnkle:'rightKnee',
    leftFoot:'leftAnkle',rightFoot:'rightAnkle'};
  const px=Math.round(96-pose.ground[0]*scale),py=Math.round(172.8-pose.ground[1]*scale);
  const toCell=([x,y])=>[px+x*scale,py+y*scale];
  const cellJoints=Object.fromEntries(Object.entries(sourceJoints).map(([id,p])=>[id,toCell(p)]));
  cellJoints.root=[96,172.8];
  const joints=Object.fromEntries(Object.entries(cellJoints).map(([id,p])=>{
    const parent=parents[id],origin=parent?cellJoints[parent]:[96,172.8];
    return [id,{parent,restOffset:[p[0]-origin[0],p[1]-origin[1]],cell:p}];
  }));
  const near=pose.direction==='NE'?'right':'left';
  const torso=pose.direction==='NE'
    ?[[160,130],[202,134],[215,155],[220,214],[231,258],[228,282],[207,299],[166,296],[144,273],[143,241],[154,216],[149,164]]
    :[[151,143],[193,143],[223,163],[224,208],[230,239],[238,267],[234,287],[214,300],[174,296],[146,273],[145,248],[156,215],[145,176]];
  const parts=[
    {id:'head',joint:'neck',layer:'body',zOrder:6},
    {id:'torso',joint:'pelvis',layer:'body',zOrder:3},
  ];
  for(const side of ['left','right']) {
    const armLayer=side===near?'body-front':'body';
    parts.push(
      {id:`${side}-upper-arm`,joint:`${side}Shoulder`,end:`${side}Elbow`,layer:armLayer,zOrder:side===near?9:1},
      {id:`${side}-forearm-hand`,joint:`${side}Elbow`,end:`${side}Wrist`,layer:armLayer,zOrder:side===near?10:2},
      {id:`${side}-thigh`,joint:`${side}Hip`,end:`${side}Knee`,layer:'body',zOrder:side===near?5:0},
      {id:`${side}-shin`,joint:`${side}Knee`,end:`${side}Ankle`,layer:'body',zOrder:side===near?5.1:.1},
      {id:`${side}-boot`,joint:`${side}Ankle`,end:`${side}Foot`,layer:'body',zOrder:side===near?5.2:.2},
    );
  }
  const masks=parts.map(()=>Buffer.alloc(data.length));
  for(let y=0;y<height;y++)for(let x=0;x<width;x++) {
    const pixel=(y*width+x)*4;if(!data[pixel+3])continue;
    let owner;
    if(y<pose.neck[1]-5)owner=0;
    else if(inside(x+.5,y+.5,torso))owner=1;
    else {
      let best=Infinity;owner=1;
      for(let i=2;i<parts.length;i++) {
        const part=parts[i],a=sourceJoints[part.joint],b=sourceJoints[part.end];
        const d=distance(x+.5,y+.5,a,b);
        if(d<best){best=d;owner=i;}
      }
    }
    data.copy(masks[owner],pixel,pixel,pixel+4);
    // Existing joint surface overlap only: no clone-filled unseen elbow/hip art.
    for(let i=2;i<parts.length;i++) {
      const a=sourceJoints[parts[i].joint],b=sourceJoints[parts[i].end];
      if(Math.min(Math.hypot(x-a[0],y-a[1]),Math.hypot(x-b[0],y-b[1]))<7)
        data.copy(masks[i],pixel,pixel,pixel+4);
    }
  }
  const attachments=[];
  for(const [index,part] of parts.entries()) {
    const full=await sharp(masks[index],{raw:info}).resize(width*scale,height*scale).png().toBuffer();
    const {data:scaled,info:si}=await sharp(full).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    let x0=si.width,y0=si.height,x1=-1,y1=-1;
    for(let y=0;y<si.height;y++)for(let x=0;x<si.width;x++)if(scaled[(y*si.width+x)*4+3]>0){
      x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);
    }
    if(x1<0)throw new Error(`Empty attachment ${pose.direction}/${part.id}`);
    const image=await sharp(full).extract({left:x0,top:y0,width:x1-x0+1,height:y1-y0+1}).png().toBuffer();
    await writeFile(new URL(`${part.id}.png`,dir),image);
    const p=cellJoints[part.joint];
    attachments.push({...part,image:`${pose.direction}/${part.id}.png`,
      pivot:[p[0]-px-x0,p[1]-py-y0],restTopLeft:[px+x0,py+y0],size:[x1-x0+1,y1-y0+1],
      sourceCell:pose.sourceCell,sourceJoint:sourceJoints[part.joint],sourceScale:scale});
  }
  output.directions[pose.direction]={
    joints,attachments,
    feet:{
      left:{joint:'leftAnkle',soleOffset:[cellJoints.leftFoot[0]-cellJoints.leftAnkle[0],cellJoints.leftFoot[1]-cellJoints.leftAnkle[1]],contactVerified:false},
      right:{joint:'rightAnkle',soleOffset:[cellJoints.rightFoot[0]-cellJoints.rightAnkle[0],cellJoints.rightFoot[1]-cellJoints.rightAnkle[1]],contactVerified:false},
    },
    projectedWorldForward:pose.direction==='NE'?[64,-32]:[-64,32],
  };
  const sorted=[...attachments].sort((a,b)=>(a.layer==='body-front'?100:0)+a.zOrder-(b.layer==='body-front'?100:0)-b.zOrder);
  const composite=await sharp({create:{width:192,height:192,channels:4,background:'#00000000'}})
    .composite(await Promise.all(sorted.map(async a=>({input:await readFile(new URL(a.image,out)),left:a.restTopLeft[0],top:a.restTopLeft[1]})))).png().toBuffer();
  previewComposites.push({input:composite,left:row*192,top:0});
}
await writeFile(new URL('rig.json',out),json(output));
await sharp({create:{width:384,height:192,channels:4,background:'#d5dfd9'}})
  .composite(previewComposites).png().toFile(new URL('attachments-rest-preview.png',import.meta.url).pathname);
console.log('Exported independently registered NE/SW source attachments; contact/pose approval pending.');
