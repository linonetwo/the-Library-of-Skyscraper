import sharp from 'sharp';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const rig=JSON.parse(await readFile(new URL('attachments-six-directions/rig.json',import.meta.url)));
const hair=JSON.parse(await readFile(new URL('equipment-hair-additional/attachments.json',import.meta.url)));
const out=new URL('equipment-warden-additional/',import.meta.url);
await mkdir(out,{recursive:true});
const configs={
 E:{source:'iso-v030-warden-ewns.png',coat:[0,0,300,444],anchor:[163,55],scale:.145,hole:[160,47,43,13],
  left:{region:[300,0,280,444],shoulder:[460,77],elbow:[433,230],wrist:[455,386]},
  right:{region:[580,0,307,444],shoulder:[746,77],elbow:[744,230],wrist:[724,385]},width:.16},
 W:{source:'iso-v030-warden-ewns.png',coat:[0,444,300,443],anchor:[173,500],scale:.145,hole:[170,493,43,13],
  left:{region:[300,444,280,443],shoulder:[447,527],elbow:[443,678],wrist:[430,830]},
  right:{region:[580,444,307,443],shoulder:[727,527],elbow:[722,680],wrist:[739,830]},width:.16},
 N:{source:'iso-v030-warden-ewns.png',coat:[0,887,300,443],anchor:[164,941],scale:.145,hole:[164,932,43,10],
  left:{region:[300,887,280,443],shoulder:[449,972],elbow:[433,1121],wrist:[439,1280]},
  right:{region:[580,887,307,443],shoulder:[731,972],elbow:[724,1123],wrist:[722,1280]},width:.10},
 S:{source:'iso-v030-warden-ewns.png',coat:[0,1330,300,444],anchor:[167,1395],scale:.145,hole:[164,1387,47,23],
  left:{region:[300,1330,280,444],shoulder:[446,1411],elbow:[447,1567],wrist:[444,1720]},
  right:{region:[580,1330,307,444],shoulder:[725,1411],elbow:[727,1567],wrist:[732,1720]},width:.10},
 NW:{source:'iso-v030-warden-nwse.png',coat:[0,0,512,512],anchor:[292,48],scale:.11,hole:[293,33,45,12],
  left:{region:[512,0,512,512],shoulder:[789,91],elbow:[747,271],wrist:[706,448]},
  right:{region:[1024,0,512,512],shoulder:[1268,91],elbow:[1237,271],wrist:[1210,448]},width:.13},
 SE:{source:'iso-v030-warden-nwse.png',coat:[0,512,512,512],anchor:[286,559],scale:.11,hole:[285,551,43,17],
  left:{region:[512,512,512,512],shoulder:[764,604],elbow:[778,797],wrist:[816,955]},
  right:{region:[1024,512,512,512],shoulder:[1255,604],elbow:[1240,783],wrist:[1283,950]},width:.13},
};
const cache={},report={status:'static-six-direction-warden-candidate',releaseApproved:false,cell:[192,192],
 groundPivot:[96,172.8],renderScale:1,sources:{},directions:{}},views=[];
