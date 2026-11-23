import sharp from 'sharp';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const rig=JSON.parse(await readFile(new URL('attachments-six-directions/rig.json',import.meta.url),'utf8'));
const out=new URL('equipment-hair-additional/',import.meta.url);
await mkdir(out,{recursive:true});
const settings={
  ivory:{
    E:{crop:[0,0,640,600],scale:.075,at:[72,35]},
    W:{crop:[640,0,640,600],scale:.075,at:[72,35]},
    N:{crop:[0,600,640,680],scale:.075,at:[72,31]},
    S:{crop:[640,600,640,680],scale:.075,at:[72,31]},
    NW:{source:'iso-v030-hair-nwse.png',crop:[0,0,640,640],scale:.075,at:[73,35]},
    SE:{source:'iso-v030-hair-nwse.png',crop:[0,640,640,640],scale:.075,at:[73,35]},
  },
  midnight:{
    E:{crop:[0,0,640,600],scale:.08,at:[69,36]},
    W:{crop:[640,0,640,600],scale:.08,at:[71,36]},
    N:{crop:[0,600,640,680],scale:.075,at:[72,34]},
    S:{crop:[640,600,640,680],scale:.08,at:[70,34]},
    NW:{source:'iso-v030-hair-nwse.png',crop:[640,0,640,640],scale:.08,at:[71,35]},
    SE:{source:'iso-v030-hair-nwse.png',crop:[640,640,640,640],scale:.08,at:[71,35]},
  },
};
const report={status:'static-hair-registration-prototype',releaseApproved:false,renderScale:1,
  cell:[192,192],groundPivot:[96,172.8],sources:{},directions:{}};
const views=[];
const cache={};
for(const [style,dirs]of Object.entries(settings)){
  for(const [column,[direction,c]]of Object.entries(dirs).entries()){
    const sourceName=c.source??`iso-v030-${style}-ewns.png`;
    if(!cache[sourceName]){
      const bytes=await readFile(new URL(`../source/${sourceName}`,import.meta.url));
      const original=await sharp(bytes).metadata();
      cache[sourceName]=await sharp(bytes).resize(1280,1280,{fit:'contain'}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
      report.sources[sourceName]={source:sourceName,sha256:createHash('sha256').update(bytes).digest('hex'),
        originalSize:[original.width,original.height],samplingScale:1280/original.width,sourceSuccessCount:1};
    }
    const {data,info}=cache[sourceName];
    await mkdir(new URL(`${direction}/`,out),{recursive:true});
    const parts=[];
    for(const layer of ['back','front']){
      const b=Buffer.from(data);
      for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++){
        const p=(y*info.width+x)*4;
        const isBack=style==='midnight'&&((direction==='S'&&x>1040&&y>1000)
          ||(direction==='SE'&&x<910&&y>1000));
        const keep=(layer==='back'?isBack:!isBack)&&x>=c.crop[0]&&x<c.crop[0]+c.crop[2]&&y>=c.crop[1]&&y<c.crop[1]+c.crop[3];
        if(!keep||b[p+3]<=8)b.fill(0,p,p+4);
        // The generated open-face SE cap includes a stray brown jaw-outline.
        // Remove only that non-hair line inside the transparent face aperture.
        if(direction==='SE'&&y>1075&&(
          (style==='ivory'&&x>310&&x<470)||(style==='midnight'&&x>930&&x<1105)
        )&&b[p]>b[p+2]*1.18&&b[p]>b[p+1]*1.1)b.fill(0,p,p+4);
      }
      const piece=await sharp(b,{raw:info}).extract({left:c.crop[0],top:c.crop[1],width:c.crop[2],height:c.crop[3]})
        .resize({width:Math.round(c.crop[2]*c.scale)}).png().toBuffer();
      const image=await sharp({create:{width:192,height:192,channels:4,background:'#00000000'}})
        .composite([{input:piece,left:c.at[0],top:c.at[1]}]).png().toBuffer();
      const file=`${direction}/hair-${style}-${layer}.png`;
      await writeFile(new URL(file,out),image);
      parts.push({id:`hair-${style}-${layer}`,layer:`hair-${style}-${layer}`,joint:'neck',
        image:file,pivot:rig.directions[direction].joints.neck.cell,restTopLeft:[0,0],size:[192,192],zOrder:0,
        source:sourceName,sourceRect:c.crop,sourceScale:c.scale,placement:c.at});
    }
    (report.directions[direction]??=[]).push(...parts);
    const base=rig.directions[direction].attachments;
    const sorted=[...base.map(a=>({...a,root:new URL('attachments-six-directions/',import.meta.url)})),
      ...parts.map(a=>({...a,root:out}))];
    const depth={body:0,'body-front':100,[`hair-${style}-back`]:-100,[`hair-${style}-front`]:150};
    sorted.sort((a,b)=>depth[a.layer]+a.zOrder-depth[b.layer]-b.zOrder);
    const view=await sharp({create:{width:192,height:192,channels:4,background:'#00000000'}})
      .composite(await Promise.all(sorted.map(async a=>({input:await readFile(new URL(a.image,a.root)),
        left:Math.round(a.restTopLeft[0]),top:Math.round(a.restTopLeft[1])})))).png().toBuffer();
    views.push({input:view,left:column*192,top:(style==='ivory'?0:1)*192});
  }
}
await writeFile(new URL('attachments.json',out),JSON.stringify(report,null,2)+'\n');
await sharp({create:{width:1152,height:384,channels:4,background:'#d5dfd9'}}).composite(views).png()
  .toFile(new URL('hair-six-directions-preview.png',import.meta.url).pathname);
