import sharp from 'sharp';
import { resample,cellPng } from './motion-registration.mjs';

const inside=([x,y],polygon)=>{
  let hit=false;
  for(let i=0,j=polygon.length-1;i<polygon.length;j=i++) {
    const [a,b]=polygon[i],[c,d]=polygon[j];
    if((b>y)!==(d>y)&&x<(c-a)*(y-b)/(d-b)+a)hit=!hit;
  }
  return hit;
};
function cut(raw,polygon,shade=1) {
  const result=Buffer.alloc(raw.length);
  for(let y=0;y<192;y++)for(let x=0;x<192;x++) {
    let coverage=0;for(const dx of [.25,.75])for(const dy of [.25,.75])if(inside([x+dx,y+dy],polygon))coverage+=.25;
    if(!coverage)continue;
    const p=(y*192+x)*4;raw.copy(result,p,p,p+4);
    result[p+3]=Math.round(result[p+3]*coverage);
    if(y<120&&raw[p]<110&&raw[p+1]<100)result[p+3]=0;
    for(let c=0;c<3;c++)result[p+c]=Math.min(255,Math.round(result[p+c]*shade));
  }
  return result;
}
export async function repairLegs(image,direction) {
  const raw=await sharp(image).raw().toBuffer(),torso=Buffer.from(raw),pieces=[];
  if(direction==='NE') {
    // Far lifted leg is re-rooted at the near hip; original support leg moves behind it.
    const near=[[83,110],[100,110],[95,128],[91,146],[88,159],[99,167],[99,174],[77,174],[77,159],[79,142],[83,127]];
    const far=[[103,102],[117,109],[125,115],[124,121],[109,135],[106,140],[112,150],[107,153],[99,150],[93,144],[95,135],[105,120],[102,117]];
    for(let y=103;y<192;y++)for(let x=75;x<128;x++) {
      const p=(y*192+x)*4,[r,g,b]=raw.subarray(p,p+3);
      if(y>=109||(r>140&&r-g>12&&g-b>8))torso.fill(0,p,p+4);
    }
    pieces.push(resample(cut(raw,near,.92),(x,y)=>[x-7*Math.max(0,(173-y)/63),y]));
    pieces.push(resample(cut(raw,far,1.04),(x,y)=>[x+12*Math.max(0,(140-y)/31),y]));
  } else {
    // Reuse generated thigh texture around a hip/knee joint, not a mirrored whole character.
    const forward=[[85,107],[102,107],[112,132],[113,143],[120,159],[133,166],[134,174],[114,174],[110,159],[103,143],[102,133],[89,120]];
    const rearLower=[[76,129],[86,131],[77,147],[70,157],[70,166],[76,169],[75,173],[64,173],[58,164],[61,154]];
    const thigh=[[83,107],[104,107],[113,127],[113,137],[102,140],[92,128]];
    for(let y=111;y<192;y++)for(let x=56;x<137;x++)
      if(y>=116||(x>=78&&x<=115))torso.fill(0,(y*192+x)*4,(y*192+x)*4+4);
    pieces.push(resample(cut(raw,forward,.9),(x,y)=>[x-7*Math.max(0,(173-y)/62),y]));
    pieces.push(cut(raw,rearLower,1.08));
    pieces.push(resample(cut(raw,thigh),(x,y)=>{
      const dx=x-89,dy=y-112,along=dx*-.464+dy*.886,across=(dx*-.886+dy*-.464)/1.12;
      return [96+along*.482-across*.876,112+along*.876+across*.482];
    }));
  }
  return sharp(await cellPng(torso)).composite(await Promise.all(pieces.map(async p=>({input:await cellPng(p)})))).png().toBuffer();
}
