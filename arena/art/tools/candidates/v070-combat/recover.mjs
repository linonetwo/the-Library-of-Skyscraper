import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url)),read=async file=>JSON.parse(await readFile(file,'utf8'));
const add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]),mul=(a,k)=>a.map(v=>v*k),len=a=>Math.hypot(...a),unit=a=>mul(a,1/len(a));
const project=([x,y,z])=>[128+64*(x-y),204.8+32*(x+y)-78.38367177*z];
function elbow(a,b,l1,l2,preferred){const delta=sub(b,a),d=len(delta),u=unit(delta);if(d>l1+l2||d<Math.abs(l1-l2))throw Error(`Recover unreachable ${d}/${l1}+${l2}`);const along=(l1*l1-l2*l2+d*d)/(2*d),v=unit(sub(preferred,mul(u,preferred.reduce((n,x,i)=>n+x*u[i],0))));return add(add(a,mul(u,along)),mul(v,Math.sqrt(Math.max(0,l1*l1-along*along))));}
/** Keep the exact down final frame, then author independent palm/knee/foot load transfer. */
export async function recoverConfig(){
 const source=path.join(here,'../eight-combat/candidates/eight/down/pose.json'),config=await read(source),carryFile=path.join(here,'../ne-sw-carry/pose.json'),carry=await read(carryFile),manifestFile=path.join(here,'../../../iso-v050-mobility/climb-hands/revised/manifest.json'),manifest=await read(manifestFile);
 config.directions=Object.fromEntries(['NE','SW'].map(n=>[n,config.directions[n]]));
 Object.assign(config,{action:'recover',frameCount:8,playback:'once',releaseApproved:false,status:'v070-two-direction-unreviewed-pilot'});
 delete config.sourcePoseOnly;
 for(const [name,d] of Object.entries(config.directions)){
  for(const a of d.attachments)a.image=path.resolve(path.dirname(source),a.image);
  const hand=manifest.directions[name].leftBrace;d.supportPalmRegistration=hand;
  const fore=structuredClone(carry.directions[name].attachments.find(a=>a.id==='left-forearm'));fore.image=path.resolve(path.dirname(carryFile),fore.image);fore.id='recover-left-forearm';
  d.attachments.push(fore,{id:'recover-support-palm',joint:'leftWrist',layer:'hand-support',pivot:hand.wristPivot,image:path.resolve(path.dirname(manifestFile),hand.image),zOrder:30});
  config.layerOrderByDirection[name]=[...config.layerOrderByDirection[name],'hand-support'];
  const final=structuredClone(d.poses[3]),groundIds=d.attachments.filter(a=>a.id.startsWith('grounded-')).map(a=>a.id),standing=final.hiddenAttachments;
  const h=d.worldForward,side=[h[1],-h[0]],wp=(f,l,z)=>[h[0]*f+side[0]*l,h[1]*f+side[1]*l,z];
  const hipZ=[.12,.16,.23,.35,.46,.60,.69,.70],neckZ=[.15,.30,.52,.82,.98,1.10,1.21,1.22],neckF=[.50,.44,.26,.12,.08,.04,0,0],ankleF=[-.47,-.40,-.24,-.10,-.10,-.10,-.10,-.10];
  const idle=await read(path.join(here,'../ne-sw-idle/pose.json'));
  const poses=[{...final,durationMs:140,hiddenAttachments:[...final.hiddenAttachments,'recover-left-forearm','recover-support-palm']}];
  for(let frame=1;frame<8;frame++){
   const world={pelvis:wp(0,0,hipZ[frame]),neck:wp(neckF[frame],0,neckZ[frame])};
   for(const [s,sign] of [['left',1],['right',-1]]){
    world[s+'Hip']=wp(0,sign*.09,hipZ[frame]);world[s+'Ankle']=wp(ankleF[frame]+(s==='right'&&frame<3?.10:0),sign*.12,.10);
    world[s+'Knee']=elbow(world[s+'Hip'],world[s+'Ankle'],.3187701178,.3060520193,[...h,0]);world[s+'Foot']=wp(ankleF[frame]+.08+(s==='right'&&frame<3?.10:0),sign*.12,0);
    world[s+'Shoulder']=wp(neckF[frame]-.06,sign*.19,neckZ[frame]-.06);
    world[s+'Wrist']=s==='left'&&frame<=2?wp(.31,.30,.025):wp(neckF[frame]+.08,sign*.27,Math.max(.22,neckZ[frame]-.35));
    try{world[s+'Elbow']=elbow(world[s+'Shoulder'],world[s+'Wrist'],.252,.214,[side[0]*sign,side[1]*sign,-.1]);}catch(e){throw Error(name+'/'+frame+'/'+s+': '+e.message);}
   }
   const points=Object.fromEntries(Object.entries(world).map(([id,p])=>[id,project(p)])),jointAngles={},attachmentMappings={};
   for(const s of ['left','right'])for(const [a,b,part] of [['Hip','Knee','thigh'],['Knee','Ankle','shin'],['Shoulder','Elbow','upper-arm'],['Elbow','Wrist','forearm']]){
    const axis=d.joints[s+b].restOffset,target=sub(points[s+b],points[s+a]);jointAngles[s+a]=(Math.atan2(target[1],target[0])-Math.atan2(axis[1],axis[0]))*180/Math.PI;
    const ids=part==='forearm'?[s+'-forearm-hand',s+'-forearm',s+'-fore-sleeve',...(s==='left'?['recover-left-forearm']:[])]:part==='upper-arm'?[s+'-upper-arm',s+'-upper-sleeve']:[s+'-'+part];for(const id of ids)attachmentMappings[id]={axis,scale:len(target)/len(axis)};
   }
   const axis=d.joints.neck.restOffset,target=sub(points.neck,points.pelvis);jointAngles.pelvis=(Math.atan2(target[1],target[0])-Math.atan2(axis[1],axis[0]))*180/Math.PI;jointAngles.neck=0;
   const landed=frame===1,attachmentAngles={staff:[80,65,40,25,15,8,3,0][frame],'right-hand-grip':[80,65,40,25,15,8,3,0][frame]};
   for(const s of ['left','right']){const sole=d.feet[s].soleOffset,v=sub(points[s+'Foot'],points[s+'Ankle']);jointAngles[s+'Ankle']=(Math.atan2(v[1],v[0])-Math.atan2(sole[1],sole[0]))*180/Math.PI;attachmentMappings[s+'-boot']={axis:sole,scale:len(v)/len(sole)};jointAngles[s+'Wrist']=jointAngles[s+'Elbow'];}
   const g=await read(path.join(here,'../eight-combat/grounded/manifest.json')),ground=g.directions[name];
   for(const a of d.attachments.filter(a=>a.id.startsWith('grounded-'))){const head=a.joint==='neck',from=sub(head?ground.crown:ground.neck,head?ground.neck:ground.hip);if(!head){attachmentAngles[a.id]=(Math.atan2(target[1],target[0])-Math.atan2(from[1],from[0]))*180/Math.PI;attachmentMappings[a.id]={axis:from,scale:len(target)/len(from)};}else attachmentAngles[a.id]=0;}
   const hidden=[...(landed?standing:groundIds),...(frame<=2?['left-forearm-hand']:['recover-left-forearm','recover-support-palm'])];
   const pose={durationMs:140,joints:{},jointPositions:points,jointAngles,attachmentMappings,attachmentAngles,hiddenAttachments:hidden,rootScreenDelta:[0,0],supportContacts:{phase:frame<=2?'support-palm':frame<=5?'load-feet':'stand',world,feet:frame>=3?['left','right']:[],supportPalm:frame<=2?'left':undefined}};
   if(frame<=2){const normal=hand.wristTowardElbow,v=sub(points.leftElbow,points.leftWrist);attachmentAngles['recover-support-palm']=(Math.atan2(v[1],v[0])-Math.atan2(normal[1],normal[0]))*180/Math.PI;}
   poses.push(pose);
  }
  poses[7]={...structuredClone(idle.directions[name].poses[0]),durationMs:140,hiddenAttachments:[...groundIds,'recover-left-forearm','recover-support-palm'],supportContacts:{phase:'idle-join',feet:['left','right']}};
  for(const target of Object.values(poses[7].wristTargets??{}))target.point=target.point.map(v=>v+32);
  d.poses=poses;
 }
 for(const layers of Object.values(config.previewLooks))layers.push('hand-support');
 config.previewLooks={'warden-midnight-staff':config.previewLooks['warden-midnight-staff']};config.previewLayers=config.previewLooks['warden-midnight-staff'];
 return config;
}
