import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import {stamp} from '../../pose-raster.mjs';
const out=path.resolve(process.argv[2]),target=path.resolve(process.argv[3]),config=JSON.parse(await readFile(out+'/pose.json')),report=JSON.parse(await readFile(out+'/contact-report.json'));
const groups={leftLeg:a=>/^left-(thigh|shin|boot)$/.test(a.id),rightLeg:a=>/^right-(thigh|shin|boot)$/.test(a.id),supportArm:a=>/^left-/.test(a.id)&&!/thigh|shin|boot/.test(a.id)||a.id.startsWith('recover-left')||a.id==='recover-support-palm',staffArm:a=>/^right-/.test(a.id)&&!/thigh|shin|boot/.test(a.id)||a.id==='staff',trunk:a=>a.id==='head'||a.id==='torso'||a.id==='coat'||a.id.startsWith('hair-')||a.id.startsWith('outfit-')};
await mkdir(target,{recursive:true});const rows=[],facts=[];
for(const frame of [3,4]){
 const d=config.directions.NE,p=d.poses[frame],state=report.frames.find(r=>r.direction==='NE'&&r.frame===frame).joints,attachments=[];
 for(const a of d.attachments){if(p.hiddenAttachments?.includes(a.id)||a.variant==='empty-hand'||/ivory|scholar/.test(a.id))continue;const {data,info}=await sharp(path.resolve(out,a.image)).ensureAlpha().raw().toBuffer({resolveWithObject:true});attachments.push({...a,data,width:info.width,height:info.height});}
 let column=0;
 for(const [name,select]of Object.entries(groups)){
  const pixels=Buffer.alloc(256*256*4);
  for(const a of attachments.filter(select).sort((a,b)=>(a.zOrder??0)-(b.zOrder??0))){const angle=p.attachmentAngles?.[a.id]!==undefined?p.attachmentAngles[a.id]*Math.PI/180:state[a.angleJoint||a.joint].angle+(a.rotation??0)*Math.PI/180;stamp(pixels,256,256,a,state[a.joint].point,a.pivot,angle,p.attachmentMappings?.[a.id]);}
  const png=await sharp(pixels,{raw:{width:256,height:256,channels:4}}).png().toBuffer();await writeFile(path.join(target,`NE-${frame}-${name}.png`),png);rows.push({input:png,left:column++*256,top:(frame-3)*256});
 }
 rows.push({input:await sharp(out+'/looks-contact.png').extract({left:frame*256,top:0,width:256,height:256}).png().toBuffer(),left:5*256,top:(frame-3)*256});
 facts.push({frame,world:p.supportContacts.world,screen:Object.fromEntries(Object.entries(state).map(([k,v])=>[k,v.point])),anchors:JSON.parse(await readFile(out+'/atlas-budget.json')).anchorsByDirection.NE[frame]});
}
await sharp({create:{width:6*256,height:2*256,channels:4,background:'#e6e2dc'}}).composite(rows).png().toFile(target+'/layers-and-original.png');await writeFile(target+'/coordinates.json',JSON.stringify(facts,null,2)+'\n');
