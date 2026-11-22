import sharp from 'sharp';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const root = new URL('./', import.meta.url);
const out = new URL('assets/', root);
const review = new URL('review/', root);
await mkdir(out, { recursive: true });
await mkdir(review, { recursive: true });
const sourceBytes = await readFile(new URL('source/p3-environment.png', root));
const { data: source, info } = await sharp(sourceBytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const project = (x, y, z = 0) => [64 * (x - y), 32 * (x + y) - 78.3837 * z];
const assets = {};
const images = {};
const S = 4; // Supersampled polygon coverage; no generated halo/background survives.
const mix = (a, b, t) => a * (1 - t) + b * t;
function sample(x, y, c) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const at = (xx, yy) => source[(Math.max(0, Math.min(info.height - 1, yy)) * info.width + Math.max(0, Math.min(info.width - 1, xx))) * 4 + c];
  return mix(mix(at(ix, iy), at(ix + 1, iy), fx), mix(at(ix, iy + 1), at(ix + 1, iy + 1), fx), fy);
}
function triangle(p, a, b, c) {
  const den = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]);
  const u = ((b[1] - c[1]) * (p[0] - c[0]) + (c[0] - b[0]) * (p[1] - c[1])) / den;
  const v = ((c[1] - a[1]) * (p[0] - c[0]) + (a[0] - c[0]) * (p[1] - c[1])) / den;
  return u >= -1e-6 && v >= -1e-6 && u + v <= 1 + 1e-6 ? [u, v, 1 - u - v] : null;
}
async function make(id, canvas, pivot, footprint, height, faces, extra = {}) {
  const [w, h] = canvas;
  const pixels = Buffer.alloc(w * h * S * S * 4);
  for (const face of faces) {
    const dst = face.world.map(p => { const q = project(...p); return [q[0] + pivot[0], q[1] + pivot[1]]; });
    for (const ids of [[0, 1, 2], [0, 2, 3]]) {
      const d = ids.map(i => dst[i]), s = ids.map(i => face.source[i]);
      const x0 = Math.max(0, Math.floor(Math.min(...d.map(p => p[0])) * S));
      const x1 = Math.min(w * S, Math.ceil(Math.max(...d.map(p => p[0])) * S));
      const y0 = Math.max(0, Math.floor(Math.min(...d.map(p => p[1])) * S));
      const y1 = Math.min(h * S, Math.ceil(Math.max(...d.map(p => p[1])) * S));
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
        const b = triangle([(x + .5) / S, (y + .5) / S], ...d);
        if (!b) continue;
        const sx = b.reduce((n, k, i) => n + k * s[i][0], 0);
        const sy = b.reduce((n, k, i) => n + k * s[i][1], 0);
        const at = (y * w * S + x) * 4;
        for (let c = 0; c < 3; c++) pixels[at + c] = sample(sx, sy, c);
        pixels[at + 3] = 255;
      }
    }
  }
  const resized=await sharp(pixels, { raw: { width: w * S, height: h * S, channels: 4 } }).resize(w, h).raw().toBuffer();
  for(let i=0;i<resized.length;i+=4){
    const x=(i/4)%w,y=Math.floor(i/4/w);
    if(resized[i+3]<=2||x===0||y===0||x===w-1||y===h-1)resized.fill(0,i,i+4);
  }
  images[id] = await sharp(resized,{raw:{width:w,height:h,channels:4}}).png().toBuffer();
  await writeFile(new URL(`${id}.png`, out), images[id]);
  assets[id] = {
    image: `${id}.png`, canvas, pivot, groundPivot: pivot, anchor: pivot.map((n, i) => n / canvas[i]),
    footprint, decorationOccupation: { centered: true, width: footprint[0], depth: footprint[1], collision: false },
    heightMeters: height, renderScale: 1, kind: height ? 'perimeter-prop' : 'floor-decal',
    layer: height ? 'world-depth' : 'floor-before-props', status: 'prototype', releaseApproved: false,
    source: 'source/p3-environment.png', sourceTransform: 'piecewise-affine faces to exact world vertices; 4x coverage downsample',
    sourceFaces: faces, ...extra,
  };
}
const a = [-1,-.11], b = [1,-.11], c = [1,.11], d = [-1,.11];
const top = p => [...p,.30], bottom = p => [...p,0];
await make('low-wall-u',[148,100],[74,62],[2,.22],.30,[
  {source:[[112,100],[615,274],[615,346],[113,174]],world:[top(d),top(c),bottom(c),bottom(d)]},
  {source:[[615,274],[646,256],[646,329],[615,346]],world:[top(c),top(b),bottom(b),bottom(c)]},
  {source:[[146,82],[646,256],[615,274],[112,100]],world:[top(a),top(b),top(c),top(d)]},
]);
const e = [-.11,-1], f = [.11,-1], g = [.11,1], h = [-.11,1];
await make('low-wall-v',[148,100],[74,62],[.22,2],.30,[
  {source:[[921,274],[1423,100],[1423,174],[921,346]],world:[top(g),top(f),bottom(f),bottom(g)]},
  {source:[[890,256],[921,274],[921,346],[891,331]],world:[top(h),top(g),bottom(g),bottom(h)]},
  {source:[[1390,82],[1423,100],[921,274],[890,256]],world:[top(e),top(f),top(g),top(h)]},
]);
await make('threshold-u',[156,80],[78,40],[2,.35],0,[
  {source:[[95,434],[165,402],[645,570],[574,602]],world:[[-1,.175,0],[-1,-.175,0],[1,-.175,0],[1,.175,0]]},
],{clearWidthMeters:2,walkable:true});
await make('threshold-v',[156,80],[78,40],[.35,2],0,[
  {source:[[890,570],[1367,402],[1440,434],[963,602]],world:[[-.175,1,0],[-.175,-1,0],[.175,-1,0],[.175,1,0]]},
],{clearWidthMeters:2,walkable:true});
await make('target-inlay',[260,132],[130,66],[2,2],0,[
  {source:[[390,821],[768,663],[1146,821],[768,989]],world:[[-1,1,0],[-1,-1,0],[1,-1,0],[1,1,0]]},
],{walkable:true});

