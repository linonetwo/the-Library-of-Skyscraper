import sharp from 'sharp';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const source=await readFile(new URL('../source/iso-v030-warden-ne-sw.png',import.meta.url));
const {data,info}=await sharp(source).ensureAlpha().raw().toBuffer({resolveWithObject:true});
const base=JSON.parse(await readFile(new URL('attachments-complete/rig.json',import.meta.url),'utf8'));
const output=new URL('equipment-warden/',import.meta.url);
await mkdir(output,{recursive:true});
const coordinate={
  NE:{coatAnchor:[289,52],coatScale:.12,neckHole:[290,45,45,11],
    left:{region:[512,0,512,512],shoulder:[781,125],elbow:[751,274],wrist:[718,457]},
    right:{region:[1024,0,512,512],shoulder:[1228,125],elbow:[1231,273],wrist:[1280,457]}},
  SW:{coatAnchor:[288,565],coatScale:.12,neckHole:[289,565,45,12],
    left:{region:[512,512,512,512],shoulder:[754,635],elbow:[767,796],wrist:[773,968]},
    right:{region:[1024,512,512,512],shoulder:[1234,635],elbow:[1219,793],wrist:[1190,968]}},
};
const json={status:'static-registration-prototype',releaseApproved:false,cell:[192,192],
  groundPivot:[96,172.8],renderScale:1,source:'arena/art/source/iso-v030-warden-ne-sw.png',
  sourceSha256:createHash('sha256').update(source).digest('hex'),
  sourceSuccessCount:1,sourceAttempts:'first process exited143 without image; next invocation succeeded',
  notes:['Source sleeves explicitly registered to shared arm joints; coat independent of body.',
    'Near sleeves use outfit-warden-front above bare arm; hands extend beyond registered cuff.',
    'Action export and actual sleeve/hand overlap remain product review gates.'],directions:{}};
