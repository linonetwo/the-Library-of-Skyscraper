import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {exportPoses} from '../../pose-export.mjs';
import {worldWalkPose} from '../../world-walk.mjs';
const base=path.join(path.dirname(new URL(import.meta.url).pathname),'inputs/art');
const dest=path.dirname(new URL(import.meta.url).pathname);
const read=async p=>JSON.parse(await readFile(p,'utf8'));
const template=await read(path.join(dest,'inputs/ew-template.json'));
const rig=await read(base+'/attachments-six-directions/rig.json');
const equip={};
for(const kind of ['scholar','warden','hair','staff']) equip[kind]=await read(`${base}/equipment-${kind}-additional/attachments.json`);
const selected=(process.argv[2]||'N,S,NW,SE').split(',');
for(const action of (process.argv[3]||'walk,idle').split(',')) {
 const config=structuredClone(template); config.action=action; config.directions={};config.releaseApproved=false; config.walkApproved=false; config.status='awaiting-direction-visual-review';
 if(action==='idle')delete config.cycleWorldStride;
 config.frameCount=action==='walk'?16:4; config.frameMs=action==='walk'?45:400;
 config.reviewNotes=['Direction-specific source joints, wrist targets and world heading; pending Astra visual review.'];
 for(const n of selected){
  const d=structuredClone(rig.directions[n]);
  d.attachments=d.attachments.map(a=>({...a,image:path.join(base,'attachments-six-directions',a.image)}));
  for(const kind of ['scholar','warden','hair'])d.attachments.push(...equip[kind].directions[n].map(a=>({...a,image:path.join(base,`equipment-${kind}-additional`,a.image)})));
  const staff=equip.staff.directions[n];d.attachments=d.attachments.filter(a=>!staff.replaceIds.includes(a.id));
  d.attachments.push(...staff.attachments.map(a=>({...a,image:path.join(base,'equipment-staff-additional',a.image),...(a.absoluteAngleFrom?.endsWith('Elbow')?{angleJoint:a.absoluteAngleFrom}:{})})));
  d.poses=[];
  for(let i=0;i<config.frameCount;i++){
   const phase=i/config.frameCount, idle=action==='idle';
   const hipZ=idle?.7+.008*Math.sin(phase*2*Math.PI):.66;
   const dy=(.7348221371-hipZ)*78.38367177;
   const world=worldWalkPose(n,phase,{registration:{...config.worldRegistration,heading:d.worldForward}});
   const wrists={};
   for(const side of ['left','right']){
    const joint=d.joints[side+'Wrist'].cell, elbow=d.joints[side+'Elbow'].cell, shoulder=d.joints[side+'Shoulder'].cell;
    const cross=(joint[0]-shoulder[0])*(elbow[1]-shoulder[1])-(joint[1]-shoulder[1])*(elbow[0]-shoulder[0]);
    const swing=idle?0:1.3*Math.sin(phase*2*Math.PI)*(side==='left'?1:-1);
    const delta=[joint[0]+swing-shoulder[0],joint[1]-shoulder[1]];
    const reach=Math.hypot(...d.joints[side+'Elbow'].restOffset)+Math.hypot(...d.joints[side+'Wrist'].restOffset);
    const factor=Math.min(1,reach*.995/Math.hypot(...delta));
    wrists[side+'Wrist']={point:[shoulder[0]+delta[0]*factor,shoulder[1]+dy+delta[1]*factor],bend:cross>=0?1:-1};
   }
   d.poses.push({durationMs:config.frameMs,joints:{pelvis:{offset:[0,dy]}},wristTargets:wrists,...(idle?{worldStanding:true,worldRegistration:{hipZ}}:{worldLegPhase:phase}),contactFoot:phase<.5?'left':'right',rootScreenDelta:idle?[0,0]:world.rootScreenDelta,attachmentAngles:{staff:0,'right-hand-grip':0}});
  }
  config.directions[n]=d;
 }
 const out=path.join(dest,selected.join('-').toLowerCase(),action); await mkdir(out,{recursive:true});
 const input=path.join(out,'pose.json'); await writeFile(input,JSON.stringify(config,null,2)); await exportPoses(input,out);
 execFileSync(process.execPath,[new URL('../../preview-looks.mjs',import.meta.url).pathname,input,out],{stdio:'inherit'});
}
