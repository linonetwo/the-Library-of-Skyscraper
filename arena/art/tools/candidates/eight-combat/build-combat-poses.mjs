import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { exportPoses } from '../../pose-export.mjs';
const here=path.dirname(fileURLToPath(import.meta.url));
const base=path.resolve(here,'../eight-base/inputs/art');
const read=async p=>JSON.parse(await readFile(p,'utf8'));
const template=await read(path.resolve(here,'../eight-base/inputs/ew-template.json'));
const rig=await read(base+'/attachments-six-directions/rig.json');
const orders=(await read(path.resolve(here,'../eight-base/merged/idle/atlas-budget.json'))).layerOrderByDirection;
const equipment={};
for(const kind of ['scholar','warden','hair','staff']) equipment[kind]=await read(`${base}/equipment-${kind}-additional/attachments.json`);
const selected=(process.argv[2]||'E,W,N,S,NW,SE').split(',');
for(const action of (process.argv[3]||'attack,hit').split(',')) {
 const config=structuredClone(template);
 Object.assign(config,{action,directions:{},playback:'once',releaseApproved:false,status:'awaiting-combat-visual-review',frameCount:action==='attack'?4:2});
 delete config.cycleWorldStride; delete config.frameMs;
 config.layerOrderByDirection=Object.fromEntries(selected.map(n=>[n,orders[n]]));
 config.reviewNotes=['Direction-specific joint-driven combat candidate; awaiting independent visual acceptance.'];
 config.worldRegistration.hipZ=.70;
 if(action==='attack')config.unarmedPresentation='open-hand gesture candidate; not a completed unarmed punch';
 const durations=action==='attack'?[150,90,180,180]:[120,240];
 for(const name of selected){
  const d=structuredClone(rig.directions[name]);
  d.attachments=d.attachments.map(a=>({...a,image:path.join(base,'attachments-six-directions',a.image)}));
  for(const kind of ['scholar','warden','hair'])d.attachments.push(...equipment[kind].directions[name].map(a=>({...a,image:path.join(base,`equipment-${kind}-additional`,a.image)})));
  const staff=equipment.staff.directions[name];
  d.attachments=d.attachments.filter(a=>!staff.replaceIds.includes(a.id));
  d.attachments.push(...staff.attachments.map(a=>({...a,image:path.join(base,'equipment-staff-additional',a.image),...(a.absoluteAngleFrom?.endsWith('Elbow')?{angleJoint:a.absoluteAngleFrom}:{})})));
  const h=d.worldForward, forward=[64*(h[0]-h[1]),32*(h[0]+h[1])];
  const size=Math.hypot(...forward), unit=forward.map(v=>v/size);
  const contactAngle=((Math.atan2(unit[1],unit[0])*180/Math.PI+630)%360)-180;
  const dy=(.7348221371-.70)*78.38367177;
  d.poses=durations.map((durationMs,frame)=>{
   const recovery=frame===durations.length-1;
   const contact=action==='attack'&&(frame===1||frame===2);
   const rotation=action==='hit'&&!recovery?(unit[0]>=0?-8:8):0;
   const wristTargets={};
   for(const side of ['left','right']){
    const shoulder=d.joints[side+'Shoulder'].cell, wrist=d.joints[side+'Wrist'].cell, elbow=d.joints[side+'Elbow'].cell;
    const cross=(wrist[0]-shoulder[0])*(elbow[1]-shoulder[1])-(wrist[1]-shoulder[1])*(elbow[0]-shoulder[0]);
    const extension=recovery?0:action==='hit'?-4:contact?(side==='right'?(frame===2?13:18):5):-5;
    const lift=recovery?0:action==='hit'?-3:contact?-15:-8;
    const vector=[wrist[0]+unit[0]*extension-shoulder[0],wrist[1]+unit[1]*extension+lift-shoulder[1]];
    const reach=Math.hypot(...d.joints[side+'Elbow'].restOffset)+Math.hypot(...d.joints[side+'Wrist'].restOffset);
    const scale=Math.min(1,reach*.995/Math.hypot(...vector));
    const point=[shoulder[0]+vector[0]*scale,shoulder[1]+vector[1]*scale];
    const pelvis=d.joints.pelvis.cell, angle=rotation*Math.PI/180, relative=point.map((v,i)=>v-pelvis[i]);
    wristTargets[side+'Wrist']={point:[pelvis[0]+relative[0]*Math.cos(angle)-relative[1]*Math.sin(angle),pelvis[1]+dy+relative[0]*Math.sin(angle)+relative[1]*Math.cos(angle)],bend:(name==='W'&&side==='right'&&contact)?(cross>=0?-1:1):(cross>=0?1:-1)};
   }
   const angle=recovery?0:action==='hit'?(unit[0]>=0?-12:12):contact?(contactAngle-(frame===2?Math.sign(contactAngle)*10:0)):(unit[0]>=0?25:-25);
   return {durationMs,joints:{pelvis:{offset:[0,dy],rotation}},wristTargets,worldStanding:true,contactFoot:'left',rootScreenDelta:[0,0],attachmentAngles:{staff:angle,'right-hand-grip':angle}};
  });
  config.directions[name]=d;
 }
 const output=path.join(here,'candidates',selected.join('-').toLowerCase(),action);
 await mkdir(output,{recursive:true});
 for(const d of Object.values(config.directions))for(const a of d.attachments)a.image=path.relative(output,a.image);
 const posePath=path.join(output,'pose.json');await writeFile(posePath,JSON.stringify(config,null,2)+'\n');
 await exportPoses(posePath,output);
 execFileSync(process.execPath,[path.resolve(here,'../../preview-looks.mjs'),posePath,output],{stdio:'inherit'});
 console.log(action,selected.join(','),output);
}
