import sharp from "sharp";
import {readFile,writeFile,mkdir} from "node:fs/promises";
import {createHash} from "node:crypto";
const root=new URL("./",import.meta.url);
const names=["paper","mallet","folio","cargo"];
// Each opaque painted island is a complete object, separated from adjacent
// cells by wide transparent gutters. Measuring the originals avoids assuming
// the image generator centered a silhouette on an exact mathematical grid.
function islands(data,w,h) {
 const seen=new Uint8Array(w*h),q=new Int32Array(w*h),out=[];
 for(let p=0;p<w*h;p++){
  if(seen[p]||data[4*p+3]<40)continue;
  let n=1,a=0,l=w,t=h,r=0,b=0;q[0]=p;seen[p]=1;
  while(a<n){
   const z=q[a++],x=z%w,y=Math.floor(z/w);l=Math.min(l,x);r=Math.max(r,x);t=Math.min(t,y);b=Math.max(b,y);
   for(let yy=Math.max(0,y-1);yy<=Math.min(h-1,y+1);yy++)for(let xx=Math.max(0,x-1);xx<=Math.min(w-1,x+1);xx++){
    const k=yy*w+xx;if(!seen[k]&&data[k*4+3]>=40){seen[k]=1;q[n++]=k;}
   }
  }
  if(n>950)out.push({left:Math.max(0,l-2),top:Math.max(0,t-2),width:Math.min(w-1,r+2)-Math.max(0,l-2)+1,height:Math.min(h-1,b+2)-Math.max(0,t-2)+1,count:n});
 }
 return out.sort((a,b)=>b.count-a.count);
}
const scaleBox={paper:[24,21],mallet:[27,35],folio:[30,22],cargo:[31,27]};
const angles={N:[-12,-44,13,0],NW:[-17,-83,-30,0],W:[-19,-95,-30,0],S:[15,38,-10,0],SE:[16,80,30,0],E:[15,95,35,0]};
const opts=process.argv.slice(2), probe=opts.includes("--inspect");
const full={status:"actual-source-registration; product motion review separate",releaseApproved:false,renderScale:1,directions:{},sources:{}};
const marks=probe?{}:JSON.parse(await readFile(new URL("surface-points.json",root)));
for(const [group,hs]of [["front",["S","SE","E"]],["back",["N","NW","W"]]]){
 const file=`source/work-props-${group}.png`;
 let input;try{input=await readFile(new URL(file,root));}catch(e){if(probe&&e.code==="ENOENT")continue;throw e;}
 const sha=createHash("sha256").update(input).digest("hex"),{data,info}=await sharp(input).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 full.sources[file]=sha;
 const all=islands(data,info.width,info.height);if(all.length!==12)throw Error(`Expected 12 isolated props in ${file}; found ${all.length}`);
 all.sort((a,b)=>a.top+a.height/2-b.top-b.height/2);
 for(const [row,h]of hs.entries()){
  const items=all.slice(row*4,row*4+4).sort((a,b)=>a.left-b.left);
  full.directions[h]={};await mkdir(new URL(`${h}/`,root),{recursive:true});
  for(const [col,{count,...crop}]of items.entries()){
   const name=names[col], [maxW,maxH]=scaleBox[name];
   const s=Math.min(maxW/crop.width,maxH/crop.height),w=Math.round(crop.width*s),hh=Math.round(crop.height*s);
   if(probe){console.log(h,name,JSON.stringify(crop),w,hh);continue;}
   const image=`${h}/${name}.png`, points=marks[h][name];
   const result=await sharp(input).extract(crop).resize(w,hh,{fit:"fill"}).png().toBuffer();
   await writeFile(new URL(image,root),result);
   // Landmark coordinates are manually read on the 990px wide reference.
   const scale=info.width/990;
   const local=pt=>pt.map((v,i)=>Number(((v*scale-[crop.left,crop.top][i])*[w/crop.width,hh/crop.height][i]).toFixed(3)));
   const contacts=Object.fromEntries(Object.entries(points).map(([id,pt])=>[id,local(pt)]));
   const pix=await sharp(result).raw().toBuffer();
   for(const [id,[x,y]] of Object.entries(contacts)){
     const a=pix[(Math.round(y)*w+Math.round(x))*4+3];
     if(!(a>48))throw Error(`Not on painted surface ${h}/${name}/${id}: ${x},${y} alpha ${a}`);
   }
   const primary=name==="cargo"?"actorLeftPalm":name==="mallet"?"rightGrip":name==="folio"?"leftPalmSpine":"rightPalm";
   full.directions[h][name]={image,size:[w,hh],pivot:contacts[primary],contacts,
     contactType:{cargo:"dualPalm",mallet:"grip",folio:"palm",paper:"palm"}[name],
     joint:name==="cargo"||name==="folio"?"leftWrist":"rightWrist",layer:name==="cargo"?"cargo-bundle":"work-prop",
     visibleFrames:name==="paper"?[1,2]:name==="cargo"?{carry:"all",unload:"until release"}:[0,1,2,3],
     defaultAbsoluteAngles:name==="mallet"?angles[h]:[0,0,0,0],source:file,sourceRect:crop,
     sourceContactPoints:Object.fromEntries(Object.entries(points).map(([k,p])=>[k,p.map(v=>Math.round(v*scale))])),
     sourceSha256:sha
   };
  }
 }
}
if(!probe)await writeFile(new URL("manifest.json",root),JSON.stringify(full,null,2)+"\n");
