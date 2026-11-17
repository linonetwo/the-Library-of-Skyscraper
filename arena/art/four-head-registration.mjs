import sharp from 'sharp';
import { interpolate } from './motion-registration.mjs';

export const skeleton = {crown:12,chin:52,neck:56,shoulder:62,waist:94,hip:112,knee:142,sole:172};
export async function normalizeNeutral(sprite,pose={}) {
  const {data,info}=await sharp(sprite.image).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  // Remove connected off-white matte around the preserved source, never interior skin highlights.
  const queue=[],visited=new Uint8Array(info.width*info.height);
  for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++)
    if(x===0||y===0||x===info.width-1||y===info.height-1)queue.push(y*info.width+x);
  for(let n=0;n<queue.length;n++) {
    const q=queue[n];if(visited[q])continue;visited[q]=1;
    const p=q*4,[r,g,b,a]=data.subarray(p,p+4);
    if(a&&!(r>210&&g>205&&b>190&&Math.max(r,g,b)-Math.min(r,g,b)<45))continue;
    data[p+3]=0;const x=q%info.width,y=Math.floor(q/info.width);
    for(const [nx,ny] of [[x-1,y],[x+1,y],[x,y-1],[x,y+1]])
      if(nx>=0&&nx<info.width&&ny>=0&&ny<info.height)queue.push(ny*info.width+nx);
  }
  let lo=info.width,hi=0;
  const headCut=pose.headCut??63;
  for(let y=0;y<headCut+1;y++)for(let x=0;x<info.width;x++)if(data[(y*info.width+x)*4+3]>128) {
    lo=Math.min(lo,x);hi=Math.max(hi,x);
  }
  const headCenter=(lo+hi)/2,headScale=40/(hi-lo+1),bodyCenter=pose.bodyCenter??info.width/2,bodyScale=pose.bodyScale??.46;
  const knots=pose.knots??[[0,12],[63,52],[76,58],[168,94],[210,112],[300,142],[info.height,173]];
  const map=([x,y])=>{
    const mix=Math.max(0,Math.min(1,(y-headCut)/(pose.blendHeight??25)));
    let scale=headScale*(1-mix)+bodyScale*mix;
    if(pose.legScale){const leg=Math.max(0,Math.min(1,(y-pose.legFrom)/pose.legBlend));scale=scale*(1-leg)+pose.legScale*leg;}
    const center=headCenter*(1-mix)+bodyCenter*mix;
    return [96+(x-center)*scale,interpolate(y,knots)];
  };
  const output=Buffer.alloc(192*192*4),inverse=knots.map(([a,b])=>[b,a]);
  for(let y=12;y<173;y++)for(let x=0;x<192;x++) {
    const sy=interpolate(y,inverse),[zero]=map([0,sy]),[one]=map([1,sy]),sx=(x-zero)/(one-zero);
    const ix=Math.floor(sx),iy=Math.floor(sy),fx=sx-ix,fy=sy-iy,rgb=[0,0,0];let alpha=0;
    for(const [dx,dy,w] of [[0,0,(1-fx)*(1-fy)],[1,0,fx*(1-fy)],[0,1,(1-fx)*fy],[1,1,fx*fy]]) {
      if(ix+dx<0||ix+dx>=info.width||iy+dy<0||iy+dy>=info.height)continue;
      const p=((iy+dy)*info.width+ix+dx)*4,a=data[p+3]/255*w;alpha+=a;
      for(let c=0;c<3;c++)rgb[c]+=data[p+c]*a;
    }
    const p=(y*192+x)*4;for(let c=0;c<3;c++)output[p+c]=alpha?Math.round(rgb[c]/alpha):0;
    output[p+3]=Math.round(alpha*255);
  }
  return {image:await sharp(output,{raw:{width:192,height:192,channels:4}}).png().toBuffer(),
    map,recipe:{sourceCrop:sprite.crop,sourceHeadBounds:[lo,0,hi,headCut],headCenter,headScale,bodyCenter,bodyScale,
      yKnots:knots,...(pose.legScale?{legScale:pose.legScale,legFrom:pose.legFrom,legBlend:pose.legBlend}:{}),
      skeleton,groundPivot:[96,172.8],solePixelRow:172,sourceDeviation:'Generated source was approximately five–six heads; piecewise anatomy registration corrects it to reviewed four-head reference.'}};
}

export async function frontArms(image) {
  const {data,info}=await sharp(image).ensureAlpha().raw().toBuffer({resolveWithObject:true}),result=Buffer.alloc(data.length);
  for(let y=78;y<127;y++)for(let x=50;x<142;x++) {
    const p=(y*192+x)*4,[r,g,b,a]=data.subarray(p,p+4);
    if(a>96&&r>145&&g>95&&b>65&&r-g>12&&g-b>8)
      for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++) {
        const q=((y+dy)*192+x+dx)*4;data.copy(result,q,q,q+4);
      }
  }
  return sharp(result,{raw:info}).png().toBuffer();
}
