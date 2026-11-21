import sharp from 'sharp';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const out=new URL('../../client/public/assets/iso-v030-sample/',import.meta.url);
const bytes=await readFile(new URL('../source/iso-v030-scholar-ivory-sample.png',import.meta.url));
const prompt=await readFile(new URL('../source/iso-v030-scholar-ivory-sample-prompt.txt',import.meta.url));
const hash=b=>createHash('sha256').update(b).digest('hex');
const {data,info}=await sharp(bytes).ensureAlpha().raw().toBuffer({resolveWithObject:true});
for(let p=0;p<data.length;p+=4)if(data[p+3]<=8)data.fill(0,p,p+4);
// The generator painted collar interiors as dark cloth. Open only the interior,
// preserving the gold/ivory rim so the real body's neck shows through.
const collarOpenings=[{cx:355,cy:108,rx:45,ry:12},{cx:335,cy:720,rx:43,ry:22}];
for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++) {
  if(collarOpenings.some(e=>((x-e.cx)/e.rx)**2+((y-e.cy)/e.ry)**2<1))
    data.fill(0,(y*info.width+x)*4,(y*info.width+x)*4+4);
}
const clean=await sharp(data,{raw:info}).png().toBuffer();
const configs=[
  {direction:'NE',outfit:{crop:[176,72,344,524],scale:.122,at:[76,74]},hair:{crop:[688,96,440,408],scale:.105,at:[74,38]}},
  {direction:'SW',outfit:{crop:[160,672,368,528],scale:.122,at:[75,75]},hair:{crop:[688,696,448,432],scale:.105,at:[73,38]}},
];
const layers={'outfit-scholar':[],'hair-ivory':[],'hair-ivory-front':[],'hair-ivory-back':[]};
const records=[];
const cell=()=>sharp({create:{width:192,height:192,channels:4,background:'#00000000'}});
for(const config of configs) {
  for(const [kind,layer] of [['outfit','outfit-scholar'],['hair','hair-ivory']]) {
    const c=config[kind], [left,top,width,height]=c.crop;
    // One aspect-preserving source scale; no map-only body distortion.
    const image=await sharp(clean).extract({left,top,width,height}).resize({width:Math.round(width*c.scale)}).png().toBuffer();
    const full=await cell().composite([{input:image,left:c.at[0],top:c.at[1]}]).png().toBuffer();
    layers[layer].push(full);
    records.push({direction:config.direction,layer,...c});
    if(kind==='hair') {
      const {data:d,info:i}=await sharp(full).raw().toBuffer({resolveWithObject:true});
      const back=Buffer.alloc(d.length),front=Buffer.from(d);
      for(let y=0;y<192;y++)for(let x=0;x<192;x++) {
        // Nape/side locks behind the body; crown/bangs remain front of the skull.
        if(y<70 || (x>86 && x<109))continue;
        const p=(y*192+x)*4;d.copy(back,p,p,p+4);front.fill(0,p,p+4);
      }
      layers['hair-ivory-front'].push(await sharp(front,{raw:i}).png().toBuffer());
      layers['hair-ivory-back'].push(await sharp(back,{raw:i}).png().toBuffer());
    }
  }
}
for(const [layer,cells] of Object.entries(layers)) {
  const frames={};
  for(let index=0;index<2;index++) frames[`sample/${layer}/${configs[index].direction}/00`]={
    frame:{x:index*196+2,y:2,w:192,h:192},rotated:false,trimmed:false,
    spriteSourceSize:{x:0,y:0,w:192,h:192},sourceSize:{w:192,h:192},anchor:{x:.5,y:.9},
  };
  const image=await sharp({create:{width:392,height:196,channels:4,background:'#00000000'}})
    .composite(cells.map((input,index)=>({input,left:index*196+2,top:2}))).png().toBuffer();
  await writeFile(new URL(`${layer}.png`,out),image);
  await writeFile(new URL(`${layer}.json`,out),JSON.stringify({frames,meta:{image:`${layer}.png`,format:'RGBA8888',size:{w:392,h:196},scale:'1'}},null,2)+'\n');
}
const previews=[];
for(let index=0;index<2;index++) {
  const body=await sharp(await readFile(new URL('body.png',out))).extract({left:index*196+2,top:2,width:192,height:192}).png().toBuffer();
  const arm=await sharp(await readFile(new URL('body-front.png',out))).extract({left:index*196+2,top:2,width:192,height:192}).png().toBuffer();
  const composed=await cell().composite([
    {input:layers['hair-ivory-back'][index]},{input:body},{input:layers['outfit-scholar'][index]},
    {input:arm},{input:layers['hair-ivory-front'][index]},
  ]).png().toBuffer();
  previews.push({input:composed,left:index*192,top:0});
}
await sharp({create:{width:384,height:192,channels:4,background:'#d5dfd9'}})
  .composite(previews).png().toFile(new URL('equipped-static-preview.png',import.meta.url).pathname);
await writeFile(new URL('equipment-registration.json',out),JSON.stringify({
  status:'prototype',releaseApproved:false,sourcePoseOnly:true,walkApproved:false,
  source:'arena/art/source/iso-v030-scholar-ivory-sample.png',sourceSha256:hash(bytes),promptSha256:hash(prompt),
  generator:'GPT Image 2 via text-only proxy-imagegen; first attempt successful, no repeat success',
  layers:['hair-ivory-back','body','outfit-scholar','body-front','hair-ivory-front'],cell:[192,192],renderScale:1,
  records,collarOpeningMasks:collarOpenings,
  pending:['Independent front/back camera and garment fit review','Product layer-mask review','Rig attachment adaptation'],
},null,2)+'\n');
console.log('Built independent scholar + ivory layers, NE/SW static prototype.');
