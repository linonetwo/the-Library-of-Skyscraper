import {readFile,writeFile,cp,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {solveLimb} from '../../pose-kinematics.mjs';
const base=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const art=process.argv[2]||path.join(base,'ne-sw-build-catalog/work-props');
const manifest=JSON.parse(await readFile(path.join(art,'manifest.json')));
const load=async p=>JSON.parse(await readFile(p));
const rot=([x,y],a)=>[x*Math.cos(a)-y*Math.sin(a),x*Math.sin(a)+y*Math.cos(a)];
for(const action of ['collect','build-catalog']){
 const dir=path.join(base,'ne-sw-'+action),c=await load(path.join(dir,'pose.json'));
 const carry=await load(path.join(base,'ne-sw-carry/pose.json'));
 const props=action==='collect'?['paper']:['mallet','folio'];
 c.handMode='natural';c.variants=action==='collect'?{collecting:{activeLayers:['work-prop-paper'],handMode:'natural'}}:{building:{activeLayers:['work-prop-mallet'],handMode:'grip'},cataloging:{activeLayers:['work-prop-folio'],handMode:'natural'}};
 for(const[d,dv]of Object.entries(c.directions)){
  const cv=carry.directions[d];
  dv.attachments=dv.attachments.filter(a=>!['left-forearm-hand','left-forearm','left-natural-hand','staff'].includes(a.id)&&!a.id.startsWith('work-prop-'));
  for(const id of ['left-forearm','left-natural-hand','staff']){
   const a=structuredClone(cv.attachments.find(a=>a.id===id));
   if(id==='left-natural-hand')a.layer='hand-left-front';
   await mkdir(path.dirname(path.join(dir,a.image)),{recursive:true});await cp(path.join(base,'ne-sw-carry',a.image),path.join(dir,a.image));dv.attachments.push(a);
  }
  for(const type of props){
   const m=manifest.directions[d][type],id='work-prop-'+type;
   await mkdir(path.join(dir,'attachments/work-props',d),{recursive:true});await cp(path.join(art,m.image),path.join(dir,'attachments/work-props',m.image));
   dv.joints[id]={parent:m.joint,restOffset:[0,0]};
   dv.attachments.push({id,joint:id,layer:id,image:'attachments/work-props/'+m.image,pivot:m.pivot,size:m.size,zOrder:1});
  }
  for(const[i,p]of dv.poses.entries()){
   if(action==='build-catalog'&&i<3){
    const points=d==='NE'?[[94,112],[110,110]]:[[101,122],[85,119]];
    for(const[side,j]of [['left',0],['right',1]])p.wristTargets[side+'Wrist'].point=[points[j][0]+(i===1?(j===0?0:1):0),points[j][1]+(i===2?-2:0)];
   }
   p.attachmentAngles={staff:d==='NE'?-18:18,'right-hand-grip':manifest.directions[d].mallet.defaultAbsoluteAngles[i]};
   p.hiddenAttachments=(p.hiddenAttachments||[]).filter(id=>!id.startsWith('work-prop-'));
   const solved=structuredClone(p.joints);let state;
   for(const[j,t]of Object.entries(p.wristTargets))state=solveLimb(dv,solved,c.groundPivot,{joint:j,bend:t.bend,soleOffset:[0,0]},t.point);
   if(action==='build-catalog'&&i<3){
    const lp=d==='NE'?[-1.8,5.2]:[-1.8,5.5],rp=d==='NE'?[1.7,5]:[-1.8,5.5];
    const palm=rot(lp,state.leftElbow.angle).map((v,k)=>v+state.leftWrist.point[k]);
    const edge=d==='NE'?[11,-4]:[-11,-4],contact=palm.map((v,k)=>v+edge[k]);
    let target=p.wristTargets.rightWrist.point;
    for(let pass=0;pass<100;pass++){
     state=solveLimb(dv,solved,c.groundPivot,{joint:'rightWrist',bend:p.wristTargets.rightWrist.bend,soleOffset:[0,0]},target);
     const delta=rot(rp,state.rightElbow.angle),next=contact.map((v,k)=>v-delta[k]);
     if(Math.hypot(...next.map((v,k)=>v-target[k]))<1e-9){target=next;break;}target=next;
    }
    p.wristTargets.rightWrist.point=target;
    state=solveLimb(dv,solved,c.groundPivot,{joint:'rightWrist',bend:p.wristTargets.rightWrist.bend,soleOffset:[0,0]},target);
   }
   for(const type of props){
    const m=manifest.directions[d][type],id='work-prop-'+type,side=m.joint.startsWith('left')?'left':'right';
    const offset=type==='mallet'?dv.attachments.find(a=>a.id==='right-hand-grip').gripOffset:d==='NE'?(side==='left'?[-1.8,5.2]:[1.7,5]):[-1.8,5.5];
    const angle=type==='mallet'?m.defaultAbsoluteAngles[i]*Math.PI/180:state[side+'Elbow'].angle;
    p.joints[id]={offset:rot(rot(offset,angle),-state[m.joint].angle)};
    p.attachmentAngles[id]=m.defaultAbsoluteAngles[i];
    if(!m.visibleFrames.includes(i))p.hiddenAttachments.push(id);
   }
  }
 }
 c.appearanceOptions={outfits:['scholar','warden'],hair:['ivory','midnight'],weaponOff:[],weaponOn:['weapon-staff-back']};
 c.exclusiveLayerGroups=[['hand-front','hand-grip']];c.previewLooks={};
 for(const stage of Object.keys(c.variants))for(const outfit of ['scholar','warden'])for(const hair of ['ivory','midnight'])for(const weapon of ['empty','staff']){
  c.previewLooks[`${stage}-${outfit}-${hair}-${weapon}`]=[...(weapon==='staff'?['weapon-staff-back']:[]),`hair-${hair}-back`,'body',`outfit-${outfit}`,'body-front',...(outfit==='warden'?['outfit-warden-front']:[]),...c.variants[stage].activeLayers,'hand-left-front',c.variants[stage].handMode==='grip'?'hand-grip':'hand-front',`hair-${hair}-front`];
 }
 c.layerOrderByDirection=Object.fromEntries(['NE','SW'].map(d=>[d,['weapon-staff-back','hair-ivory-back','hair-midnight-back','body','outfit-scholar','outfit-warden','body-front','outfit-warden-front',...props.map(t=>'work-prop-'+t),'hand-left-front','hand-front','hand-grip','hair-ivory-front','hair-midnight-front']]));
 c.previewLayers=Object.values(c.previewLooks)[0];
 c.reviewNotes=['Independent paper/mallet/folio pages; stage selects one tool and matching right hand. Left natural hand always visible. Staff stowed behind torso. Contact pivots attach to actual solved palm/grip. Candidate pending independent visual and runtime acceptance.'];
 await writeFile(path.join(dir,'pose.json'),JSON.stringify(c,null,2)+'\n');
}
