import sharp from 'sharp';
import { cellPng } from './motion-registration.mjs';

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
