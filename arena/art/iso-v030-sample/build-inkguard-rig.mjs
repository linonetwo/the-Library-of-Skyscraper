import sharp from 'sharp';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
const output=new URL('inkguard-attachments/',import.meta.url);
await mkdir(output,{recursive:true});
const world=new URL('../../client/public/assets/iso-v030-world/',import.meta.url);
const manifest=JSON.parse(await readFile(new URL('manifest.json',world),'utf8'));
const config={schemaVersion:1,status:'prototype',releaseApproved:false,actionsApproved:[],
  cell:[128,160],groundPivot:[64,144],renderScale:1,entityHeightMeters:1.35,
  source:'arena/art/source/iso-v030-inkguard-neutral.png',
  sourceSha256:manifest.sources['iso-v030-inkguard-neutral.png'].sha256,
  rigScope:'head, torso, cloak, arms, boots; complete hidden leg segments and action poses remain to be authored',
  directions:{}};
const inside=(x,y,poly)=>{
  let hit=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){
    const [xi,yi]=poly[i],[xj,yj]=poly[j];
    if((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)hit=!hit;
  }return hit;
};
const definitions={
  NE:{
    neck:[400,270],pelvis:[388,660],
    leftShoulder:[264,350],leftElbow:[215,447],leftWrist:[174,584],
    rightShoulder:[506,357],rightElbow:[548,457],rightWrist:[600,590],
    leftAnkle:[285,921],rightAnkle:[470,942],
    leftPoly:[[216,353],[287,385],[264,459],[225,487],[213,553],[217,614],[190,649],[139,645],[133,577],[158,527],[178,440]],
    rightPoly:[[474,369],[539,355],[575,438],[586,491],[627,564],[639,636],[609,662],[568,640],[565,586],[522,552],[502,488],[479,434]],
  },
  SW:{
    neck:[344,293],pelvis:[338,660],
    leftShoulder:[493,365],leftElbow:[542,454],leftWrist:[570,585],
    rightShoulder:[195,365],rightElbow:[156,454],rightWrist:[127,584],
    leftAnkle:[456,940],rightAnkle:[245,934],
    leftPoly:[[466,375],[524,360],[559,410],[567,464],[587,535],[610,578],[610,633],[580,666],[550,642],[531,592],[513,530],[482,475]],
    rightPoly:[[159,359],[231,392],[213,462],[185,501],[164,548],[158,596],[144,632],[111,649],[93,621],[96,580],[118,527],[130,444]],
  },
};
const preview=[];
for(const [index,direction]of ['NE','SW'].entries()){
  const d=definitions[direction],entry=manifest.assets[`inkguard-${direction}`],scale=entry.sourceScale;
  const [ox,oy]=entry.placement;
  const cellPoint=([x,y])=>[ox+x*scale,oy+y*scale];
  const joints={root:{parent:null,restOffset:[0,0],cell:[64,144]}};
  const parents={pelvis:'root',neck:'pelvis',leftShoulder:'neck',rightShoulder:'neck',leftElbow:'leftShoulder',rightElbow:'rightShoulder',
    leftWrist:'leftElbow',rightWrist:'rightElbow',leftAnkle:'pelvis',rightAnkle:'pelvis'};
  for(const id of Object.keys(parents)){
    const p=cellPoint(d[id]);joints[id]={parent:parents[id],cell:p};
  }
  for(const [id,j]of Object.entries(joints))if(id!=='root'){
    const p=joints[j.parent].cell;j.restOffset=[j.cell[0]-p[0],j.cell[1]-p[1]];
  }
  const parts=[
    {id:'head',joint:'neck',layer:'body',zOrder:6},
    {id:'torso',joint:'pelvis',layer:'body',zOrder:3},
    {id:'lower-cloak',joint:'pelvis',layer:'body',zOrder:4},
    {id:'left-upper-arm',joint:'leftShoulder',layer:direction==='SW'?'body-front':'body',zOrder:2},
    {id:'left-forearm-hand',joint:'leftElbow',layer:direction==='SW'?'body-front':'body',zOrder:5},
    {id:'right-upper-arm',joint:'rightShoulder',layer:direction==='NE'?'body-front':'body',zOrder:2},
    {id:'right-forearm-hand',joint:'rightElbow',layer:direction==='NE'?'body-front':'body',zOrder:5},
    {id:'left-boot',joint:'leftAnkle',layer:'body',zOrder:0},
    {id:'right-boot',joint:'rightAnkle',layer:'body',zOrder:1},
  ];
  const {data,info}=await sharp(await readFile(new URL(`inkguard-${direction}.png`,world))).raw().toBuffer({resolveWithObject:true});
  const masks=parts.map(()=>Buffer.alloc(data.length));
  for(let y=0;y<160;y++)for(let x=0;x<128;x++){
    const at=(y*128+x)*4;if(!data[at+3])continue;
    const sx=(x+.5-ox)/scale,sy=(y+.5-oy)/scale;
    let owner;
    if(sy<265)owner=0;
    else if(inside(sx,sy,d.leftPoly))owner=sy<d.leftElbow[1]?3:4;
    else if(inside(sx,sy,d.rightPoly))owner=sy<d.rightElbow[1]?5:6;
    else if(sy>845)owner=(direction==='NE'?sx<385:sx>350)?7:8;
    else if(sy>580)owner=2;
    else owner=1;
    data.copy(masks[owner],at,at,at+4);
  }
  await mkdir(new URL(`${direction}/`,output),{recursive:true});
  const attachments=[];
  for(const [i,p]of parts.entries()){
    const image=await sharp(masks[i],{raw:info}).png().toBuffer();
    const path=`${direction}/${p.id}.png`;await writeFile(new URL(path,output),image);
    attachments.push({...p,image:path,pivot:joints[p.joint].cell,restTopLeft:[0,0],size:[128,160]});
  }
  config.directions[direction]={joints,attachments,
    projectedWorldForward:direction==='NE'?[64,-32]:[-64,32],
    pending:['Complete independent leg segments hidden by neutral cloak','Four-frame move/attack and two-frame hit','Four-frame collapse and settled-down pose']};
  const sorted=[...attachments].sort((a,b)=>(a.layer==='body-front'?100:0)+a.zOrder-(b.layer==='body-front'?100:0)-b.zOrder);
  const input=await sharp({create:{width:128,height:160,channels:4,background:'#00000000'}})
    .composite(await Promise.all(sorted.map(async a=>({input:await readFile(new URL(a.image,output)),left:0,top:0})))).png().toBuffer();
  preview.push({input,left:index*128,top:0});
}
await writeFile(new URL('rig.json',output),JSON.stringify(config,null,2)+'\n');
await sharp({create:{width:256,height:160,channels:4,background:'#d5dfd9'}}).composite(preview).png()
  .toFile(new URL('inkguard-rig-rest-preview.png',import.meta.url).pathname);
console.log('Built partial inkguard rig from independently registered NE/SW source.');
