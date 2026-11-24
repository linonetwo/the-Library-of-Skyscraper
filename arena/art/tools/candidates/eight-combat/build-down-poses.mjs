import { readFile,writeFile,mkdir } from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {exportPoses} from '../../pose-export.mjs';
const root=path.dirname(fileURLToPath(import.meta.url)),read=async p=>JSON.parse(await readFile(p,'utf8'));
const base=path.resolve(root,'../eight-base/inputs/art'),rig=await read(base+'/attachments-six-directions/rig.json');
const template=await read(path.resolve(root,'../eight-base/inputs/ew-template.json'));
const original=await read(path.resolve(root,'../ne-sw-idle/pose.json'));
const grounded=await read(path.join(root,'grounded/manifest.json'));
const equip={};for(const kind of ['scholar','warden','hair','staff'])equip[kind]=await read(`${base}/equipment-${kind}-additional/attachments.json`);
const names=(process.argv[2]||'NE,SW,E,W,N,S,NW,SE').split(',');
const config={...structuredClone(template),action:'down',cell:[256,256],groundPivot:[128,204.8],frameCount:4,playback:'once',releaseApproved:false,status:'awaiting-ground-contact-visual-review',directions:{},reviewNotes:['Four projected joint phases; independent grounded anatomy/outfit/hair replace standing parts in impact and final phases.']};
delete config.cycleWorldStride;delete config.frameMs;
const add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]),mul=(v,k)=>v.map(n=>n*k),norm=v=>Math.hypot(...v),unit=v=>mul(v,1/norm(v));
const project=([x,y,z])=>[128+64*(x-y),204.8+32*(x+y)-78.38367177*z];
function ik(a,c,l1,l2,bend,preferred=[0,0,1]){
 const axis=unit(sub(c,a)),d=norm(sub(c,a));
 if(d>l1+l2||d<Math.abs(l1-l2))throw Error(`World limb unreachable ${d} / ${l1}+${l2}`);
 const along=(l1*l1-l2*l2+d*d)/(2*d),height=Math.sqrt(Math.max(0,l1*l1-along*along));
 const dot=preferred.reduce((n,v,i)=>n+v*axis[i],0),normal=unit(sub(preferred,mul(axis,dot)));
 return add(add(a,mul(axis,along)),mul(normal,height*bend));
}
for(const name of names){
 let d;
 if(name==='NE'||name==='SW'){
  d=structuredClone(original.directions[name]);
  for(const a of d.attachments)a.image=path.resolve(root,'../ne-sw-idle',a.image);
 }else{
  d=structuredClone(rig.directions[name]);d.attachments=d.attachments.map(a=>({...a,image:path.join(base,'attachments-six-directions',a.image)}));
  for(const k of ['scholar','warden','hair'])d.attachments.push(...equip[k].directions[name].map(a=>({...a,image:path.join(base,`equipment-${k}-additional`,a.image)})));
  const staff=equip.staff.directions[name];d.attachments=d.attachments.filter(a=>!staff.replaceIds.includes(a.id));
  d.attachments.push(...staff.attachments.map(a=>({...a,image:path.join(base,'equipment-staff-additional',a.image),...(a.absoluteAngleFrom?.endsWith('Elbow')?{angleJoint:a.absoluteAngleFrom}:{})})));
 }
 const sourceAttachments=d.attachments.slice(),hideStanding=sourceAttachments.filter(a=>['head','torso','coat'].includes(a.id)||/^(outfit|hair)-/.test(a.id)).map(a=>a.id);
 const g=grounded.directions[name],groundIds=[];
 for(const a of g.attachments){const id='grounded-'+a.id;groundIds.push(id);d.attachments.push({...a,id,image:path.resolve(root,'grounded',a.image)});}
 const heading=g.heading,side=[heading[1],-heading[0]],wp=(f,t,z)=>[heading[0]*f+side[0]*t,heading[1]*f+side[1]*t,z];
 d.poses=[];
 for(let frame=0;frame<4;frame++){
  const landed=frame>=2,hipZ=[.40,.23,.22,.12][frame],neckZ=[.91,.52,.32,.15][frame],neckF=[.03,.12,.42,.50][frame];
  const world={pelvis:wp(0,0,hipZ),neck:wp(neckF,0,neckZ)},jointAngles={},attachmentMappings={};
  for(const [s,sign]of [['left',1],['right',-1]]){
   world[s+'Hip']=wp(0,sign*.09,hipZ);
   const ankleF=[-.08,-.24,-.44,-.47][frame]+(s==='right'&&landed?(frame===2?.22:.09):0);
   world[s+'Ankle']=wp(ankleF,sign*.12,.10);
   world[s+'Knee']=ik(world[s+'Hip'],world[s+'Ankle'],.3187701178,.3060520193,1,[...heading,0]);
   world[s+'Foot']=wp(ankleF+.08,sign*.12,0);
   world[s+'Shoulder']=frame===3?g.shoulderWorld[s]:wp(neckF-.06,sign*.19,neckZ-.06);
   world[s+'Wrist']=wp([.10,.04,.25,.31][frame],sign*[.25,.30,.34,.39][frame],[.59,.025,.025,.025][frame]);
   world[s+'Elbow']=ik(world[s+'Shoulder'],world[s+'Wrist'],.252,.214,1,[side[0]*sign,side[1]*sign,0]);
  }
  const points=Object.fromEntries(Object.entries(world).map(([k,p])=>[k,project(p)]));
  if(frame===3){points.pelvis=g.hip;points.neck=g.neck;}
  for(const s of ['left','right'])for(const [a,b,part]of [['Hip','Knee','thigh'],['Knee','Ankle','shin'],['Shoulder','Elbow','upper-arm'],['Elbow','Wrist','forearm']]){
   const first=s+a,last=s+b,axis=d.joints[last].restOffset,target=sub(points[last],points[first]);
   jointAngles[first]=(Math.atan2(target[1],target[0])-Math.atan2(axis[1],axis[0]))*180/Math.PI;
   const ids=part==='forearm'?[s+'-forearm-hand',s+'-forearm',s+'-fore-sleeve']:part==='upper-arm'?[s+'-upper-arm',s+'-upper-sleeve']:[s+'-'+part];
   for(const id of ids)attachmentMappings[id]={axis,scale:norm(target)/norm(axis)};
  }
  const torso=sub(points.neck,points.pelvis),torsoAxis=d.joints.neck.restOffset;
  jointAngles.pelvis=landed?0:(Math.atan2(torso[1],torso[0])-Math.atan2(torsoAxis[1],torsoAxis[0]))*180/Math.PI;
  jointAngles.neck=landed?0:jointAngles.pelvis;
  for(const s of ['left','right']){
   const axis=d.feet[s].soleOffset,target=sub(points[s+'Foot'],points[s+'Ankle']);
   jointAngles[s+'Ankle']=(Math.atan2(target[1],target[0])-Math.atan2(axis[1],axis[0]))*180/Math.PI;
   attachmentMappings[s+'-boot']={axis,scale:norm(target)/norm(axis)};
   jointAngles[s+'Wrist']=jointAngles[s+'Elbow'];
  }
  const attachmentAngles={staff:landed?80:frame===1?35:0,'right-hand-grip':landed?80:frame===1?35:0};
  for(const a of d.attachments.filter(a=>a.id.startsWith('grounded-'))){
   const isHead=a.joint==='neck',sourceAxis=sub(isHead?g.crown:g.neck,isHead?g.neck:g.hip);
   const targetAxis=isHead?sub(project(wp(frame===2?.74:.82,0,frame===2?.38:.20)),points.neck):sub(points.neck,points.pelvis);
   attachmentAngles[a.id]=frame===2?(Math.atan2(targetAxis[1],targetAxis[0])-Math.atan2(sourceAxis[1],sourceAxis[0]))*180/Math.PI:0;
   if(frame===2)attachmentMappings[a.id]={axis:sourceAxis,scale:norm(targetAxis)/norm(sourceAxis)};
  }
  d.poses.push({durationMs:[150,180,180,600][frame],joints:{},jointPositions:points,jointAngles,attachmentMappings,attachmentAngles,hiddenAttachments:landed?hideStanding:groundIds,rootScreenDelta:[0,0],supportContacts:{phase:['knees-flex','support-palm','hip-shoulder-impact','grounded-hold'][frame],world,groundHeight:0}});
 }
 config.directions[name]=d;
}
config.layerOrderByDirection=(await read(path.resolve(root,'../eight-base/merged/idle/atlas-budget.json'))).layerOrderByDirection;
const output=path.join(root,'candidates',names.length===8?'eight':names.join('-').toLowerCase(),'down');await mkdir(output,{recursive:true});
for(const d of Object.values(config.directions))for(const a of d.attachments)a.image=path.relative(output,a.image);
const pose=path.join(output,'pose.json');await writeFile(pose,JSON.stringify(config,null,2)+'\n');await exportPoses(pose,output);
execFileSync(process.execPath,[path.resolve(root,'../../preview-looks.mjs'),pose,output],{stdio:'inherit'});
console.log('down',names.join(','),output);
