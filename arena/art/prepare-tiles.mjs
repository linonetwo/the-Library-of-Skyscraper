import sharp from 'sharp';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { extractSourceSprites } from './source-sprites.mjs';
import { art, json, digest, keepPixel } from './idle-pipeline.mjs';
import { approvedMetadata } from './art-approval.mjs';

const output = new URL('../client/public/assets/tiles/', import.meta.url);
await mkdir(output, { recursive: true });
const assets = {}, sources = [];
for (const kind of ['floors', 'props']) {
  const name = `iso-${kind}`, bytes = await readFile(new URL(`source/${name}.png`, art));
  let source;
  if(kind==='floors') source=await extractSourceSprites(bytes,{columns:2,rows:2,keepPixel});
  else {
    // Generated shelf bottoms extend below the nominal half-sheet; authored row boundary is 55%.
    const meta=await sharp(bytes).metadata(),half=Math.round(meta.width/2),split=Math.round(meta.height*0.55);
    const sprites=[];
    for(const [left,top,width,height] of [[0,0,half,split],[half,0,meta.width-half,split],
      [0,split,half,meta.height-split],[half,split,meta.width-half,meta.height-split]]) {
      const cropped=await sharp(bytes).extract({left,top,width,height}).png().toBuffer();
      const {sprites:[sprite]}=await extractSourceSprites(cropped,{columns:1,rows:1,keepPixel});
      sprite.crop.x+=left;sprite.crop.y+=top;sprites.push(sprite);
    }
    source={sprites};
  }
  const ids = kind === 'floors'
    ? ['floor-stone', 'floor-worn', 'floor-inlay', 'floor-cracked']
    : ['bookcase-u', 'bookcase-v', 'plinth', 'lectern'];
  const height = kind === 'floors' ? 64 : 192, frames = {}, composites = [], registrations = [];
  for (const [index, id] of ids.entries()) {
    const sprite = source.sprites[index];
    let image;
    if (kind === 'floors') {
      const raw = await sharp(sprite.image).resize(128, 64, { fit: 'fill' }).ensureAlpha().raw().toBuffer();
      // Exact common diamond support and shared sandstone edge; generated texture remains inside.
      const edge = [235, 216, 178];
      for (let y = 0; y < 64; y++) for (let x = 0; x < 128; x++) {
        const p = (y * 128 + x) * 4, distance = Math.abs(x + 0.5 - 64) / 64 + Math.abs(y + 0.5 - 32) / 32;
        if (distance > 1) { raw.fill(0, p, p + 4); continue; }
        const mix = Math.min(1, Math.max(0, (1 - distance - 0.08) / 0.15)) * raw[p + 3] / 255;
        for (let c = 0; c < 3; c++) raw[p + c] = Math.round(edge[c] * (1 - mix) + raw[p + c] * mix);
        raw[p + 3] = 255;
      }
      image = await sharp(raw, { raw: { width: 128, height: 64, channels: 4 } }).png().toBuffer();
    } else {
      const sizes = [[112,168],[112,168],[100,96],[100,116]], [w,h] = sizes[index];
      const piece = await sharp(sprite.image).resize(w,h,{fit:'inside'}).png().toBuffer();
      const meta = await sharp(piece).metadata();
      image = await sharp({create:{width:128,height:192,channels:4,background:'#00000000'}})
        .composite([{input:piece,left:Math.round((128-meta.width)/2),top:184-meta.height}]).png().toBuffer();
    }
    await writeFile(new URL(`${id}.png`, output), image);
    const frame = { x: index * 132 + 2, y: 2, w: 128, h: height };
    composites.push({input:image,left:frame.x,top:frame.y});
    frames[id] = {frame,rotated:false,trimmed:false,spriteSourceSize:{x:0,y:0,w:128,h:height},
      sourceSize:{w:128,h:height}};
    assets[id] = {image:`${id}.png`,atlas:`${kind}.json`,frame:id,tileSize:[128,64],
      footprint:[1,1],pivot:kind==='floors'?[64,32]:[64,160],kind:kind==='floors'?'floor':'prop',
      ...approvedMetadata};
    registrations.push({id,sourceCrop:sprite.crop,pivot:assets[id].pivot,exportSize:[128,height],
      method:kind==='floors'?'Generated texture; exact 2:1 diamond mask and common 8%-wide edge blend.':
        'Generated isolated object; aspect-preserving fit, centered, visual base bottom y184.'});
  }
  const atlas = await sharp({create:{width:528,height:height+4,channels:4,background:'#00000000'}})
    .composite(composites).png().toBuffer();
  await writeFile(new URL(`${kind}.png`,output),atlas);
  await writeFile(new URL(`${kind}.json`,output),json({frames,meta:{image:`${kind}.png`,
    format:'RGBA8888',size:{w:528,h:height+4},scale:'1'}}));
  const provenance = {source:`arena/art/source/${name}.png`,sourceSha256:digest(bytes),
    promptSha256:digest(await readFile(new URL(`source/${name}-prompt.txt`,art))),
    atlasSha256:digest(atlas),generator:'GPT Image 2 via proxy-imagegen',...approvedMetadata,registrations};
  await writeFile(new URL(`source/${name}-registration.json`,art),json(provenance));
  sources.push(provenance);
}
await writeFile(new URL('manifest.json',output),json({schemaVersion:1,tileSize:[128,64],
  projection:'orthographic-2:1-isometric',walkableZ:0,...approvedMetadata,
  assets,sources,review:'All eight independent assets and floor seams visually approved. floor-cracked and bookcase-v are approved spare assets, not placed in the reviewed map; see approval record for runtime scope.'}));
const floor = await readFile(new URL('floor-stone.png',output)), pieces=[];
for(let u=0;u<3;u++)for(let v=0;v<3;v++)pieces.push({input:floor,left:128+(u-v)*64,top:(u+v)*32});
await sharp({create:{width:384,height:192,channels:4,background:'#24363cff'}}).composite(pieces)
  .png().toFile(new URL('iso-floor-seam-preview.png',art).pathname);
console.log('Packed four approved exact 128×64 floor tiles and four independent props; runtime/spare scope is recorded.');
