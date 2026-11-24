import sharp from "sharp";
import{mkdir,readFile,writeFile}from"node:fs/promises";
import{createHash}from"node:crypto";
import{rows}from"./source/landmarks.mjs";
const base=new URL("./",import.meta.url),out=new URL("grounded/",base),legacy=new URL("source/legacy/",base);
await mkdir(out,{recursive:true});
const load=async(f,r)=>JSON.parse(await readFile(new URL(f,r))),json=async(f,v)=>writeFile(new URL(f,out),JSON.stringify(v,null,2)+"\n");
const {directions:old}=await load("variants-down/registration.json",legacy);
const clothes=await load("equipment-down-clothes/attachments.json",legacy),hair=await load("equipment-down-hair/attachments.json",legacy);
const result={cell:[256,256],groundPivot:[128,204.8],renderScale:1,status:"source candidate, not runtime acceptance",directions:{},sources:{}};
const q=Math.SQRT1_2,heads={N:[-q,-q],S:[q,q],E:[q,-q],W:[-q,q],NW:[-1,0],SE:[1,0]};
for(const h of ["NE","SW"]){
 const d=old[h],attachments=[];
 for(const [sub,items] of [["variants-down",d.parts],["equipment-down-clothes",clothes.directions[h]],["equipment-down-hair",hair.directions[h]]]){
  for(const p of items) attachments.push({...p,image:`../source/legacy/${sub}/${p.image}`,zOrder:p.zOrder??(p.id==="head"?8:3)});
 }
 result.directions[h]={heading:d.heading,hip:d.hip,neck:d.neck,crown:d.crown,shoulderWorld:d.shoulderWorld,attachments};
}
const project=([x,y,z])=>[128+64*(x-y),204.8+32*(x+y)-78.38367177*z];
const sub=(a,b)=>a.map((v,i)=>v-b[i]),norm=v=>Math.hypot(...v);
const unit=v=>v.map(n=>n/norm(v)),dot=(a,b)=>a[0]*b[0]+a[1]*b[1];
function largest(data,w,h){
 let best=[],seen=new Uint8Array(w*h);
 for(let i=0;i<w*h;i++){if(seen[i]||data[i*4+3]<50)continue;
  const work=[i];seen[i]=1;
  for(let j=0;j<work.length;j++){const p=work[j],x=p%w,y=Math.floor(p/w);
   for(let yy=Math.max(y-1,0);yy<=Math.min(y+1,h-1);yy++)for(let xx=Math.max(x-1,0);xx<=Math.min(x+1,w-1);xx++){
    const k=yy*w+xx;if(!seen[k]&&data[k*4+3]>=50){seen[k]=1;work.push(k);}
   }
  }if(work.length>best.length)best=work;
 }const mask=new Uint8Array(w*h);
 for(const p of best){const x=p%w,y=Math.floor(p/w);for(let yy=Math.max(y-1,0);yy<=Math.min(y+1,h-1);yy++)for(let xx=Math.max(x-1,0);xx<=Math.min(x+1,w-1);xx++)mask[yy*w+xx]=1;}
 for(let i=0;i<w*h;i++)if(!mask[i])data[4*i+3]=0;
}
for(const [h,row] of Object.entries(rows)){
 const heading=heads[h],side=[heading[1],-heading[0]];
 const wp=(f,t,z)=>[heading[0]*f+side[0]*t,heading[1]*f+side[1]*t,z];
 const hip=project(wp(0,0,.12)),neck=project(wp(.5,0,.15)),crown=project(wp(.82,0,.20));
 const direction={heading,hip,neck,crown,shoulderWorld:{left:wp(.4,.19,.16),right:wp(.4,-.19,.16)},attachments:[]};
 result.directions[h]=direction;await mkdir(new URL(h+"/",out),{recursive:true});
 const file=`source/grounded-${row.g}.png`,bytes=await readFile(new URL(file,base));
 result.sources[file]=createHash("sha256").update(bytes).digest("hex");
 const scale=(await sharp(bytes).metadata()).width/960;
 for(const [i,id]of ["head","torso","outfit-scholar","outfit-warden","hair-ivory","hair-midnight"].entries()){
   const isHead=i===0||i>=4,a=isHead?neck:hip,b=isHead?crown:neck;
   const bound={left:Math.round(row.edges[i]*scale),top:Math.round(row.y[0]*scale),width:Math.round(row.edges[i+1]*scale)-Math.round(row.edges[i]*scale),height:Math.round(row.y[1]*scale)-Math.round(row.y[0]*scale)};
   const {data,info:{width:w,height:hh}}=await sharp(bytes).extract(bound).ensureAlpha().raw().toBuffer({resolveWithObject:true});largest(data,w,hh);
   const [u,v]=row.p[i].map(pt=>pt.map((n,j)=>n*scale-[bound.left,bound.top][j]));
   const src=unit(sub(v,u)),tgt=unit(sub(b,a)),srcN=[-src[1],src[0]],dstN=[-tgt[1],tgt[0]];
   const longitudinal=norm(sub(b,a))/norm(sub(v,u));
   // Width perpendicular to the ground axis is not simply a scaled screen
   // width: preserve the jaw, mantle and shoulder radii at world scale.
   let vals=[];for(let p=0;p<w*hh;p++)if(data[p*4+3]>125)vals.push(dot(sub([p%w,Math.floor(p/w)],u),srcN));
   vals.sort((a,b)=>a-b);
   const lateral=[28,29,37,39,34,37][i]/(vals[Math.floor(vals.length*.99)]-vals[Math.floor(vals.length*.01)]);
   const layers=i<4?["single"]:["back","front"];
   for(const depth of layers){
    const raw=Buffer.alloc(256*256*4);
    for(let y=0;y<256;y++)for(let x=0;x<256;x++){
     const rel=[x+.5-a[0],y+.5-a[1]],p=dot(rel,tgt)/longitudinal,t=dot(rel,dstN)/lateral;
     const sx=u[0]+p*src[0]+t*srcN[0],sy=u[1]+p*src[1]+t*srcN[1],ix=Math.round(sx),iy=Math.round(sy);
     if(ix<0||iy<0||ix>=w||iy>=hh)continue;
     const k=4*(iy*w+ix);if(data[k+3]<12)continue;
     if(i>=4){
      const f=p/norm(sub(v,u)),r=t*lateral;
      // Nape and ponytail disappear behind the cheek; front fringe and
      // crest stay visible. Ivory and blue-black remain independent pairs.
      const back=f<.03||(f<.40&&Math.abs(r)>11);
      if((depth==="back")!==back)continue;
     }
     data.copy(raw,4*(y*256+x),k,k+4);
    }
    const part=id+(depth==="single"?"":"-"+depth),image=`${h}/${part}.png`;
    await sharp(raw,{raw:{width:256,height:256,channels:4}}).png().toFile(new URL(image,out).pathname);
    direction.attachments.push({id:part,layer:i<2?"body":part,joint:isHead?"neck":"pelvis",image,pivot:a,restTopLeft:[0,0],size:[256,256],zOrder:[8,3,5,5,0,0][i],targetStart:a,targetEnd:b,source:file,sourceRect:bound,sourceStart:u.map((n,j)=>n+[bound.left,bound.top][j]),sourceEnd:v.map((n,j)=>n+[bound.left,bound.top][j]),axisScale:longitudinal,widthScale:lateral});
   }
 }
}
await json("manifest.json",result);
