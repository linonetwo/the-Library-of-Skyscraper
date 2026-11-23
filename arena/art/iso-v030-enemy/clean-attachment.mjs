import sharp from "sharp";
// A detached island in a canvas-sized arm cutout travels when the elbow rotates.
// Keep the largest 8-connected painted island plus its antialiasing fringe.
export async function cleanAttachment(file) {
  const {data,info} = await sharp(file).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const {width:w,height:h}=info, n=w*h, seen=new Uint8Array(n);
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
  await sharp(data,{raw:info}).png().toFile(file);
}
