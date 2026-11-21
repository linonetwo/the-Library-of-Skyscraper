import sharp from 'sharp';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {frameName} from '../animation-spec.mjs';

export const layers=['body','body-front','outfit-scholar','outfit-warden','hair-ivory','hair-ivory-back','hair-ivory-front','hair-midnight','hair-midnight-back','hair-midnight-front','weapon-staff','weapon-staff-back','weapon-staff-front','hand-grip'];
const rotate=([x,y],a)=>[x*Math.cos(a)-y*Math.sin(a),x*Math.sin(a)+y*Math.cos(a)];
const add=(a,b)=>a.map((v,i)=>v+b[i]);
const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const angle=v=>Math.atan2(v[1],v[0]);
const length=v=>Math.hypot(...v);
const degrees=r=>r*180/Math.PI;
function skeleton(joints,pose,origin){
 const result={},visiting=new Set();
 function resolve(id){
  if(result[id])return result[id];
  if(visiting.has(id)||!joints[id])throw Error(`Invalid joint graph: ${id}`);
  visiting.add(id);
  const joint=joints[id],parent=joint.parent?resolve(joint.parent):{point:origin,angle:0};
  const change=pose[id]||{};
  const point=add(parent.point,rotate(add(joint.restOffset,change.offset||[0,0]),parent.angle));
  result[id]={point,angle:parent.angle+(change.rotation||0)*Math.PI/180};visiting.delete(id);return result[id];
 }
 for(const id of Object.keys(joints))resolve(id);
 return result;
}
function lockFoot(direction,pose,origin,foot,target){
 const joints=direction.joints,ankleId=foot.joint,kneeId=joints[ankleId].parent,hipId=joints[kneeId].parent;
 let state=skeleton(joints,pose,origin);
 const ankleAngle=state[ankleId].angle;
 const destination=sub(target,rotate(foot.soleOffset||[0,0],ankleAngle));
 const hip=state[hipId],v=sub(destination,hip.point),l1=length(joints[kneeId].restOffset),l2=length(joints[ankleId].restOffset),d=length(v);
 if(!l1||!l2||!d)throw Error('Foot lock requires a nondegenerate hip/knee/ankle chain');
 if(d>l1+l2+0.01||d<Math.abs(l1-l2)-0.01)throw Error(`Foot target unreachable: ${ankleId} distance ${d.toFixed(2)} lengths ${l1},${l2}`);
 const bend=foot.bend===-1?-1:1;
 const hipAngle=angle(v)+bend*Math.acos(Math.max(-1,Math.min(1,(l1*l1+d*d-l2*l2)/(2*l1*d))));
 const knee=add(hip.point,[l1*Math.cos(hipAngle),l1*Math.sin(hipAngle)]);
 const kneeAngle=angle(sub(destination,knee));
 const parent=joints[hipId].parent;
 pose[hipId]={...pose[hipId],rotation:degrees(hipAngle-angle(joints[kneeId].restOffset)-(parent?state[parent].angle:0))};
 state=skeleton(joints,pose,origin);
 pose[kneeId]={...pose[kneeId],rotation:degrees(kneeAngle-angle(joints[ankleId].restOffset)-state[hipId].angle)};
 state=skeleton(joints,pose,origin);
 pose[ankleId]={...pose[ankleId],rotation:degrees(ankleAngle-state[kneeId].angle)};
 return skeleton(joints,pose,origin);
}
function stamp(canvas,width,height,image,point,pivot,a){
 // Inverse sampling preserves the declared pivot even when rotation changes the image bounds.
 const corners=[[0,0],[image.width,0],[0,image.height],[image.width,image.height]].map(p=>add(point,rotate(sub(p,pivot),a)));
 const x0=Math.max(0,Math.floor(Math.min(...corners.map(p=>p[0])))),x1=Math.min(width,Math.ceil(Math.max(...corners.map(p=>p[0]))));
 const y0=Math.max(0,Math.floor(Math.min(...corners.map(p=>p[1])))),y1=Math.min(height,Math.ceil(Math.max(...corners.map(p=>p[1]))));
 for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){
  const source=add(rotate(sub([x+.5,y+.5],point),-a),pivot).map(v=>v-.5),sx=Math.floor(source[0]),sy=Math.floor(source[1]);
  const color=[0,0,0,0];
  for(let dy=0;dy<=1;dy++)for(let dx=0;dx<=1;dx++){
   const ix=sx+dx,iy=sy+dy;if(ix<0||iy<0||ix>=image.width||iy>=image.height)continue;
   const weight=(dx?source[0]-sx:1-source[0]+sx)*(dy?source[1]-sy:1-source[1]+sy),i=(iy*image.width+ix)*4,alpha=image.data[i+3]/255;
   color[3]+=alpha*weight;for(let c=0;c<3;c++)color[c]+=image.data[i+c]*alpha*weight;
  }
  const i=(y*width+x)*4,alpha=color[3],oldAlpha=canvas[i+3]/255,outAlpha=alpha+oldAlpha*(1-alpha);
  if(!outAlpha)continue;
  for(let c=0;c<3;c++)canvas[i+c]=Math.round((color[c]+canvas[i+c]*oldAlpha*(1-alpha))/outAlpha);
  canvas[i+3]=Math.round(outAlpha*255);
 }
}
export async function exportPoses(configPath,output){
 const config=JSON.parse(await readFile(configPath,'utf8'));
 if(config.schemaVersion!==1)throw Error('Expected schemaVersion 1');
 if(!(config.renderScale>0))throw Error('renderScale must declare atlas-to-screen scale');
 const [width,height]=config.cell,dirs=Object.entries(config.directions),count=dirs[0][1].poses.length;
 if(!count||dirs.some(([,d])=>d.poses.length!==count))throw Error('Directions need equal nonzero pose counts');
 await mkdir(output,{recursive:true});
 const cells=Object.fromEntries(layers.map(l=>[l,[]])),contact=[],report=[];
 for(const [row,[name,direction]] of dirs.entries()){
  const attachments=await Promise.all(direction.attachments.map(async a=>{
   if(!layers.includes(a.layer))throw Error(`Unknown layer ${a.layer}`);
   const {data,info}=await sharp(path.resolve(path.dirname(configPath),a.image)).ensureAlpha().raw().toBuffer({resolveWithObject:true});
   return {...a,data,width:info.width,height:info.height};
  }));
  let planted=null,previous=null;
  for(const [frame,input] of direction.poses.entries()){
   const pose=structuredClone(input.joints||{}),screenDelta=input.rootScreenDelta||[0,0],root=screenDelta.map(v=>v/config.renderScale);
   for(const foot of Object.values(direction.feet||{})){const knee=direction.joints[foot.joint].parent;for(const id of [knee,foot.joint])if(pose[id]?.offset?.some(v=>v!==0))throw Error(`Leg joint offsets are unsupported: ${id}; translate root/hip instead`);}
   let state=skeleton(direction.joints,pose,config.groundPivot);
   const foot=direction.feet?.[input.contactFoot];
   if(foot){
    if(previous!==input.contactFoot)planted=add(add(state[foot.joint].point,rotate(foot.soleOffset||[0,0],state[foot.joint].angle)),root);
    state=lockFoot(direction,pose,config.groundPivot,foot,sub(planted,root));
   }else planted=null;
   previous=input.contactFoot;
   const buffers=Object.fromEntries(layers.map(l=>[l,Buffer.alloc(width*height*4)]));
   const sorted=[...attachments].sort((a,b)=>(input.depth?.[a.id]??a.zOrder??0)-(input.depth?.[b.id]??b.zOrder??0));
   for(const a of sorted){const joint=state[a.joint];if(!joint)throw Error(`Unknown attachment joint ${a.joint}`);stamp(buffers[a.layer],width,height,a,joint.point,a.pivot,joint.angle+(a.rotation||0)*Math.PI/180);}
   const composite=[];
   for(const layer of layers){const png=await sharp(buffers[layer],{raw:{width,height,channels:4}}).png().toBuffer();cells[layer].push({input:png,left:frame*width,top:row*height});if(config.previewLayers.includes(layer))composite.push({input:png});}
   const png=await sharp({create:{width,height,channels:4,background:'#e6e2dc'}}).composite(composite).png().toBuffer();contact.push({input:png,left:frame*width,top:row*height});
   const actual=foot?add(add(state[foot.joint].point,rotate(foot.soleOffset||[0,0],state[foot.joint].angle)),root):null;
   report.push({direction:name,frame,durationMs:input.durationMs,contactFoot:input.contactFoot||null,rootScreenDelta:screenDelta,rootAtlasDelta:root,plantAtlasWorld:planted,actualAtlasWorld:actual,errorPx:foot?length(sub(actual,planted)):null,screenErrorPx:foot?length(sub(actual,planted))*config.renderScale:null,joints:state});
  }
 }
 for(const layer of layers){
  const image=`${config.action}-${layer}.png`,frames={},animations={};
  for(const [row,[direction,d]] of dirs.entries())for(let i=0;i<count;i++){
   const name=frameName(config.action,layer,direction,i);frames[name]={frame:{x:i*width,y:row*height,w:width,h:height},rotated:false,trimmed:false,spriteSourceSize:{x:0,y:0,w:width,h:height},sourceSize:{w:width,h:height},anchor:{x:config.groundPivot[0]/width,y:config.groundPivot[1]/height}};
   (animations[`${config.action}/${layer}/${direction}`]??=[]).push(name);
  }
  await sharp({create:{width:count*width,height:dirs.length*height,channels:4,background:'#00000000'}}).composite(cells[layer]).png().toFile(path.join(output,image));
  await writeFile(path.join(output,`${config.action}-${layer}.json`),JSON.stringify({frames,animations,meta:{app:'arena-offline-pose-export',version:'1',image,format:'RGBA8888',size:{w:count*width,h:dirs.length*height},scale:'1'}},null,2)+'\n');
 }
 await sharp({create:{width:count*width,height:dirs.length*height,channels:4,background:'#e6e2dc'}}).composite(contact).png().toFile(path.join(output,'contact-sheet.png'));
 const marks=report.map((f,index)=>{
  const col=index%count,row=Math.floor(index/count),x=col*width,y=row*height;
  const sole=f.actualAtlasWorld?sub(f.actualAtlasWorld,f.rootAtlasDelta):null;
  const label=`${f.direction} ${f.frame} ${f.contactFoot||'air'} ${f.durationMs}ms`;
  return `<text x="${x+6}" y="${y+14}" font-size="11" fill="#182835">${label}</text>`+(sole?`<circle cx="${x+sole[0]}" cy="${y+sole[1]}" r="3" fill="none" stroke="#d32430"/>`:'');
 }).join('');
 await sharp(path.join(output,'contact-sheet.png')).composite([{input:Buffer.from(`<svg width="${count*width}" height="${dirs.length*height}">${marks}</svg>`)}]).png().toFile(path.join(output,'contact-debug.png'));
 const activeLayers=[...new Set(dirs.flatMap(([,d])=>d.attachments.map(a=>a.layer)))];
 await writeFile(path.join(output,'contact-report.json'),JSON.stringify({approved:false,activeLayers,inactiveLayers:layers.filter(layer=>!activeLayers.includes(layer)),renderScale:config.renderScale,cycleWorldStride:config.cycleWorldStride??null,action:config.action,directions:dirs.map(([name])=>name),frames:report},null,2)+'\n');
 return report;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const [config,output]=process.argv.slice(2);if(!config||!output)throw Error('Usage: node pose-export.mjs CONFIG.json OUTPUT_DIRECTORY');
 const report=await exportPoses(path.resolve(config),path.resolve(output));
 const contacts=report.filter(f=>f.contactFoot);
 console.log(`Exported ${report.length} poses; ${contacts.length} contact frames; ${contacts.length?`max plant error ${Math.max(...contacts.map(f=>f.errorPx)).toFixed(6)} atlas px`:'foot lock not exercised'}; art approval pending`);
}
