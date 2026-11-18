import sharp from 'sharp';
import { cellPng } from './motion-registration.mjs';

const inside=(x,y,polygon)=>{
  let hit=false;
  for(let i=0,j=polygon.length-1;i<polygon.length;j=i++) {
    const [a,b]=polygon[i],[c,d]=polygon[j];
    if((b>y)!==(d>y)&&x<(c-a)*(y-b)/(d-b)+a)hit=!hit;
  }
  return hit;
};

// Masks and joints are in the preserved source crop, not the already warped atlas.
const limbs={
  W:{
    sourceJoints:[[64,136],[36,156],[64,185]],
    targetJoints:[[98,112],[88,130],[102,139]],
    widths:[.60,.66],bootScale:.45,
    polygons:[
      [[55,122],[72,131],[74,141],[44,156],[38,162],[26,160],[26,151],[40,136]],
      [[29,151],[44,153],[53,166],[69,182],[65,190],[48,175],[31,166],[26,160]],
      [[61,181],[73,184],[86,192],[84,203],[73,217],[65,223],[61,220],[65,207],[65,197],[60,190]],
    ],
    support:[[92,111],[111,113],[109,131],[105,138],[109,145],[112,158],[110,173],
      [86,173],[86,166],[99,161],[98,153],[94,143],[94,135]],
    shift:-2,
  },
  E:{
    sourceJoints:[[116,240],[173,275],[136,347]],
    targetJoints:[[97,110],[106,130],[91,139]],
    widths:[.25,.26],bootScale:.24,
    polygons:[
      [[118,217],[150,234],[178,251],[190,263],[190,279],[176,289],[160,283],[133,274],[91,263],[101,235]],
      [[160,270],[183,267],[190,279],[180,297],[158,328],[143,353],[126,348],[131,325],[137,302],[157,281]],
      [[128,339],[147,345],[144,365],[144,388],[158,404],[160,418],[149,423],[135,413],[119,394],[101,378],[105,367]],
    ],
    support:[[89,112],[101,112],[106,129],[103,139],[99,150],[99,161],[110,166],
      [111,173],[85,173],[85,164],[88,152],[91,143],[87,131]],
    shift:2,
  },
};

function inverseJoint(x,y,a,b,c,d,width) {
  const sl=Math.hypot(b[0]-a[0],b[1]-a[1]),tl=Math.hypot(d[0]-c[0],d[1]-c[1]);
  const sx=(b[0]-a[0])/sl,sy=(b[1]-a[1])/sl,tx=(d[0]-c[0])/tl,ty=(d[1]-c[1])/tl;
  const dx=x-c[0],dy=y-c[1],along=(dx*tx+dy*ty)*sl/tl,across=(-dx*ty+dy*tx)/width;
  return [a[0]+along*sx-across*sy,a[1]+along*sy+across*sx];
}

function sample(data,info,x,y,polygon) {
  if(!inside(x,y,polygon))return [0,0,0,0];
  const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy,result=[0,0,0,0];
  for(const [dx,dy,w] of [[0,0,(1-fx)*(1-fy)],[1,0,fx*(1-fy)],[0,1,(1-fx)*fy],[1,1,fx*fy]]) {
    const px=ix+dx,py=iy+dy;
    if(px<0||py<0||px>=info.width||py>=info.height)continue;
    const p=(py*info.width+px)*4,a=data[p+3]/255*w;
    for(let c=0;c<3;c++)result[c]+=data[p+c]*a;
    result[3]+=a;
  }
  return result;
}

export async function sidePassing(image,sprite,supportImage,direction) {
  const spec=limbs[direction],{data,info}=await sharp(sprite.image).raw().toBuffer({resolveWithObject:true});
  const torso=await sharp(image).raw().toBuffer(),support=await sharp(supportImage).raw().toBuffer();
  const background=Buffer.alloc(torso.length);
  for(let y=103;y<174;y++)for(let x=65;x<132;x++) {
    const p=(y*192+x)*4,[r,g,b]=torso.subarray(p,p+3);
    if(y>=112||(r>145&&r-g>12&&g-b>8))torso.fill(0,p,p+4);
    const sx=x-spec.shift;
    if(y>=112&&inside(sx+.5,y+.5,spec.support)) {
      const q=(y*192+sx)*4;support.copy(background,p,q,q+4);
      for(let c=0;c<3;c++)background[p+c]=Math.round(background[p+c]*.96);
    }
  }
  const pieces=spec.polygons.map((polygon,part)=>{
    const result=Buffer.alloc(torso.length);
    for(let y=105;y<166;y++)for(let x=70;x<125;x++) {
      const rgba=[0,0,0,0];
      // Area samples keep diagonal mask boundaries clean without blurring the completed pose.
      for(const dx of [-.25,.25])for(const dy of [-.25,.25]) {
        const [sx,sy]=part===2?
          [spec.sourceJoints[2][0]+(x+dx-spec.targetJoints[2][0])/spec.bootScale,
            spec.sourceJoints[2][1]+(y+dy-spec.targetJoints[2][1])/spec.bootScale]:
          inverseJoint(x+dx,y+dy,spec.sourceJoints[part],spec.sourceJoints[part+1],
            spec.targetJoints[part],spec.targetJoints[part+1],spec.widths[part]);
        const sampled=sample(data,info,sx,sy,polygon);
        for(let c=0;c<4;c++)rgba[c]+=sampled[c]/4;
      }
      const p=(y*192+x)*4;
      if(rgba[3])for(let c=0;c<3;c++)result[p+c]=Math.round(rgba[c]/rgba[3]);
      result[p+3]=Math.round(rgba[3]*255);
    }
    return result;
  });
  const layers=[background,...pieces,torso];
  return {image:await sharp(await cellPng(layers[0])).composite(
    await Promise.all(layers.slice(1).map(async raw=>({input:await cellPng(raw)})))).png().toBuffer(),
    recipe:{module:'four-head-side-passing.mjs',direction,sourceCrop:sprite.crop,
      sourceJoints:spec.sourceJoints,targetJoints:spec.targetJoints,transverseScale:spec.widths,bootScale:spec.bootScale,
      supportSource:'arena/art/source/four-head-walk-body.png',supportPhase:'01',supportShiftX:spec.shift,
      method:'Source-resolution thigh/shin joint registration; complete generated boot; original phase01 support leg moved behind near swing leg. No scanline dilation or atlas-stage erasure patches.',
      status:'candidate pending independent real-FPS review'}};
}
