import { writeFile } from 'node:fs/promises';
import { dollLayers } from './four-head-idle.mjs';
import { json } from './idle-pipeline.mjs';
import { approvedActions, approvedMetadata } from './art-approval.mjs';

await writeFile(new URL('../client/public/assets/manifest.json',import.meta.url),json({
  schemaVersion:2,
  ...approvedMetadata,
  scope:'v0.2.0 four-head paper doll and independent 2:1 isometric tiles',
  animation:{
    coverage:'animation/coverage.json',
    actions:approvedActions,
    atlases:approvedActions.flatMap(action=>dollLayers.map(layer=>`animation/${action}-${layer}.json`)),
    cell:[192,192],anchor:[0.5,0.9],padding:2,
    appearanceCombinations:8,compositeFrames:512,
  },
  tiles:{manifest:'tiles/manifest.json',atlases:['tiles/floors.json','tiles/props.json'],tileSize:[128,64]},
  deferredActions:['run','jump','climb','weapon-staff'],
}));
