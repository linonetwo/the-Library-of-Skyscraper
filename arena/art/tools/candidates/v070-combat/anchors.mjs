import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
const rotate=([x,y],a)=>[x*Math.cos(a)-y*Math.sin(a),x*Math.sin(a)+y*Math.cos(a)],add=(a,b)=>a.map((v,i)=>v+b[i]);
/** Sample the actual rendered attachment transform, in untrimmed orig pixels. */
export async function writeAnchors(configFile,out){
 const config=JSON.parse(await readFile(configFile,'utf8')),report=JSON.parse(await readFile(path.join(out,'contact-report.json'),'utf8')),budgetFile=path.join(out,'atlas-budget.json'),budget=JSON.parse(await readFile(budgetFile,'utf8')),anchors={};
 for(const [name,d] of Object.entries(config.directions)){
  const staff=d.attachments.find(a=>a.id==='staff'),hand=d.attachments.find(a=>a.id==='recover-support-palm');
  const image=await sharp(path.resolve(path.dirname(configFile),staff.image)).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  let tip;for(let y=0;y<image.info.height&&!tip;y++){let total=0,sum=0;for(let x=0;x<image.info.width;x++){const alpha=image.data[(y*image.info.width+x)*4+3];if(alpha>=128){sum+=(x+.5)*alpha;total+=alpha;}}if(total)tip=[sum/total,y+.5];}
  if(!tip)throw Error('No visible staff tip '+name);
  anchors[name]=d.poses.map((pose,frame)=>{
   const state=report.frames.find(row=>row.direction===name&&row.frame===frame).joints;
   const angle=(pose.attachmentAngles?.staff??0)*Math.PI/180,origin=state[staff.joint].point;
   const result={grip:add(origin,rotate(staff.gripOffset,angle)),staffTip:add(origin,rotate(tip.map((v,i)=>v-staff.pivot[i]),angle))};
   if(pose.supportContacts?.supportPalm){
    const spec=d.supportPalmRegistration,theta=pose.attachmentAngles['recover-support-palm']*Math.PI/180;
    result.supportPalm=add(state.leftWrist.point,rotate(spec.localContact.map((v,i)=>v-hand.pivot[i]),theta));
   }
   if(pose.supportContacts?.feet?.length){const side=pose.supportContacts.feet[0],foot=d.feet[side],joint=state[foot.joint];result.supportFoot=add(joint.point,rotate(foot.soleOffset,joint.angle));}
   return result;
  });
 }
 budget.anchorsByDirection=anchors;await writeFile(budgetFile,JSON.stringify(budget,null,2)+'\n');await writeFile(path.join(out,'anchors.json'),JSON.stringify({coordinateSpace:'untrimmed orig pixels; renderScale1; no world displacement',directions:anchors},null,2)+'\n');
}
