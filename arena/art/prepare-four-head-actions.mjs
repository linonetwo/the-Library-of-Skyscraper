import { readFile,writeFile } from 'node:fs/promises';
import { art,output,json,digest,packLayer } from './idle-pipeline.mjs';
import { directions,layers,modules } from './animation-spec.mjs';
import { idleFrames,dollLayers,layerOrder } from './four-head-idle.mjs';
import { walkFrames } from './four-head-walk.mjs';

const coverage=JSON.parse(await readFile(new URL('coverage.json',output),'utf8'));
coverage.auxiliaryLayers=[];coverage.fourHeadSources=[];
for(const result of [await idleFrames(),await walkFrames()]) {
  const {action,cells,recipes,frames,attachments,provenance}=result,packed={};
  for(const layer of dollLayers) {
    const recipe={schemaVersion:1,action,layer,source:provenance[layer].source,
      sourceSha256:provenance[layer].sourceSha256,frames:recipes[layer]};
    const bytes=Buffer.from(json(recipe)),path=`source/four-head-${action}-${layer}-registration.json`;
    await writeFile(new URL(path,art),bytes);
    packed[layer]=await packLayer(layer,cells[layer],{...provenance[layer],proportion:'four-head',
      designSource:layer.startsWith('outfit')?'arena/art/source/four-head-outfits.png':undefined,
      registration:`arena/art/${path}`,recipeSha256:digest(bytes),
      review:'Four-head neutral fit passed independent production review; full action/runtime approval remains pending.'},action);
  }
  const registration={schemaVersion:1,action,cell:[192,192],anchor:[.5,.9],groundPivot:[96,172.8],
    proportion:'four-head',directionOrder:directions,frameCount:modules[action].frames,
    frameDurationsMs:Array(modules[action].frames).fill(1000/modules[action].fps),loop:true,frames};
  await writeFile(new URL(`${action}-registration.json`,output),json(registration));
  await writeFile(new URL(`source/four-head-${action}-registration.json`,art),json(registration));
  await writeFile(new URL(`${action}-weapon-staff.attachments.json`,output),json({
    schemaVersion:1,action,cell:[192,192],layerOrder,attachments}));
  for(const entry of coverage.coverage)if(entry.action===action) {
    entry.status='prototype';entry.releaseApproved=false;entry.atlas=`${action}-${entry.layer}.json`;
    entry.frames=packed[entry.layer].atlas.animations[`${action}/${entry.layer}/${entry.direction}`];
  }
  for(const layer of dollLayers.filter(layer=>!layers.includes(layer)))
    coverage.auxiliaryLayers.push({action,layer,atlas:`${action}-${layer}.json`,purpose:'Four-head paper-doll occlusion; matching action registration.'});
  coverage.fourHeadSources.push({action,layers:provenance});
}
coverage.contentVersion='arena-animation-2026-11-17.four-head.1';coverage.generatedOn='2026-11-17';
coverage.source={path:'arena/art/source/four-head-walk-body.png',sha256:digest(await readFile(new URL('source/four-head-walk-body.png',art))),
  generator:'GPT Image 2 via proxy-imagegen'};
coverage.review={proportion:'Reviewed neutral four-head skeleton: crown12/chin52/sole172, common anchor172.8; both actions migrated together.',
  gait:'Dedicated newly generated 32 walk body poses; idle uses independent standing source and upper-body breath. Full runtime gait review pending.',
  paperDoll:'14 physical layers per action, 2 outfits × 2 hair designs × empty/staff; both actions include foreground hands and hair/staff depth splits.',
  grip:'Per-frame right-hand staff and weapon-only grip registration; all contacts require independent runtime approval.',
  cleanup:'Source near-white matte/chroma cleanup and alpha resampling; fine edges and limb joins remain prototype review.'};
for(const key of ['idleSources','walkNormalization','equipmentSources','gripSource'])delete coverage[key];
coverage.defaultLayerOrder=layerOrder;
await writeFile(new URL('coverage.json',output),json(coverage));
console.log('Packed four-head idle/walk: 28 atlases, 32 cells each; all coverage remains prototype.');
