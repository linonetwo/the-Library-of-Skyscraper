import sharp from 'sharp';
import { cellPng,resample } from './motion-registration.mjs';

const inside=(x,y,polygon)=>{
  let hit=false;
  for(let i=0,j=polygon.length-1;i<polygon.length;j=i++) {
    const [a,b]=polygon[i],[c,d]=polygon[j];
    if((b>y)!==(d>y)&&x<(c-a)*(y-b)/(d-b)+a)hit=!hit;
  }
  return hit;
};
function inverseBone(x,y,[a,b],[c,d]) {
  const sl=Math.hypot(b[0]-a[0],b[1]-a[1]),tl=Math.hypot(d[0]-c[0],d[1]-c[1]);
  const su=[(b[0]-a[0])/sl,(b[1]-a[1])/sl],tu=[(d[0]-c[0])/tl,(d[1]-c[1])/tl];
  const dx=x-c[0],dy=y-c[1],along=(dx*tu[0]+dy*tu[1])*sl/tl,across=-dx*tu[1]+dy*tu[0];
  return [a[0]+along*su[0]-across*su[1],a[1]+along*su[1]+across*su[0]];
}

export async function lowerPassing(image,direction) {
  const raw=await sharp(image).raw().toBuffer(),body=Buffer.from(raw);
  const west=direction==='W';
  const polygons=west?[
    [[86,109],[101,107],[105,115],[88,123],[78,128],[72,124],[73,118]],
    [[75,120],[84,119],[101,138],[102,144],[93,146],[80,132]],
    [[93,138],[103,138],[107,147],[103,156],[98,158],[93,155],[94,149]],
  ]:[
    [[94,101],[102,101],[123,110],[125,119],[115,126],[96,117]],
    [[113,115],[125,116],[116,133],[106,144],[98,143],[101,132]],
    [[99,136],[109,138],[109,146],[113,151],[109,155],[101,153],[94,144]],
  ];
  const source=west?[[98,112],[79,122],[98,141]]:[[98,108],[116,117],[103,139]];
  const target=west?[[98,112],[91,134],[104,145]]:[[98,108],[101,134],[91,147]];
  const pieces=polygons.map(()=>Buffer.alloc(raw.length));
  for(let y=100;y<161;y++)for(let x=65;x<135;x++)for(let part=0;part<3;part++) {
    if(inside(x+.5,y+.5,polygons[part])) {
      const p=(y*192+x)*4;raw.copy(pieces[part],p,p,p+4);body.fill(0,p,p+4);
    }
  }
  const envelope=west?[[84,107],[103,106],[106,118],[96,130],[109,148],[105,160],[92,160],[91,143],[72,126],[71,117]]:
    [[94,100],[126,108],[128,122],[115,136],[115,158],[94,158],[93,140],[97,128],[96,120]];
  for(let y=100;y<161;y++)for(let x=65;x<135;x++)if((west?x<=100:x>=96)&&inside(x+.5,y+.5,envelope))
    body.fill(0,(y*192+x)*4,(y*192+x)*4+4);
  const posed=pieces.map((piece,part)=>resample(piece,(x,y)=>part===2?
    [x-target[2][0]+source[2][0],y-target[2][1]+source[2][1]]:
    inverseBone(x,y,[source[part],source[part+1]],[target[part],target[part+1]])));
  return sharp(await cellPng(body)).composite(await Promise.all(posed.map(async p=>({input:await cellPng(p)})))).png().toBuffer();
}

export async function restoreLegVolume(image,scale) {
  const raw=await sharp(image).raw().toBuffer(),result=Buffer.from(raw);
  for(let y=118;y<174;y++) {
    const runs=[];let start=-1;
    for(let x=50;x<=143;x++) {
      const visible=x<143&&raw[(y*192+x)*4+3]>12;
      if(visible&&start<0)start=x;
      if(!visible&&start>=0){runs.push([start,x-1]);start=-1;}
    }
    result.fill(0,(y*192+48)*4,(y*192+145)*4);
    const factor=1+(scale-1)*Math.min(1,(y-118)/8);
    for(const [lo,hi] of runs) {
      const center=(lo+hi)/2,half=(hi-lo+1)*factor/2;
      for(let x=Math.floor(center-half);x<=Math.ceil(center+half);x++) {
        const sx=center+(x-center)/factor,a=Math.floor(sx),f=sx-a,p=(y*192+x)*4;
        let alpha=0;const rgb=[0,0,0];
        for(const [px,w] of [[a,1-f],[a+1,f]])if(px>=lo&&px<=hi) {
          const q=(y*192+px)*4,opacity=raw[q+3]/255*w;alpha+=opacity;
          for(let c=0;c<3;c++)rgb[c]+=raw[q+c]*opacity;
        }
        if(alpha*255<=result[p+3])continue;
        for(let c=0;c<3;c++)result[p+c]=Math.round(rgb[c]/alpha);result[p+3]=Math.round(alpha*255);
      }
    }
  }
  return cellPng(result);
}
