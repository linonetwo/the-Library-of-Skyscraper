import {readFile,writeFile,mkdir} from 'node:fs/promises';import path from 'node:path';import {fileURLToPath} from 'node:url';import {solveLimb} from '../../pose-kinematics.mjs';
const dir=path.dirname(fileURLToPath(import.meta.url)),base=JSON.parse(await readFile(path.join(dir,'pose.json'))),manifest=JSON.parse(await readFile(path.join(dir,'work-props/manifest.json')));
const rot=([x,y],a)=>[x*Math.cos(a)-y*Math.sin(a),x*Math.sin(a)+y*Math.cos(a)];
for(const stage of ['build','catalog']){
 const c=structuredClone(base);c.action=stage;c.handMode=stage==='build'?'grip':'natural';delete c.variants;const type=stage==='build'?'mallet':'folio';
 for(const[d,dv]of Object.entries(c.directions)){
  dv.attachments=dv.attachments.filter(a=>!a.id.startsWith('work-prop-')||a.id==='work-prop-'+type).map(a=>({...a,image:'../'+a.image}));
  for(const[i,p]of dv.poses.entries()){
   p.joints={pelvis:p.joints.pelvis};p.hiddenAttachments=[];
   const lp=d==='NE'?[-1.8,5.2]:[-1.8,5.5],rp=d==='NE'?[1.7,5]:[-1.8,5.5];
   const points=stage==='build'?(d==='NE'?[[81,119],[[120,89],[129,108],[117,94],[111,124]][i]]:[[113,127.5],[[68,91],[54,112],[68,96],[78,124]][i]]):(d==='NE'?[[80,110],[100,110]]:[[111,109],[99,110]]);
   for(const[side,j]of [['left',0],['right',1]])p.wristTargets[side+'Wrist'].point=points[j];
   const solved=structuredClone(p.joints);let state;for(const[j,t]of Object.entries(p.wristTargets))state=solveLimb(dv,solved,c.groundPivot,{joint:j,bend:t.bend,soleOffset:[0,0]},t.point);
   if(stage==='catalog'&&i<3){
    const palm=rot(lp,state.leftElbow.angle).map((v,k)=>v+state.leftWrist.point[k]),edge=[(d==='NE'?1:-1)*[12,8,12][i],[-4,-5,-12][i]],contact=palm.map((v,k)=>v+edge[k]);let target=p.wristTargets.rightWrist.point;
    for(let n=0;n<100;n++){state=solveLimb(dv,solved,c.groundPivot,{joint:'rightWrist',bend:p.wristTargets.rightWrist.bend,soleOffset:[0,0]},target);const delta=rot(rp,state.rightElbow.angle),next=contact.map((v,k)=>v-delta[k]);if(Math.hypot(...next.map((v,k)=>v-target[k]))<1e-9){target=next;break;}target=next;}
    p.wristTargets.rightWrist.point=target;state=solveLimb(dv,solved,c.groundPivot,{joint:'rightWrist',bend:p.wristTargets.rightWrist.bend,soleOffset:[0,0]},target);
   }
   const m=manifest.directions[d][type],angle=stage==='build'?m.defaultAbsoluteAngles[i]*Math.PI/180:state.leftElbow.angle,offset=stage==='build'?dv.attachments.find(a=>a.id==='right-hand-grip').gripOffset:lp;
   p.joints['work-prop-'+type]={offset:rot(rot(offset,angle),-state[m.joint].angle)};
   p.attachmentAngles={'staff':d==='NE'?-18:18,'right-hand-grip':m.defaultAbsoluteAngles[i],['work-prop-'+type]:m.defaultAbsoluteAngles[i]};
  }
 }
 c.previewLooks={};for(const outfit of ['scholar','warden'])for(const hair of ['ivory','midnight'])for(const weapon of ['empty','staff'])c.previewLooks[`${outfit}-${hair}-${weapon}`]=[...(weapon==='staff'?['weapon-staff-back']:[]),`hair-${hair}-back`,'body',`outfit-${outfit}`,'body-front',...(outfit==='warden'?['outfit-warden-front']:[]),'work-prop-'+type,'hand-left-front',stage==='build'?'hand-grip':'hand-front',`hair-${hair}-front`];
 c.previewLayers=Object.values(c.previewLooks)[0];c.appearanceOptions.weaponOff=['hand-left-front',stage==='build'?'hand-grip':'hand-front'];c.appearanceOptions.weaponOn=[...c.appearanceOptions.weaponOff,'weapon-staff-back'];
 c.reviewNotes=['Separate stage clip with shared four-phase clock and source art. Catalog keeps book in left palm through recovery; right hand sweeps page edge to center. Building right arm moves mallet outside torso. Pending independent art and runtime acceptance.'];
 await mkdir(path.join(dir,stage),{recursive:true});await writeFile(path.join(dir,stage,'pose.json'),JSON.stringify(c,null,2)+'\n');
}
