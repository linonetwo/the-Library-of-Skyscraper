import sharp from "sharp";
import {mkdir,readFile,writeFile} from "node:fs/promises";
import {execFileSync} from "node:child_process";
import {createHash} from "node:crypto";
const root=new URL("./",import.meta.url),out=new URL("six/",root),src=JSON.parse(await readFile(new URL("revised/manifest.json",root)));
const profile=await readFile(new URL("source/profile.png",root)),profileRatio=(await sharp(profile).metadata()).width/960;
const names=["leftGrab","rightGrab","leftBrace","rightBrace"];
const fresh={
 E:[[[15,62,208,198],[43,134],[30,131],[142,150]],[[255,58,445,185],[284,130],[272,128],[376,155]],[[485,80,704,187],[516,126],[502,121],[541,157]],[[724,78,947,179],[751,123],[738,118],[783,149]]],
 W:[[[25,301,216,424],[185,365],[201,363],[99,393]],[[257,300,456,437],[420,365],[437,363],[323,386]],[[489,316,713,427],[680,365],[695,357],[649,393]],[[728,320,955,427],[921,366],[936,359],[887,394]]]
};
const views={N:["NE",-45],S:["SW",-45],NW:["NE",-90],SE:["SW",-90],E:null,W:null};
const fwd={N:[-1,-1],S:[1,1],NW:[-1,0],SE:[1,0],E:[1,-1],W:[-1,1]};
const norm=v=>{const n=Math.hypot(...v);return v.map(x=>x/n);};
const git=f=>execFileSync("git",["show","0644d5b:"+f],{maxBuffer:8e6});
const sha=bytes=>createHash("sha256").update(bytes).digest("hex");
const sheetW=4*64,sheetH=12*46,sheet=Buffer.alloc(sheetW*sheetH*4);
for(let i=0;i<sheet.length;i+=4)sheet.set([233,228,216,255],i);
function blend(x,y,data,a){if(x<0||x>=sheetW||y<0||y>=sheetH)return;let i=(y*sheetW+x)*4;for(let c=0;c<3;c++)sheet[i+c]=Math.round((data[c]*a+sheet[i+c]*(255-a))/255);}
const manifest={status:"candidate; independent multi-angle hand review pending",pinnedTwoView:"899a86dc038b9a9157d962099da261e02ebf3f0d",independentTwoViewApproval:"2026-11-25: NE/SW eight slots approved for two-view offline use only",profileSourceSha256:sha(profile),directions:{}};
for(const [row,[h,link]] of Object.entries(views).entries()){
 const group=h==="E"||h==="W"?"e-w":"n-s-nw-se",basePath="arena/art/tools/candidates/eight-base",dir=JSON.parse(git(`${basePath}/${group}/idle/pose.json`)).directions[h];
 await mkdir(new URL(h+"/",out),{recursive:true});manifest.directions[h]={};
 for(const [col,name]of names.entries()){
  const side=name.startsWith("left")?"left":"right",kind=name.endsWith("Grab")?"grab":"brace";
  let buf,wp,cp,normal,details;
  if(link){
   const [from,deg]=link,p=src.directions[from][name],old=await readFile(new URL("revised/"+p.image,root));
   const {data,info:{width:w,height:hh}}=await sharp(old).ensureAlpha().raw().toBuffer({resolveWithObject:true});
   // World-plane yaw: P·R·P^-1, P=(1, .5). No reflection; the
   // determinant stays +1 even when fingers point to the opposite side.
   const a=deg*Math.PI/180,c=Math.cos(a),s=Math.sin(a),m=[c,-2*s,.5*s,c];
   const xy=([x,y])=>[m[0]*x+m[1]*y,m[2]*x+m[3]*y],corners=[[0,0],[w,0],[0,hh],[w,hh]].map(xy);
   const left=Math.floor(Math.min(...corners.map(v=>v[0]))),top=Math.floor(Math.min(...corners.map(v=>v[1]))),width=Math.ceil(Math.max(...corners.map(v=>v[0])))-left,height=Math.ceil(Math.max(...corners.map(v=>v[1])))-top;
   const restore=(h==="N"||h==="NW")&&kind==="grab",pad=restore?5:0;
   const bw=width+2*pad,bh=height+2*pad,pixel=Buffer.alloc(bw*bh*4),local=pt=>xy(pt).map((v,j)=>v-[left,top][j]+pad);
   const anchor=xy(p.wristPivot),contact=xy(p.localContact),axis=norm(contact.map((v,i)=>v-anchor[i])),distance=Math.hypot(...contact.map((v,i)=>v-anchor[i]));
   let full;
   if(restore){
    const path=new URL("revised/"+p.source,root);full=await sharp(path.pathname).extract(p.sourceCrop).ensureAlpha().raw().toBuffer({resolveWithObject:true});
   }
   for(let y=0;y<bh;y++)for(let x=0;x<bw;x++){
    let sum=[0,0,0],alpha=0;
    for(const dy of [.125,.375,.625,.875])for(const dx of [.125,.375,.625,.875]){
     let tx=x+left+dx-pad,ty=y+top+dy-pad;
     if(restore){
      const ax=tx-anchor[0],ay=ty-anchor[1],t=ax*axis[0]+ay*axis[1],v=-ax*axis[1]+ay*axis[0];
      const weight=Math.max(0,Math.min(1,(t/distance-.2)/.62));
      const cross=v/(1+weight*(h==="NW"?2.05:1.4));
      const u=t<=distance?t:distance+(t-distance)/1.25;
      tx=anchor[0]+axis[0]*u-axis[1]*cross;ty=anchor[1]+axis[1]*u+axis[0]*cross;
     }
     const xx=c*tx+2*s*ty,yy=-.5*s*tx+c*ty;
     if(xx<0||xx>=w||yy<0||yy>=hh)continue;
     const iw=full?.info.width??w,ih=full?.info.height??hh,d=full?.data??data,i=4*(Math.floor(yy*ih/hh)*iw+Math.floor(xx*iw/w)),aa=d[i+3];alpha+=aa;for(let k=0;k<3;k++)sum[k]+=aa*d[i+k];
    }if(alpha)pixel.set([...sum.map(v=>Math.round(v/alpha)),Math.round(alpha/16)],4*(y*bw+x));
   }
   buf=await sharp(pixel,{raw:{width:bw,height:bh,channels:4}}).png().toBuffer();wp=local(p.wristPivot);cp=local(p.localContact);normal=norm(xy(p.wristTowardElbow));
   details={source:`../revised/${p.image}`,sourceHash:sha(old),method:"same anatomical hand, positive-determinant ground-plane yaw; visible surfaces require review",degrees:deg,matrix:m};
   if(restore)details.hookVolume="High-resolution retained original; transverse thickness only beyond wrist, endpoint segment extended beyond rung. Wrist and rung axes fixed.";
  }else{
   const [rect,wr,el,contact]=fresh[h][col],s=profileRatio;
   const b={left:Math.round(rect[0]*s),top:Math.round(rect[1]*s),width:Math.round(rect[2]*s)-Math.round(rect[0]*s),height:Math.round(rect[3]*s)-Math.round(rect[1]*s)};
   buf=await sharp(profile).extract(b).resize({width:kind==="grab"?9:10}).png().toBuffer();const {width,height}=await sharp(buf).metadata();
   const local=([x,y])=>[(x*s-b.left)*width/b.width,(y*s-b.top)*height/b.height];
   wp=local(wr);cp=local(contact);normal=norm(local(el).map((v,i)=>v-wp[i]));
   details={method:"new independently painted profile",source:"../source/profile.png",sourceGrid:`R${h==="E"?1:2}C${col+1}`,sourceCrop:b};
  }
  const image=h+"/"+name+".png";await writeFile(new URL(image,out),buf);const {data,info:{width:w,height:hh}}=await sharp(buf).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const wa=dir.joints[side+"Wrist"].restOffset,L=Math.hypot(...wa),fd=fwd[h],rail=norm([-fd[1]-fd[0],.5*(-fd[1]+fd[0])]);
  manifest.directions[h][name]={image,size:[w,hh],anatomicalSide:side,gesture:kind,wristPivot:wp,localContact:cp,wristTowardElbow:normal,rungScreenAxis:rail,status:(h==="N"||h==="NW")&&kind==="grab"?"pending revised hook-volume review":"offline source accepted at 724397e",...details};
  for(const [oi,ward]of [false,true].entries()){
   const cx=col*64+32,cy=(row*2+oi)*46+23;
   for(let t=-24;t<=24;t+=.4){let x=Math.round(cx+t*rail[0]),y=Math.round(cy+t*rail[1]);blend(x,y,[144,120,77],255);if(kind==="grab")blend(x,y+1,[181,148,97],230);}
   const wrist=[cx-cp[0]+wp[0],cy-cp[1]+wp[1]],ang=Math.atan2(-normal[1],-normal[0])-Math.atan2(wa[1],wa[0]),c=Math.cos(ang),s=Math.sin(ang);
   for(const id of [side==="left"?"left-forearm-hand":"right-forearm",...(ward?[side+"-fore-sleeve"]:[])]){
    const at=dir.attachments.find(p=>p.id===id);
    const path=id==="left-forearm-hand"?`arena/art/tools/candidates/eight-work/hands/${h}/left-forearm.png`:`${basePath}/inputs/art/`+at.image.split("iso-v030-sample/").at(-1);
    const {data:p,info:k}=await sharp(git(path)).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    for(let y=Math.max(0,cy-22);y<=cy+22;y++)for(let x=cx-30;x<=cx+30;x++){
     const dx=x-wrist[0],dy=y-wrist[1],u=dx*c+dy*s,v=-dx*s+dy*c;
     if((u*wa[0]+v*wa[1])/L>.65||Math.hypot(dx,dy)>L+1)continue;
     const xx=Math.round(at.pivot[0]+wa[0]+u),yy=Math.round(at.pivot[1]+wa[1]+v);
     if(xx<0||xx>=k.width||yy<0||yy>=k.height)continue;let i=(yy*k.width+xx)*4;blend(x,y,p.subarray(i,i+3),p[i+3]);
    }
   }
   for(let y=0;y<hh;y++)for(let x=0;x<w;x++){const i=4*(y*w+x);blend(Math.round(cx-cp[0]+x),Math.round(cy-cp[1]+y),data.subarray(i,i+3),data[i+3]);}
  }
 }
}
await writeFile(new URL("manifest.json",out),JSON.stringify(manifest,null,2)+"\n");
for(const scale of [1,4])await sharp(sheet,{raw:{width:sheetW,height:sheetH,channels:4}}).resize(sheetW*scale,sheetH*scale,{kernel:"nearest"}).png().toFile(new URL(`fit-${scale}x.png`,out).pathname);
