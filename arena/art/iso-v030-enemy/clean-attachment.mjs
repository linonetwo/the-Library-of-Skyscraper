import sharp from "sharp";
// A detached island in a canvas-sized arm cutout travels when the elbow rotates.
// Keep the largest 8-connected painted island plus its antialiasing fringe.
export async function cleanAttachment(file, id, heading) {
  const {data,info} = await sharp(file).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const {width:w,height:h}=info, n=w*h, seen=new Uint8Array(n);
  if(id==="torso")for(let y=83;y<102;y++)for(let x=0;x<w;x++){
    const left=heading==="SW"?45-(y-83)*.2:51-(y-83)*.19;
    const right=heading==="SW"?73+Math.max(0,y-92)*.28:73+(y-83)*.37;
    if(x<left-1||x>right+1)data[(y*w+x)*4+3]=0;
  }
  let keep=[];
  for(let i=0;i<n;i++) {
    if(seen[i] || data[i*4+3]<8) continue;
    const q=[i]; seen[i]=1;
    for(let j=0;j<q.length;j++){
      const p=q[j],x=p%w,y=Math.floor(p/w);
      for(let yy=Math.max(0,y-1);yy<=Math.min(h-1,y+1);yy++)
        for(let xx=Math.max(0,x-1);xx<=Math.min(w-1,x+1);xx++){
          const k=yy*w+xx;
          if(!seen[k]&&data[k*4+3]>=8){seen[k]=1;q.push(k);}
        }
    }
    if(q.length>keep.length) keep=q;
  }
  const allowed=new Uint8Array(n);
  for(const p of keep){
    const x=p%w,y=Math.floor(p/w);
    for(let yy=Math.max(0,y-1);yy<=Math.min(h-1,y+1);yy++)
      for(let xx=Math.max(0,x-1);xx<=Math.min(w-1,x+1);xx++) allowed[yy*w+xx]=1;
  }
  for(let i=0;i<n;i++) if(!allowed[i]) data[i*4+3]=0;
  // Extend the hidden edge behind the next drawing; otherwise bilinear
  // sampling a hard horizontal split produces a bright line even at rest.
  const seam=id==="head"?65:id==="torso"?101:null;
  if(seam!==null)for(let y=seam+1;y<=seam+3;y++)for(let x=0;x<w;x++){
    const a=(seam*w+x)*4,b=(y*w+x)*4;
    if(data[a+3]>150 && data[(seam*w+Math.max(0,x-2))*4+3]>150 && data[(seam*w+Math.min(w-1,x+2))*4+3]>150)
      data.copy(data,b,a,a+4);
  }
  await sharp(data,{raw:info}).png().toFile(file);
}