const previews=[];
const bilinear=(x,y,channel)=>{
  const x0=Math.floor(x),y0=Math.floor(y),fx=x-x0,fy=y-y0;
  if(x0<0||y0<0||x0+1>=info.width||y0+1>=info.height)return 0;
  const at=(a,b)=>data[(b*info.width+a)*4+channel];
  return Math.round(at(x0,y0)*(1-fx)*(1-fy)+at(x0+1,y0)*fx*(1-fy)+at(x0,y0+1)*(1-fx)*fy+at(x0+1,y0+1)*fx*fy);
};
for(const [index,direction]of ['NE','SW'].entries()) {
  await mkdir(new URL(`${direction}/`,output),{recursive:true});
  const c=coordinate[direction],joints=base.directions[direction].joints,near=direction==='NE'?'right':'left';
  const parts=[];
  async function save(id,layer,joint,pixels,extra={}) {
    const image=`${direction}/${id}.png`;
    const buffer=await sharp(pixels,{raw:{width:192,height:192,channels:4}}).png().toBuffer();
    await writeFile(new URL(image,output),buffer);
    parts.push({id,layer,joint,image,pivot:joints[joint].cell,restTopLeft:[0,0],size:[192,192],zOrder:0,...extra});
  }
  const coat=Buffer.alloc(192*192*4);
  const neck=joints.neck.cell;
  for(let y=0;y<192;y++)for(let x=0;x<192;x++) {
    const sx=c.coatAnchor[0]+(x-neck[0])/c.coatScale;
    const sy=c.coatAnchor[1]+(y-neck[1])/c.coatScale;
    if(sx<0||sx>=512||sy<index*512||sy>=(index+1)*512)continue;
    const [cx,cy,rx,ry]=c.neckHole;
    if(((sx-cx)/rx)**2+((sy-cy)/ry)**2<1)continue;
    const p=(y*192+x)*4;
    for(let k=0;k<4;k++)coat[p+k]=bilinear(sx,sy,k);
    if(coat[p+3]<=8)coat.fill(0,p,p+4);
  }
  await save('coat','outfit-warden','pelvis',coat,{sourceAnchor:c.coatAnchor,sourceScale:c.coatScale,neckHole:c.neckHole,zOrder:5});
  for(const side of ['left','right']) {
    const sc=c[side];
    for(const [part,start,end]of [['upper-sleeve','shoulder','elbow'],['fore-sleeve','elbow','wrist']]) {
      const capital=s=>s[0].toUpperCase()+s.slice(1);
      const sj=sc[start],ej=sc[end],tj=joints[side+capital(start)].cell,te=joints[side+capital(end)].cell;
      const sv=[ej[0]-sj[0],ej[1]-sj[1]],tv=[te[0]-tj[0],te[1]-tj[1]];
      const sl=Math.hypot(...sv),tl=Math.hypot(...tv),u=[tv[0]/tl,tv[1]/tl],su=[sv[0]/sl,sv[1]/sl];
      const transverseScale=.12,pixels=Buffer.alloc(192*192*4);
      for(let y=0;y<192;y++)for(let x=0;x<192;x++) {
        const dx=x-tj[0],dy=y-tj[1],along=dx*u[0]+dy*u[1],across=-dx*u[1]+dy*u[0];
        if(along< (start==='shoulder'?-8:-2.2)||along>tl+(end==='wrist'?1:2.2))continue;
        const s=along*sl/tl,r=across/transverseScale,sx=sj[0]+s*su[0]-r*su[1],sy=sj[1]+s*su[1]+r*su[0];
        const [rx,ry,rw,rh]=sc.region;
        if(sx<rx||sx>=rx+rw||sy<ry||sy>=ry+rh)continue;
        const p=(y*192+x)*4;
        for(let k=0;k<4;k++)pixels[p+k]=bilinear(sx,sy,k);
        if(pixels[p+3]<=8)pixels.fill(0,p,p+4);
      }
      await save(`${side}-${part}`,side===near?'outfit-warden-front':'outfit-warden',side+capital(start),pixels,{
        sourceJoint:sj,sourceEnd:ej,targetJoint:tj,targetEnd:te,
        explicitClothingFit:{axisScale:tl/sl,transverseScale},zOrder:part==='upper-sleeve'?1:2,
      });
    }
  }
  json.directions[direction]=parts;
  const hair=JSON.parse(await readFile(new URL('equipment-midnight/attachments.json',import.meta.url),'utf8'));
  const elements=[
    ...base.directions[direction].attachments.filter(a=>a.layer==='body'||a.layer==='body-front').map(a=>({...a,root:new URL('attachments-complete/',import.meta.url)})),
    ...parts.map(a=>({...a,root:output})),
    ...hair.directions[direction].map(a=>({...a,root:new URL('equipment-midnight/',import.meta.url)})),
  ];
  const depth={'hair-midnight-back':-100,body:0,'outfit-warden':50,'body-front':100,'outfit-warden-front':125,'hair-midnight-front':150};
  elements.sort((a,b)=>depth[a.layer]+a.zOrder-depth[b.layer]-b.zOrder);
  const image=await sharp({create:{width:192,height:192,channels:4,background:'#00000000'}}).composite(
    await Promise.all(elements.map(async a=>({input:await readFile(new URL(a.image,a.root)),left:Math.round(a.restTopLeft[0]),top:Math.round(a.restTopLeft[1])})))
  ).png().toBuffer();
  previews.push({input:image,left:index*192,top:0});
}
await writeFile(new URL('attachments.json',output),JSON.stringify(json,null,2)+'\n');
await sharp({create:{width:384,height:192,channels:4,background:'#d5dfd9'}}).composite(previews).png()
  .toFile(new URL('warden-midnight-rest-preview.png',import.meta.url).pathname);
await sharp(new URL('warden-midnight-rest-preview.png',import.meta.url).pathname).resize({width:1152,kernel:'nearest'}).png()
  .toFile(new URL('warden-midnight-rest-detail.png',import.meta.url).pathname);
