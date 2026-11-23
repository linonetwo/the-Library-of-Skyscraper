import sharp from 'sharp';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const original=await readFile(new URL('../source/iso-v030-down-head-torso-ne-sw.png',import.meta.url));
const metadata=await sharp(original).metadata();
const {data,info}=await sharp(original).resize(1280,1280,{fit:'contain'}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
const output=new URL('variants-down/',import.meta.url);
await mkdir(output,{recursive:true});
const project=(x,y,z)=>[128+64*(x-y),204.8+32*(x+y)-78.38367177*z];
const definitions={
  NE:{heading:[0,-1],parts:{
    torso:{rect:[560,0,720,640],start:[721,492],end:[1155,157],widthScale:.1},
    head:{rect:[0,0,560,640],start:[143,465],end:[400,150],widthScale:.085},
  }},
  SW:{heading:[0,1],parts:{
    torso:{rect:[560,640,720,640],start:[1075,791],end:[653,1121],widthScale:.1},
    head:{rect:[0,640,560,640],start:[416,843],end:[168,1065],widthScale:.085},
  }},
};
const result={status:'grounded-head-torso-variants-prototype',releaseApproved:false,
  source:'arena/art/source/iso-v030-down-head-torso-ne-sw.png',
  sourceSha256:createHash('sha256').update(original).digest('hex'),sourceSuccessCount:1,
  sourceSize:[metadata.width,metadata.height],samplingCanvas:[1280,1280],
  canvas:[256,256],groundPivot:[128,204.8],renderScale:1,
  canvasApproval:'root approved 256 canvas and ground [128,204.8]; transparent margin only, world scale unchanged',
  pose:{hipZ:.12,neckZ:.15,crownZ:.2,neckForward:.5,crownForward:.82},
  directions:{}};
const views=[];
for(const [index,[direction,d]]of Object.entries(definitions).entries()){
  await mkdir(new URL(`${direction}/`,output),{recursive:true});
  const hip=project(0,0,.12),neck=project(d.heading[0]*.5,d.heading[1]*.5,.15),
    crown=project(d.heading[0]*.82,d.heading[1]*.82,.2);
  const parts=[];
  for(const [id,c]of Object.entries(d.parts)){
    const a=id==='torso'?hip:neck,b=id==='torso'?neck:crown;
    const sourceV=[c.end[0]-c.start[0],c.end[1]-c.start[1]],targetV=[b[0]-a[0],b[1]-a[1]];
    const sl=Math.hypot(...sourceV),tl=Math.hypot(...targetV),su=sourceV.map(v=>v/sl),tu=targetV.map(v=>v/tl);
    const pixels=Buffer.alloc(256*256*4);
    for(let y=0;y<256;y++)for(let x=0;x<256;x++){
      const dx=x-a[0],dy=y-a[1],along=(dx*tu[0]+dy*tu[1])*sl/tl,
        across=(-dx*tu[1]+dy*tu[0])/c.widthScale;
      const sx=c.start[0]+along*su[0]-across*su[1],sy=c.start[1]+along*su[1]+across*su[0];
      const [rx,ry,rw,rh]=c.rect;
      if(sx<rx||sx>=rx+rw||sy<ry||sy>=ry+rh)continue;
      const ix=Math.round(sx),iy=Math.round(sy),src=(iy*info.width+ix)*4,dst=(y*256+x)*4;
      if(data[src+3]>8)data.copy(pixels,dst,src,src+4);
    }
    const image=`${direction}/${id}.png`;
    await sharp(pixels,{raw:{width:256,height:256,channels:4}}).png().toFile(new URL(image,output).pathname);
    parts.push({id,layer:'body',joint:id==='torso'?'pelvis':'neck',image,canvas:[256,256],
      pivot:a,restTopLeft:[0,0],sourceRect:c.rect,sourceStart:c.start,sourceEnd:c.end,
      targetStart:a,targetEnd:b,axisScale:tl/sl,widthScale:c.widthScale,
      variant:'down-grounded',originalUprightSourceReused:false});
  }
  const sideVector=[d.heading[1],-d.heading[0]];
  const shoulderWorld=Object.fromEntries(['left','right'].map((side,i)=>{
    const sign=i===0?1:-1;
    return [side,[d.heading[0]*.4+sideVector[0]*.19*sign,
      d.heading[1]*.4+sideVector[1]*.19*sign,.16]];
  }));
  result.directions[direction]={heading:d.heading,hip,neck,crown,parts,shoulderWorld,
    finalLegIntent:{hipForward:0,hipZ:.12,ankleForward:-.55,ankleZ:.11,trackWidth:.18,
      kneeBranch:'bend upward from ground; actual world IK and source mapping pending'},
    pending:['arms and grounded legs','all clothing/hair variants','fall transition phases','product down cue and holdLast']};
  const image=await sharp({create:{width:256,height:256,channels:4,background:'#00000000'}})
    .composite(await Promise.all(parts.map(async p=>({input:await readFile(new URL(p.image,output)),left:0,top:0})))).png().toBuffer();
  views.push({input:image,left:index*256,top:0});
}
await writeFile(new URL('registration.json',output),JSON.stringify(result,null,2)+'\n');
await sharp({create:{width:512,height:256,channels:4,background:'#d5dfd9'}}).composite(views).png()
  .toFile(new URL('down-head-torso-registration-preview.png',import.meta.url).pathname);
