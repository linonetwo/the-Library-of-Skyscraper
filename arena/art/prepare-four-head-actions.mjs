import { readFile,writeFile } from 'node:fs/promises';
import { art,output,json,digest,packLayer } from './idle-pipeline.mjs';
import { directions,layers,modules } from './animation-spec.mjs';
import { idleFrames,dollLayers,layerOrder } from './four-head-idle.mjs';
import { walkFrames } from './four-head-walk.mjs';
import { approvalRecord, contentVersion, approvedActions, approvedMetadata } from './art-approval.mjs';

const coverage=JSON.parse(await readFile(new URL('coverage.json',output),'utf8'));
coverage.auxiliaryLayers=[];coverage.fourHeadSources=[];
for(const result of [await idleFrames(),await walkFrames()]) {
  const {action,cells,recipes,frames,attachments,provenance}=result,packed={};
  for(const layer of dollLayers) {
    const recipe={schemaVersion:1,action,layer,source:provenance[layer].source,
      sourceSha256:provenance[layer].sourceSha256,bodyRegistration:`arena/art/source/four-head-${action}-registration.json`,
      frames:recipes[layer]};
    const bytes=Buffer.from(json(recipe)),path=`source/four-head-${action}-${layer}-registration.json`;
    await writeFile(new URL(path,art),bytes);
    packed[layer]=await packLayer(layer,cells[layer],{...provenance[layer],proportion:'four-head',
      designSource:layer.startsWith('outfit')?'arena/art/source/four-head-outfits.png':undefined,
      registration:`arena/art/${path}`,recipeSha256:digest(bytes),
      ...approvedMetadata,
      review:'Approved four-head idle/walk visual scope; reviewed pixels and evidence are pinned in the approval record.'},action);
  }
  const registration={schemaVersion:1,action,cell:[192,192],anchor:[.5,.9],groundPivot:[96,172.8],
    proportion:'four-head',directionOrder:directions,frameCount:modules[action].frames,
    frameDurationsMs:Array(modules[action].frames).fill(1000/modules[action].fps),loop:true,frames};
  await writeFile(new URL(`${action}-registration.json`,output),json(registration));
  await writeFile(new URL(`source/four-head-${action}-registration.json`,art),json(registration));
  await writeFile(new URL(`${action}-weapon-staff.attachments.json`,output),json({
    schemaVersion:1,action,cell:[192,192],layerOrder,attachments}));
  for(const entry of coverage.coverage)if(entry.action===action) {
    Object.assign(entry,approvedMetadata);entry.atlas=`${action}-${entry.layer}.json`;
    entry.frames=packed[entry.layer].atlas.animations[`${action}/${entry.layer}/${entry.direction}`];
  }
  for(const layer of dollLayers.filter(layer=>!layers.includes(layer)))
    coverage.auxiliaryLayers.push({action,layer,atlas:`${action}-${layer}.json`,...approvedMetadata,purpose:'Four-head paper-doll occlusion; matching action registration.'});
  coverage.fourHeadSources.push({action,layers:provenance});
}
coverage.contentVersion=contentVersion;coverage.generatedOn='2026-11-18';
coverage.approvalRecord=approvalRecord;
coverage.releaseScope={version:'0.2.0',actions:approvedActions,appearanceCombinations:8,compositeFrames:512};
coverage.releaseReady=true;
coverage.runtimePolicy='approved idle/walk release scope; deferred actions remain missing';
coverage.allPlannedActionsReady=false;
coverage.source={path:'arena/art/source/four-head-walk-body.png',sha256:digest(await readFile(new URL('source/four-head-walk-body.png',art))),
  generator:'GPT Image 2 via proxy-imagegen'};
coverage.review={proportion:'Reviewed neutral four-head skeleton: crown12/chin52/sole172, common anchor172.8; both actions migrated together.',
  gait:'Independent Astra review passed all 16 action/appearance contact sheets and real-FPS playback, including W/E phase02/03, NE/SE limb corrections, shoulder/neck joins and anatomical grip.',
  paperDoll:'14 physical layers per action, 2 outfits × 2 hair designs × empty/staff; both actions include foreground hands and hair/staff depth splits.',
  grip:'Per-frame right-hand staff and weapon-only grip registration approved across idle/walk and all eight appearance combinations.',
  cleanup:'Source near-white matte/chroma cleanup and alpha resampling approved for the pinned v0.2.0 pixels.',
  deferred:'Run, jump, climb and staff attack remain missing; approval does not cover later action batches.'};
for(const key of ['idleSources','walkNormalization','equipmentSources','gripSource'])delete coverage[key];
coverage.defaultLayerOrder=layerOrder;
await writeFile(new URL('coverage.json',output),json(coverage));
console.log('Packed approved v0.2.0 four-head idle/walk: 28 atlases, 32 cells each; later actions remain missing.');