const manifest = {
  schemaVersion:1, status:'prototype',releaseApproved:false,
  camera:{yaw:45,elevation:30,tileSize:[128,64],zScale:78.3837,worldUnitMeters:1},
  sources:{'source/p3-environment.png':{sha256:createHash('sha256').update(sourceBytes).digest('hex'),size:[info.width,info.height],successfulGenerationRetained:true}},
  assets, review:{sourceInspected:true,alphaAndProjectionInspected:true,clientIntegrated:false,independentlyApproved:false},
};
await writeFile(new URL('manifest.json',out),JSON.stringify(manifest,null,2)+'\n');

// Atlas is optional: individual PNGs and anchors remain directly consumable.
const frames={},composite=[]; let x=2;
for (const [id,a] of Object.entries(assets)) {
  composite.push({input:images[id],left:x,top:2});
  frames[id]={frame:{x,y:2,w:a.canvas[0],h:a.canvas[1]},rotated:false,trimmed:false,spriteSourceSize:{x:0,y:0,w:a.canvas[0],h:a.canvas[1]},sourceSize:{w:a.canvas[0],h:a.canvas[1]},anchor:{x:a.anchor[0],y:a.anchor[1]}};
  x+=a.canvas[0]+4;
}
await sharp({create:{width:x,height:136,channels:4,background:'#00000000'}}).composite(composite).png().toFile(new URL('environment-atlas.png',out).pathname);
await writeFile(new URL('environment-atlas.json',out),JSON.stringify({frames,meta:{image:'environment-atlas.png',format:'RGBA8888',size:{w:x,h:136},scale:'1'}},null,2)+'\n');

