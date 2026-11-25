import sharp from "sharp";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import {execFileSync} from "node:child_process";
import {createHash} from "node:crypto";
const root=new URL("./",import.meta.url),source=await readFile(new URL("source/ne-sw-hands.png",root));
const {width}=await sharp(source).metadata(),s=width/960;
const load=f=>execFileSync("git",["show","0644d5b:"+f],{maxBuffer:4e6});
const cfg=JSON.parse(load("arena/art/tools/candidates/ne-sw-idle/pose.json"));
const marks={
 NE:[[[32,45,220,227],[64,192],[54,203],[185,122]],[[269,45,448,227],[300,193],[288,205],[408,124]],[[497,44,694,227],[530,194],[518,205],[548,187]],[[739,44,933,227],[770,194],[758,205],[791,187]]],
 SW:[[[38,269,214,432],[181,295],[194,289],[132,383]],[[270,269,459,440],[420,296],[435,288],[372,392]],[[496,270,695,445],[659,301],[673,289],[638,323]],[[739,270,935,445],[899,301],[913,290],[877,323]]]
};
const mr={source:"source/ne-sw-hands.png",sha256:createHash("sha256").update(source).digest("hex"),canvas:[192,192],scale:1,review:"pilot; bilateral anatomy NOT accepted; no production fallback",directions:{}};
const sheet=Buffer.alloc(4*58*4*44*4),W=232,H=176;
for(let i=0;i<W*H;i++)sheet.set([231,227,216,255],4*i);
function mix(x,y,col,a=255){if(x<0||x>=W||y<0||y>=H)return;const k=4*(y*W+x);for(let j=0;j<3;j++)sheet[k+j]=Math.round((col[j]*a+sheet[k+j]*(255-a))/255);}
const specs=["leftGrab","rightGrab","leftBrace","rightBrace"];
for(const [di,[h,items]] of Object.entries(marks).entries()){
 mr.directions[h]={};await mkdir(new URL(h+"/",root),{recursive:true});
 for(const [col,[b,wrist,tail,contact]]of items.entries()){
  const side=col%2?"right":"left",kind=col<2?"grab":"brace",name=specs[col],crop={left:Math.round(b[0]*s),top:Math.round(b[1]*s),width:Math.round(b[2]*s)-Math.round(b[0]*s),height:Math.round(b[3]*s)-Math.round(b[1]*s)};
  const hand=await sharp(source).extract(crop).resize({width:col<2?9:10}).png().toBuffer();
  const {data:p,info:im}=await sharp(hand).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const local=([x,y])=>[(x*s-crop.left)*im.width/crop.width,(y*s-crop.top)*im.height/crop.height].map(v=>+v.toFixed(3));
  const pv=local(wrist),cp=local(contact),t=local(tail),len=Math.hypot(t[0]-pv[0],t[1]-pv[1]),unit=[(t[0]-pv[0])/len,(t[1]-pv[1])/len];
  const image=h+"/"+name+".png";await writeFile(new URL(image,root),hand);
  mr.directions[h][name]={image,requestedAnatomicalSide:side,verifiedAnatomicalSide:null,handednessApproved:false,gesture:kind,wristPivot:pv,localContact:cp,wristTowardElbow:unit,size:[im.width,im.height],sourceCrop:crop,occlusion:kind==="grab"?"rear rung; near fingers in front; center in hook cavity":"platform edge behind palm heel"};
  const d=cfg.directions[h],j=d.joints[side+"Wrist"].restOffset,e=d.joints[side+"Elbow"].cell,L=Math.hypot(...j);
  for(const [oi,outfit]of ["scholar","warden"].entries()){
   const cx=col*58+29,cy=(di*2+oi)*44+21,base=[cx-cp[0]+pv[0],cy-cp[1]+pv[1]];
   for(let u=-23;u<=23;u++){let v=Math.round(u*.5);mix(cx+u,cy+v,[134,113,79]);if(kind==="grab")mix(cx+u,cy+v+1,[174,150,111]);}
   const fore=d.attachments.find(a=>a.id===(side==="left"?"left-forearm-hand":"right-forearm")),cl=d.attachments.find(a=>a.id===side+"-fore-sleeve");
   for(const a of outfit==="scholar"?[fore]:[fore,cl]){
    const path=new URL(a.image,"file:///arena/art/tools/candidates/ne-sw-idle/pose.json").pathname.slice(1);
    const {data,info}=await sharp(load(path)).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    const angle=Math.atan2(-unit[1],-unit[0])-Math.atan2(j[1],j[0]),c=Math.cos(angle),si=Math.sin(angle);
    for(let y=di*88+oi*44;y<di*88+(oi+1)*44;y++)for(let x=col*58;x<(col+1)*58;x++){
     const dx=x-base[0],dy=y-base[1],lx=dx*c+dy*si,ly=-dx*si+dy*c;
     if((lx*j[0]+ly*j[1])/L>.6||Math.hypot(dx,dy)>L+1)continue;
     const ix=Math.round(a.pivot[0]+j[0]+lx),iy=Math.round(a.pivot[1]+j[1]+ly);
     if(ix<0||ix>=info.width||iy<0||iy>=info.height)continue;const k=4*(iy*info.width+ix);
     mix(x,y,data.subarray(k,k+3),data[k+3]);
    }
   }
   for(let y=0;y<im.height;y++)for(let x=0;x<im.width;x++){const k=4*(y*im.width+x);mix(Math.round(cx-cp[0]+x),Math.round(cy-cp[1]+y),p.subarray(k,k+3),p[k+3]);}
  }
 }
}
await writeFile(new URL("manifest.json",root),JSON.stringify(mr,null,2)+"\n");
await sharp(sheet,{raw:{width:W,height:H,channels:4}}).png().toFile(new URL("fit-1x.png",root).pathname);
await sharp(sheet,{raw:{width:W,height:H,channels:4}}).resize(W*4,H*4,{kernel:"nearest"}).png().toFile(new URL("fit-4x.png",root).pathname);
