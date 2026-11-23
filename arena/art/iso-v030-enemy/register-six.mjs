import sharp from "sharp";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import {createHash} from "node:crypto";
import {worldStandingPose} from "../tools/world-walk.mjs";
import {inside} from "./down/contact-masks.mjs";
const root=new URL("./",import.meta.url);
const target=new URL("six/",root);
await mkdir(target,{recursive:true});
const q=Math.SQRT1_2, forward={N:[-q,-q],NW:[-1,0],W:[-q,q],S:[q,q],SE:[1,0],E:[q,-q]};
const reg={upper:.265,lower:.255,hipZ:.54,ankleZ:.10,trackWidth:.16};
const names=["head","torso","lower-cloak","left-arm","right-arm","left-leg","right-leg"];
const standing={directions:{}}, down={directions:{}}, inventory=[];
// Angular hood and shoulder volume vary by view, while top, waist and
// ground height are invariant. F is horizontal view width (px at scale 1).
const calibration={
 N:{head:32,torso:41,skirt:40,arms:[[-15,103],[15,103]],dx:0},
 NW:{head:31,torso:37,skirt:39,arms:[[-12,108],[14,102]],dx:-1.2},
 W:{head:31,torso:33,skirt:34,arms:[[4,108],[-4,102]],dx:-1.8},
 S:{head:32,torso:41,skirt:40,arms:[[18,104],[-18,104]],dx:0},
 SE:{head:31,torso:37,skirt:39,arms:[[15,106],[-14,103]],dx:1.2},
 E:{head:31,torso:33,skirt:34,arms:[[-4,108],[4,102]],dx:1.8},
};
function components(data,w,h,threshold){
 const seen=new Uint8Array(w*h),q=new Int32Array(w*h), result=[];
 for(let p=0;p<w*h;p++){
  if(seen[p]||data[4*p+3]<threshold)continue;
  let end=1,a=0,l=w,t=h,r=0,b=0;q[0]=p;seen[p]=1;
  while(a<end){const pos=q[a++],x=pos%w,y=Math.floor(pos/w);l=Math.min(l,x);r=Math.max(r,x);t=Math.min(t,y);b=Math.max(b,y);
   for(let yy=Math.max(0,y-1);yy<=Math.min(h-1,y+1);yy++)for(let xx=Math.max(0,x-1);xx<=Math.min(w-1,x+1);xx++){
    const z=yy*w+xx;if(!seen[z]&&data[z*4+3]>=threshold){seen[z]=1;q[end++]=z;}
   }
  }
  if(end>1000)result.push({left:Math.max(0,l-2),top:Math.max(0,t-2),width:Math.min(w-1,r+2)-Math.max(0,l-2)+1,height:Math.min(h-1,b+2)-Math.max(0,t-2)+1,pixels:end});
 }
 return result;
}
function center(d,w,h,y){
 const yy=Math.min(h-1,Math.max(0,Math.round(y)));let s=0,n=0;
 for(let x=0;x<w;x++){const a=d[(yy*w+x)*4+3];if(a>72){s+=x*a;n+=a;}}
 return n?s/n:w/2;
}
const sub=(a,b)=>a.map((v,i)=>v-b[i]),add=(a,b)=>a.map((v,i)=>v+b[i]);
for(const [group,hs] of [["back",["N","NW","W"]],["front",["S","SE","E"]]]){
 for(const kind of ["parts","down"]){
  const file=`source/inkguard-six-${kind}-${group}.png`;
  let buf;try{buf=await readFile(new URL(file,root));}catch(err){if(process.argv.includes("--partial")&&err.code==="ENOENT")continue;throw err;}
  const {data,info}=await sharp(buf).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const count=kind==="parts"?7:4;
  const cells=components(data,info.width,info.height,32).sort((a,b)=>b.pixels-a.pixels).slice(0,count*3);
  if(cells.length!==count*3)throw Error(`Unexpected ${file}: got ${cells.length} islands`);
  cells.sort((a,b)=>(a.top+a.height/2)-(b.top+b.height/2));
  for(const [row,h] of hs.entries()){
   const entries=cells.slice(row*count,(row+1)*count).sort((a,b)=>a.left-b.left);
   const folder=`attachments/${h}/`;await mkdir(new URL(folder,target),{recursive:true});
   const conf=calibration[h];
   const d={joints:{root:{parent:null,cell:kind==="parts"?[96,172.8]:[128,204.8],restOffset:[0,0]}},attachments:[],poses:[]};
   const joint=(id,parent,point)=>d.joints[id]={parent,cell:point,restOffset:sub(point,d.joints[parent].cell)};
   const put=async(id,raw,size,pivot,j,z,layer="body")=>{
    const image=folder+id+".png";
    await sharp(raw,{raw:{width:size[0],height:size[1],channels:4}}).png().toFile(new URL(image,target).pathname);
    d.attachments.push({id,joint:j,image,pivot,zOrder:z,layer});
   };
   if(kind==="parts"){
    d.worldForward=forward[h];d.feet={};d.attackSide=conf.arms[0][1]>conf.arms[1][1]?"left":"right";
    joint("pelvis","root",[96,135]);joint("neck","pelvis",[96+conf.dx,98.5]);
   }
   for(const [col,entry] of entries.entries()){
    const {pixels,...crop}=entry;
    const manifest={file,sha256:createHash("sha256").update(buf).digest("hex"),heading:h,part:kind==="parts"?names[col]:`down-${col}`,crop};
    inventory.push(manifest);
    const original=sharp(buf).extract(crop);
    if(kind==="parts"){
     const w0=crop.width,h0=crop.height;
     const height=[34,41,34,34,34,49,49][col],width=Math.round(col<3?[conf.head,conf.torso,conf.skirt][col]:w0/h0*height*(col<5?1.12:1));
     const {data:pix}=await original.resize(width,height,{fit:"fill"}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
     // The new inventory is a little more red than the old violet ink.
     for(let i=0;i<pix.length;i+=4){const r=pix[i],g=pix[i+1],b=pix[i+2];if(r-g<37&&r-b<40){pix[i]=Math.round(r*.91);pix[i+1]=Math.round(g*.93);pix[i+2]=Math.min(255,Math.round(b*1.015));}}
     if(col<3){
      const j=col===0?"neck":"pelvis", c=d.joints[j].cell;
      const top=col===0?67.1:col===1?96:126.7;
      const pv=[width/2,c[1]-top];
      manifest.scaled=[width,height];manifest.pivot=pv;
      await put(names[col],pix,[width,height],pv,j,[7,4,3][col]);continue;
     }
     const arm=col<5, side=(col===3||col===5)?"left":"right", cap=arm?2:1;
     const middle=arm?height*.48:cap+.265*78.3837,lower=arm?height*.84:middle+.255*78.3837;
     const p=[cap,middle,lower].map(y=>[center(pix,width,height,y),y]);
     const ids=(arm?["Shoulder","Elbow","Wrist"]:["Hip","Knee","Ankle"]).map(n=>side+n);
     const wp=worldStandingPose(h,{registration:{...reg,heading:forward[h]}}).legs[side].screen.hip;
     const r=arm?conf.arms[side==="left"?0:1]:null;
     let point=arm?[96+r[0],r[1]]:wp;
     joint(ids[0],arm?"neck":"pelvis",point);
     for(let ix=1;ix<3;ix++){point=add(point,sub(p[ix],p[ix-1]));joint(ids[ix],ids[ix-1],point);}
     const slices=arm?[["upper-arm",0,middle+2.4],["forearm-hand",middle-2.4,height]]:[["thigh",0,middle+2.5],["shin",middle-2.5,lower+2.5],["boot",lower-2.5,height]];
     for(const [ix,[part,y0,y1]] of slices.entries()){
      const piece=Buffer.from(pix);for(let y=0;y<height;y++)if(y<y0||y>y1)for(let x=0;x<width;x++)piece[(y*width+x)*4+3]=0;
      const near=arm?(r[1]===Math.max(...conf.arms.map(k=>k[1]))):wp[1]>=172.8-.54*78.3837;
      await put(`${side}-${part}`,piece,[width,height],p[ix],ids[ix],arm?(near?5:1):(near?-1:-2));
     }
     if(!arm)d.feet[side]={joint:ids[2],soleOffset:[0,.1*78.38367177],bend:1};
     manifest.scaled=[width,height];manifest.anchors=p;manifest.worldForward=forward[h];
    }else{
     await registerFloor({col,h,crop,original,d,put,manifest});
    }
   }
   if(kind==="parts"){
    const side=d.attackSide,j=d.joints,sh=j[side+"Shoulder"].cell,rest=j[side+"Wrist"].cell;
    // Camera-depth blows are foreshortened relative to side views. In
    // particular, north must strike past the shoulder, not salute the hood.
    const wind={N:[4,12],S:[-5,13],W:[-6,13],E:[6,13],NW:[-7,13],SE:[6,13]}[h],
     strike={N:[8,-4],S:[-8,20],W:[-22,4],E:[22,4],NW:[-19,-2],SE:[20,11]}[h],
     bend=sh[0]<96?1:-1;
    d.actionTargets={attack:[rest,add(sh,wind),add(sh,strike),rest].map(point=>({[side+"Wrist"]:{point,bend}}))};
   }
   (kind==="parts"?standing:down).directions[h]=d;
  }
 }
}
for(const [name,obj] of [["standing-rig",standing],["down-rig",down],["source-registration",inventory]])
 await writeFile(new URL(name+".json",target),JSON.stringify(obj,null,2)+"\n");
console.log("Registered independent source directions",Object.keys(standing.directions),Object.keys(down.directions));

// Original source landmarks are box-normalized; all sizing is relative to
// standing/crouch in the same sheet row, preserving the artist's foreshortening.
async function registerFloor({col,h,crop,original,d,put,manifest}){
 const row=inventory.filter(i=>i.heading===h&&i.part==="down-0")[0];
 const scale=94/row.crop.height, w=Math.round(crop.width*scale),hh=Math.round(crop.height*scale);
 const {data}=await original.resize(w,hh,{fit:"fill"}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const left=h==="NW"||h==="W", rear=h==="N"||h==="NW";
 const reflect=left;
 const xFromRight=x=>reflect?1-x:x;
 // Manually picked on the original sheets displayed at 990 px wide.
 const surface={
    N:[[163,197],[426,193],[671,190],[914,190]],
    NW:[[103,410],[302,408],[533,398],[775,402]],
    W:[[112,632],[292,633],[518,620],[758,625]],
    S:[[161,191],[413,192],[643,188],[910,188]],
    SE:[[109,409],[424,406],[656,404],[924,402]],
    E:[[116,626],[418,622],[654,620],[918,620]]
 }[h][col];
 const sourceWidth=1536;
 let sx=(surface[0]*sourceWidth/990-crop.left)*w/crop.width,sy=(surface[1]*sourceWidth/990-crop.top)*hh/crop.height;
 // Snap target inside the painted contacting foot/palm/forearm. No bbox
 // center proxy and no rendered ground shadow.
 let best=Infinity;for(let y=0;y<hh;y++)for(let x=0;x<w;x++){if(data[(y*w+x)*4+3]<100)continue;const cost=(x-sx)**2+(y-sy)**2;if(cost<best){best=cost;manifest.contactPixel=[x,y];}}
 [sx,sy]=manifest.contactPixel;const dx=(reflect?-1:1)*[3,16,25,33][col],dy=[0,-2,-4,-4][col],pivot=[sx-dx,sy-dy];
 // Each hood is a separately tracked ascending shape as the guardian sinks;
 // polygons describe the occlusion boundary on the painted surface.
 const hood=[
 [[.13,0],[.87,0],[.86,.32],[.63,.43],[.33,.42],[.12,.31]],
 [[.24,0],[.90,0],[.91,.38],[.65,.47],[.34,.43],[.19,.29]],
 [[.40,0],[.98,0],[.99,.37],[.77,.55],[.48,.47],[.35,.32]],
 [[.55,0],[1,0],[1,.58],[.84,.71],[.61,.57],[.49,.27]],
 ][col];
 const arm=[
 [[.65,.50],[.88,.46],[.98,.70],[.86,.79],[.66,.71]],
 [[.67,.52],[.85,.50],[.91,.78],[1,.92],[.98,1],[.76,.97],[.68,.78]],
 [[.68,.59],[.84,.54],[.91,.80],[1,.87],[1,.99],[.70,.98],[.62,.79]],
 [[.70,.60],[.92,.58],[1,.75],[1,1],[.69,.99],[.58,.84]],
 ][col];
 const parts=[Buffer.alloc(data.length),Buffer.alloc(data.length),Buffer.alloc(data.length)];
 for(let y=0;y<hh;y++)for(let x=0;x<w;x++){
   const i=4*(y*w+x),xx=xFromRight(x/w),yy=y/hh;
   const part=parts[inside(xx,yy,hood)?1:inside(xx,yy,arm)?2:0];
   for(let c=0;c<4;c++)part[i+c]=data[i+c];
   const r=part[i],g=part[i+1],b=part[i+2]; if(r-g<46&&r-b<48){part[i]*=.84;part[i+1]*=.88;part[i+2]*=.97;}
 }
 const labels=["body","hood","brace"];
 for(const [ix,name] of labels.entries()) await put(`down-${col}-${name}`,parts[ix],[w,hh],pivot,"root",ix);
 d.poses.push({durationMs:[120,160,180,240][col],joints:{},groundSupport:{surface:["boot","palm","hip/forearm","side/forearm"][col],screenOffset:[dx,dy]},
 hiddenAttachments:[0,1,2,3].filter(i=>i!==col).flatMap(i=>labels.map(v=>`down-${i}-${v}`))});
 Object.assign(manifest,{size:[w,hh],groundOffset:[dx,dy],pivot,hoodPolygon:hood,armPolygon:arm,normalizedXReflected:reflect,rear});
}