// Contact sheet: magnified sprites with visible ground footprint and pivot guides.
const text=(w,h,body)=>Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><style>text{font-family:sans-serif;fill:#e2e5d5;font-size:15px}</style>${body}</svg>`);
const cards=[]; let labels='';
Object.entries(assets).forEach(([id,a],i)=>{
  const col=i%3,row=Math.floor(i/3),left=col*360+20,topY=row*300+70;
  cards.push({input:sharp(images[id]).resize(a.canvas[0]*2,a.canvas[1]*2).png().toBuffer(),left,top:topY});
  labels+=`<text x="${left}" y="${topY-40}">${id} · ${a.footprint.join(' × ')} m</text><text x="${left}" y="${topY-18}">h=${a.heightMeters}m · pivot ${a.pivot.join(',')} · scale 1</text>`;
});
const resolved=await Promise.all(cards.map(async c=>({...c,input:await c.input})));
await sharp({create:{width:1100,height:640,channels:4,background:'#203537'}}).composite([...resolved,{input:text(1100,640,labels),left:0,top:0}]).png().toFile(new URL('contact-sheet.png',review).pathname);

const tiles=new URL('../../client/public/assets/tiles/',root);
const oldWorld=new URL('../../client/public/assets/iso-v030-world/',root);
const tileManifest=JSON.parse(await readFile(new URL('manifest.json',tiles),'utf8')).assets;
const oldManifest=JSON.parse(await readFile(new URL('manifest.json',oldWorld),'utf8')).assets;
async function composition(kind,guides=false) {
  const width=1000,height=800,origin=[500,400],layers=[];
  const at=(x,y)=>{const p=project(x,y);return [p[0]+origin[0],p[1]+origin[1]];};
  async function put(id,x,y,type='new') {
    const spec=type==='new'?assets[id]:type==='tile'?tileManifest[id]:oldManifest[id];
    const buf=type==='new'?images[id]:await readFile(new URL(spec.image,type==='tile'?tiles:oldWorld));
    const p=at(x,y),pivot=spec.pivot;
    layers.push({input:buf,left:Math.round(p[0]-pivot[0]),top:Math.round(p[1]-pivot[1])});
  }
  for(let y=-3;y<=3;y++)for(let x=-3;x<=3;x++)await put(kind==='resource'&&x>=1&&y<=-1?'floor-worn':'floor-stone',x,y,'tile');
  if(kind==='target')await put('target-inlay',2,-1.6);
  await put('threshold-u',0,3.28); await put('threshold-v',3.28,0);
  for(const [id,x,y]of [['bookcase-u',-3,-3],['bookcase-u',-3,-2],['bookcase-u',-3,-1],['bookcase-v',-2,-3],['bookcase-v',-1,-3]])await put(id,x,y,'tile');
  if(kind==='base')await put('plinth',2,-1.6,'tile');
  if(kind==='target')await put('lectern',2,-1.6,'tile');
  if(kind==='resource') {await put('resource-cache',2,-1.7,'world'); await put('resource-cache',2.5,-2.7,'world');}
  // Keep 3-wide route completely open: accents occupy only the 2m end segments.
  for(const p of [-2.5,2.5]) {await put('low-wall-u',p,3.39);await put('low-wall-v',3.39,p);}
  let overlay=`<text x="30" y="32">${kind.toUpperCase()} · 7×7 independent-piece composition · PROTOTYPE</text><text x="30" y="56">128×64 tile / scale 1 / existing shelves &amp; props / not runtime placement</text>`;
  if(guides){
    for(let y=-1.5;y<=1.5;y++)for(let x=-1;x<=1;x++){const p=at(x,y);overlay+=`<circle cx="${p[0]}" cy="${p[1]}" r="10" fill="none" stroke="#668f89" stroke-width="2"/>`;}
    const poly=[[-1.5,1.5],[1.5,1.5],[1.5,3.5],[-1.5,3.5]].map(p=>at(...p).join(',')).join(' ');
    overlay+=`<polygon points="${poly}" fill="#4a9b9122" stroke="#83beb0" stroke-width="1"/><text x="30" y="775">Guide: 12 central stance marks; 3-wide approach remains clear. Actual server reserved slots win.</text>`;
  }
  const result=await sharp({create:{width,height,channels:4,background:'#193236'}}).composite([...layers,{input:text(width,height,overlay),left:0,top:0}]).png().toBuffer();
  await writeFile(new URL(`${kind}${guides?'-registration':''}.png`,review),result);
  return result;
}
const rooms=[];
for(const kind of ['base','resource','target'])rooms.push(await composition(kind));
await composition('target',true);
await sharp({create:{width:1500,height:400,channels:4,background:'#193236'}}).composite(await Promise.all(rooms.map(async(input,i)=>({input:await sharp(input).resize(500,400).png().toBuffer(),left:i*500,top:0})))).png().toFile(new URL('room-comparison.png',review).pathname);
console.log('Built 5 independent registered sprites, atlas, contact sheet and 7x7 room studies.');
