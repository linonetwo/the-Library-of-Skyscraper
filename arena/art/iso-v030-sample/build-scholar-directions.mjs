import sharp from 'sharp';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const rig=JSON.parse(await readFile(new URL('attachments-six-directions/rig.json',import.meta.url),'utf8'));
const hair=JSON.parse(await readFile(new URL('equipment-hair-additional/attachments.json',import.meta.url),'utf8'));
const output=new URL('equipment-scholar-additional/',import.meta.url);
await mkdir(output,{recursive:true});
const configs={
  E:{source:'iso-v030-scholar-ewns.png',sample:[1280,1280],region:[0,0,640,620],anchor:[315,80],scale:.1,hole:[310,66,48,14]},
  W:{source:'iso-v030-scholar-ewns.png',sample:[1280,1280],region:[640,0,640,620],anchor:[935,80],scale:.1,hole:[940,66,48,14]},
  N:{source:'iso-v030-scholar-ewns.png',sample:[1280,1280],region:[0,620,640,660],anchor:[310,685],scale:.1,hole:[310,677,48,12]},
  S:{source:'iso-v030-scholar-ewns.png',sample:[1280,1280],region:[640,620,640,660],anchor:[940,695],scale:.1,hole:[940,695,53,24]},
  NW:{source:'iso-v030-scholar-nwse.png',sample:[1792,896],region:[0,0,896,896],anchor:[450,130],scale:.0735,hole:[450,113,65,24],armHoles:[[328,280,43,66]]},
  SE:{source:'iso-v030-scholar-nwse.png',sample:[1792,896],region:[896,0,896,896],anchor:[1320,143],scale:.0735,hole:[1320,130,65,35],armHoles:[[1205,290,39,65]]},
};
const report={status:'static-outfit-prototype',releaseApproved:false,cell:[192,192],groundPivot:[96,172.8],renderScale:1,
  sources:{},directions:{}},cache={},views=[];
for(const [column,[direction,c]]of Object.entries(configs).entries()){
  await mkdir(new URL(`${direction}/`,output),{recursive:true});
  if(!cache[c.source]){
    const bytes=await readFile(new URL(`../source/${c.source}`,import.meta.url)),m=await sharp(bytes).metadata();
    cache[c.source]=await sharp(bytes).resize(...c.sample,{fit:'contain'}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    report.sources[c.source]={sha256:createHash('sha256').update(bytes).digest('hex'),sourceSize:[m.width,m.height],samplingCanvas:c.sample};
  }
  const {data,info}=cache[c.source],pixels=Buffer.from(data),neck=rig.directions[direction].joints.neck.cell;
  const [rx,ry,rw,rh]=c.region,[hx,hy,hw,hh]=c.hole;
  for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++){
    const p=(y*info.width+x)*4;
    const inArm=(c.armHoles??[]).some(([ax,ay,aw,ah])=>((x-ax)/aw)**2+((y-ay)/ah)**2<1);
    if(x<rx||x>=rx+rw||y<ry||y>=ry+rh||((x-hx)/hw)**2+((y-hy)/hh)**2<1||inArm||pixels[p+3]<=8)
      pixels.fill(0,p,p+4);
  }
  const cloth=await sharp(pixels,{raw:info}).extract({left:rx,top:ry,width:rw,height:rh})
    .resize({width:Math.round(rw*c.scale)}).png().toBuffer();
  const image=`${direction}/outfit-scholar.png`,buffer=await sharp({create:{width:192,height:192,channels:4,background:'#00000000'}})
    .composite([{input:cloth,left:Math.round(neck[0]-(c.anchor[0]-rx)*c.scale),top:Math.round(neck[1]-(c.anchor[1]-ry)*c.scale)}])
    .png().toBuffer();
  await writeFile(new URL(image,output),buffer);
  const a={id:'outfit-scholar',layer:'outfit-scholar',joint:'pelvis',image,
    pivot:rig.directions[direction].joints.pelvis.cell,restTopLeft:[0,0],size:[192,192],zOrder:0,
    source:c.source,sourceAnchor:c.anchor,sourceScale:c.scale,neckHole:c.hole,armHoles:c.armHoles??[]};
  report.directions[direction]=[a];
  for(const [row,style]of ['ivory','midnight'].entries()){
    const all=[...rig.directions[direction].attachments.map(a=>({...a,root:new URL('attachments-six-directions/',import.meta.url)})),
      {...a,root:output},...hair.directions[direction].filter(a=>a.layer.includes(style))
        .map(a=>({...a,root:new URL('equipment-hair-additional/',import.meta.url)}))];
    const depth={body:0,'outfit-scholar':50,'body-front':100,[`hair-${style}-back`]:-100,[`hair-${style}-front`]:150};
    all.sort((a,b)=>depth[a.layer]+a.zOrder-depth[b.layer]-b.zOrder);
    const view=await sharp({create:{width:192,height:192,channels:4,background:'#00000000'}})
      .composite(await Promise.all(all.map(async a=>({input:await readFile(new URL(a.image,a.root)),
        left:Math.round(a.restTopLeft[0]),top:Math.round(a.restTopLeft[1])})))).png().toBuffer();
    views.push({input:view,left:column*192,top:row*192});
  }
}
await writeFile(new URL('attachments.json',output),JSON.stringify(report,null,2)+'\n');
await sharp({create:{width:Object.keys(configs).length*192,height:384,channels:4,background:'#d5dfd9'}})
  .composite(views).png().toFile(new URL('scholar-additional-directions-preview.png',import.meta.url).pathname);
