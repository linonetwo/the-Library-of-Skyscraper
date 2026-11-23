import fs from 'node:fs/promises';import path from 'node:path';import {fileURLToPath} from 'node:url';import sharp from 'sharp';
const dir=path.dirname(fileURLToPath(import.meta.url)),src=path.join(dir,'inputs/art');const rig=JSON.parse(await fs.readFile(path.join(src,'attachments-six-directions/rig.json'))),staff=JSON.parse(await fs.readFile(path.join(src,'equipment-staff-additional/attachments.json')));const rows=[],registration={status:'palm-offset-review-pending',directions:{}};
for(const[d,dv]of Object.entries(rig.directions)){
 const out=path.join(dir,'hands',d);await fs.mkdir(out,{recursive:true});registration.directions[d]={};
 for(const side of ['left','right']){
  const a=side==='left'?dv.attachments.find(a=>a.id==='left-forearm-hand'):staff.directions[d].attachments.find(a=>a.id==='right-natural-hand');
  const image=path.join(src,side==='left'?'attachments-six-directions':'equipment-staff-additional',a.image),wrist=dv.joints[side+'Wrist'].cell,elbow=dv.joints[side+'Elbow'].cell;
  const v=wrist.map((x,k)=>x-elbow[k]),len=Math.hypot(...v);const {data,info}=await sharp(image).ensureAlpha().raw().toBuffer({resolveWithObject:true});let weight=0,center=[0,0];
  for(const mode of ['forearm','natural-hand']){
   const pixels=Buffer.from(data);for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++){
    const point=[x+a.restTopLeft[0],y+a.restTopLeft[1]],t=point.reduce((s,p,k)=>s+(p-wrist[k])*v[k]/len,0),i=(y*info.width+x)*4;
    if(mode==='forearm'?t>.7:t<=.7)pixels.fill(0,i,i+4);
    else if(mode==='natural-hand'){const alpha=pixels[i+3]/255;weight+=alpha;center[0]+=alpha*(point[0]-wrist[0]);center[1]+=alpha*(point[1]-wrist[1]);}
   }
   await sharp(pixels,{raw:info}).png().toFile(path.join(out,side+'-'+mode+'.png'));
  }
  const palmOffset=center.map(x=>x/weight);registration.directions[d][side]={palmOffset,status:'alpha-centroid-proposal-needs-art-review',wrist,sourceImage:image,restTopLeft:a.restTopLeft};
  const scale=8,w=info.width*scale,h=info.height*scale,px=(wrist[0]-a.restTopLeft[0])*scale,py=(wrist[1]-a.restTopLeft[1])*scale,cx=px+palmOffset[0]*scale,cy=py+palmOffset[1]*scale;
  const marks=Buffer.from(`<svg width="${w}" height="${h}"><circle cx="${px}" cy="${py}" r="4" fill="red"/><circle cx="${cx}" cy="${cy}" r="4" fill="#00aa44"/></svg>`);
  const png=await sharp(image).resize(w,h,{kernel:'nearest'}).flatten({background:'#eee'}).composite([{input:marks}]).png().toBuffer();rows.push({input:png,left:(side==='left'?0:192),top:Object.keys(registration.directions).indexOf(d)*260});
 }
}
await fs.writeFile(path.join(dir,'hands/registration.json'),JSON.stringify(registration,null,2)+'\n');await sharp({create:{width:384,height:1560,channels:4,background:'#ddd'}}).composite(rows).png().toFile(path.join(dir,'hands/contact-proposals.png'));
