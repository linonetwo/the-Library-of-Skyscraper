import sharp from 'sharp';

export async function cellBytes(image, row, col) {
  return sharp(image).extract({ left: col * 196 + 2, top: row * 196 + 2, width: 192, height: 192 })
    .ensureAlpha().raw().toBuffer();
}
export const cellPng = data => sharp(data, { raw: { width:192, height:192, channels:4 } }).png().toBuffer();
export function bounds(data, lo = 0, hi = 192) {
  let left=192, right=-1, top=192, bottom=-1;
  for(let y=lo;y<hi;y++) for(let x=0;x<192;x++) if(data[(y*192+x)*4+3]>128) {
    left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);
  }
  return {left,right,top,bottom,width:right-left+1,height:bottom-top+1};
}
export function neckLine(data) {
  let width=192, neck=75;
  for(let y=69;y<=92;y++) { const b=bounds(data,y,y+1); if(b.width>0&&b.width<width) {width=b.width;neck=y;} }
  return neck;
}
export function interpolate(value, knots) {
  for(let n=1;n<knots.length;n++) if(value<=knots[n][0]) {
    const [a,b]=knots[n-1], [c,d]=knots[n];
    return b+(value-a)/(c-a)*(d-b);
  }
  return knots.at(-1)[1];
}
export function registration(source, target, phase) {
  const sn=neckLine(source), tn=neckLine(target), sh=bounds(source,0,sn), th=bounds(target,0,tn);
  const sole=bounds(source).bottom, bob=[0,0.6,0,0.6][phase];
  return { sourceHead:sh, targetHead:th, sourceNeck:sn, targetNeck:tn+bob,
    sourceSole:sole,targetSole:172, headScale:th.width/sh.width, torsoScale:0.82, legScale:0.92,
    headCenter:(sh.left+sh.right)/2,targetHeadCenter:(th.left+th.right)/2,
    yKnots:[[0,0],[sh.top,th.top+bob],[sn,tn+bob],[136,128],[sole,172],[sole+1,173],[192,192]] };
}
export function mapPoint([x,y], r) {
  const mix=Math.max(0,Math.min(1,(y-r.sourceNeck)/25));
  const scale=y<136 ? r.headScale*(1-mix)+r.torsoScale*mix
    : interpolate(y,[[136,r.torsoScale],[r.sourceSole,r.legScale],[192,r.legScale]]);
  const center=r.headCenter*(1-mix)+96*mix, target=r.targetHeadCenter*(1-mix)+96*mix;
  return [target+(x-center)*scale,interpolate(y,r.yKnots)];
}
export function resample(data, inverse) {
  const result=Buffer.alloc(data.length);
  for(let y=0;y<192;y++) for(let x=0;x<192;x++) {
    const [sx,sy]=inverse(x,y), x0=Math.floor(sx),y0=Math.floor(sy),fx=sx-x0,fy=sy-y0;
    const rgb=[0,0,0];let alpha=0;
    for(const [dx,dy,w] of [[0,0,(1-fx)*(1-fy)],[1,0,fx*(1-fy)],[0,1,(1-fx)*fy],[1,1,fx*fy]]) {
      const px=x0+dx,py=y0+dy;if(px<0||py<0||px>=192||py>=192)continue;
      const p=(py*192+px)*4,a=data[p+3]/255*w;alpha+=a;
      for(let c=0;c<3;c++)rgb[c]+=data[p+c]*a;
    }
    const p=(y*192+x)*4;if(alpha)for(let c=0;c<3;c++)result[p+c]=Math.round(rgb[c]/alpha);
    result[p+3]=Math.round(alpha*255);
  }
  return result;
}
export function normalizeBody(data,r) {
  return resample(data,(x,y)=>{
    const sy=interpolate(y,r.yKnots.map(([a,b])=>[b,a])),[zero]=mapPoint([0,sy],r),[one]=mapPoint([1,sy],r);
    return [(x-zero)/(one-zero),sy];
  });
}
export function garmentMotion(data, phase, row) {
  const turn=[-0.8,0.6,0.8,-0.6][phase], bob=[0,0.6,0,0.6][phase];
  const side=[1,0.7,0.4,-0.7,-1,-0.7,0.4,0.7][row];
  return resample(data,(x,y)=>{
    const hem=Math.max(0,Math.min(1,(y-95)/27));
    return [96+(x-96)/(1+turn*0.012)-turn*side*(1-hem)-turn*hem*0.55,y-bob];
  });
}