const cap=s=>s[0].toUpperCase()+s.slice(1);
for(const[column,[heading,c]]of Object.entries(configs).entries()){
 await mkdir(new URL(`${heading}/`,out),{recursive:true});
 if(!cache[c.source]){
  const bytes=await readFile(new URL(`../source/${c.source}`,import.meta.url));
  cache[c.source]=await sharp(bytes).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  report.sources[c.source]={sha256:createHash('sha256').update(bytes).digest('hex'),successCount:1};
 }
 const{data,info}=cache[c.source],d=rig.directions[heading],j=d.joints,parts=[];
 const sample=(x,y,k)=>{
  const a=Math.floor(x),b=Math.floor(y),fx=x-a,fy=y-b;
  if(a<0||b<0||a+1>=info.width||b+1>=info.height)return 0;
  const at=(xx,yy)=>data[(yy*info.width+xx)*4+k];
  return Math.round(at(a,b)*(1-fx)*(1-fy)+at(a+1,b)*fx*(1-fy)+at(a,b+1)*(1-fx)*fy+at(a+1,b+1)*fx*fy);
 };
 async function save(id,layer,joint,pixels,extra){
  const image=`${heading}/${id}.png`;
  await sharp(pixels,{raw:{width:192,height:192,channels:4}}).png().toFile(new URL(image,out).pathname);
  parts.push({id,layer,joint,image,pivot:j[joint].cell,restTopLeft:[0,0],size:[192,192],zOrder:0,...extra});
 }
 const pixels=Buffer.alloc(192*192*4),[rx,ry,rw,rh]=c.coat,[hx,hy,hw,hh]=c.hole;
 for(let y=0;y<192;y++)for(let x=0;x<192;x++){
  const sx=c.anchor[0]+(x-j.neck.cell[0])/c.scale,sy=c.anchor[1]+(y-j.neck.cell[1])/c.scale;
  if(sx<rx||sx>=rx+rw||sy<ry||sy>=ry+rh||((sx-hx)/hw)**2+((sy-hy)/hh)**2<1)continue;
  const p=(y*192+x)*4;for(let k=0;k<4;k++)pixels[p+k]=sample(sx,sy,k);
  if(pixels[p+3]<9)pixels.fill(0,p,p+4);
 }
 await save('coat','outfit-warden','pelvis',pixels,{source:c.source,sourceAnchor:c.anchor,sourceScale:c.scale,neckHole:c.hole,zOrder:5});
 for(const side of ['left','right'])for(const[part,start,end]of [['upper-sleeve','shoulder','elbow'],['fore-sleeve','elbow','wrist']]){
  const s=c[side],a=s[start],b=s[end],ta=j[side+cap(start)].cell,tb=j[side+cap(end)].cell;
  const sv=b.map((v,i)=>v-a[i]),tv=tb.map((v,i)=>v-ta[i]),sl=Math.hypot(...sv),tl=Math.hypot(...tv),
   su=sv.map(v=>v/sl),tu=tv.map(v=>v/tl),pbuf=Buffer.alloc(192*192*4);
  for(let y=0;y<192;y++)for(let x=0;x<192;x++){
   const dx=x-ta[0],dy=y-ta[1],along=dx*tu[0]+dy*tu[1],across=-dx*tu[1]+dy*tu[0];
   if(along<(start==='shoulder'?-6:-2)||along>tl+(end==='wrist'?.7:2))continue;
   const sx=a[0]+along*sl/tl*su[0]-across/c.width*su[1],
    sy=a[1]+along*sl/tl*su[1]+across/c.width*su[0],[x0,y0,w,h]=s.region;
   if(sx<x0||sx>=x0+w||sy<y0||sy>=y0+h)continue;
   const p=(y*192+x)*4;for(let k=0;k<4;k++)pbuf[p+k]=sample(sx,sy,k);
   if(pbuf[p+3]<9)pbuf.fill(0,p,p+4);
  }
  const near=d.nearSide===side||d.nearSide==='both';
  await save(`${side}-${part}`,near?'outfit-warden-front':'outfit-warden',side+cap(start),pbuf,{
   source:c.source,sourceJoint:a,sourceEnd:b,targetJoint:ta,targetEnd:tb,
   explicitClothingFit:{axisScale:tl/sl,transverseScale:c.width},zOrder:part==='upper-sleeve'?1:2});
 }
 report.directions[heading]=parts;
 for(const[row,style]of ['ivory','midnight'].entries()){
  const all=[...d.attachments.map(a=>({...a,root:new URL('attachments-six-directions/',import.meta.url)})),
   ...parts.map(a=>({...a,root:out})),...hair.directions[heading].filter(a=>a.layer.includes(style)).map(a=>({...a,root:new URL('equipment-hair-additional/',import.meta.url)}))];
  const depth={body:0,'body-front':100,'outfit-warden':50,'outfit-warden-front':125,[`hair-${style}-back`]:-100,[`hair-${style}-front`]:150};
  all.sort((a,b)=>depth[a.layer]+a.zOrder-depth[b.layer]-b.zOrder);
  const view=await sharp({create:{width:192,height:192,channels:4,background:'#00000000'}}).composite(
   await Promise.all(all.map(async a=>({input:await readFile(new URL(a.image,a.root)),left:Math.round(a.restTopLeft[0]),top:Math.round(a.restTopLeft[1])})))).png().toBuffer();
  views.push({input:view,left:column*192,top:row*192});
 }
}
await writeFile(new URL('attachments.json',out),JSON.stringify(report,null,2)+'\n');
await sharp({create:{width:1152,height:384,channels:4,background:'#d5dfd9'}}).composite(views).png()
 .toFile(new URL('warden-additional-directions-preview.png',import.meta.url).pathname);
