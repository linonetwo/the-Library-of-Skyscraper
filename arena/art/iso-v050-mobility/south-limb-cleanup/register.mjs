import sharp from "sharp";
import {execFileSync} from "node:child_process";
import {writeFile} from "node:fs/promises";
import {createHash} from "node:crypto";
const dir=new URL("./",import.meta.url), sha=b=>createHash("sha256").update(b).digest("hex");
const revision="0644d5b",art="arena/art/tools/candidates/eight-base",fromGit=p=>execFileSync("git",["show",`${revision}:${p}`]);
const pose=JSON.parse(fromGit(art+"/n-s-nw-se/idle/pose.json"));
const manifest={direction:"S",scope:["run","jump"],sourceRevision:execFileSync("git",["rev-parse",`${revision}^{commit}`],{encoding:"utf8"}).trim(),attachments:{}},cells=[];
for(const [row,side]of ["left","right"].entries()){
 const id=side+"-thigh",source=art+`/inputs/art/attachments-six-directions/S/${id}.png`,orig=fromGit(source);
 const {data:old,info}=await sharp(orig).ensureAlpha().raw().toBuffer({resolveWithObject:true}),{width:w,height:h}=info,buf=Buffer.from(old);
 // Inclusive removed x range, rows 0..16 only. The isolated low-alpha
 // fingertip fringe ends at 16. Retain the genuine leg outline at L9/R5.
 const mask=Array.from({length:17},()=>side==="left"?[10,14]:[0,4]);
 let changed=0;const overlay=Buffer.from(old);
 for(let y=0;y<mask.length;y++)for(let x=mask[y][0];x<=mask[y][1];x++){
  const k=(y*w+x)*4;if(!buf[k+3])continue;buf[k+3]=0;changed++;
  overlay.set([223,47,103,Math.max(old[k+3],64)],k);
 }
 for(let k=0;k<old.length;k++){if(k%4!==3&&old[k]!==buf[k])throw Error("RGB changed");if(Math.floor(k/4/w)>=17&&old[k]!==buf[k])throw Error("Lower leg changed");}
 const dst=await sharp(buf,{raw:info}).png().toBuffer();await writeFile(new URL(id+".png",dir),dst);
 const reg=pose.directions.S.attachments.find(a=>a.id===id);
 manifest.attachments[id]={source,sourceSha256:sha(orig),image:id+".png",sha256:sha(dst),size:[w,h],joint:reg.joint,pivot:reg.pivot,restTopLeft:reg.restTopLeft,removedNonzeroAlphaPixels:changed,alphaMask:{rowsInclusive:[0,16],xInclusive:mask[0]},unchanged:"All RGB channels, all alpha outside mask, all rows from 17 onward. No rescale, trim, pivot shift or repainted garment."};
 for(const [col,raw]of[old,overlay,buf].entries()){
  const p=await sharp(raw,{raw:info}).flatten({background:"#e5e0d5"}).resize(w*7,h*7,{kernel:"nearest"}).png().toBuffer();
  cells.push({input:p,left:col*145+(145-w*7>>1),top:row*245+3});
 }
}
await writeFile(new URL("manifest.json",dir),JSON.stringify(manifest,null,2)+"\n");
await sharp({create:{width:435,height:490,channels:4,background:"#e5e0d5"}}).composite(cells).png().toFile(new URL("comparison.png",dir).pathname);
