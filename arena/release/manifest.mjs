import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

export function buildMetadata(source, version) {
 const read=path=>readFileSync(resolve(source,path),'utf8');
 const json=path=>JSON.parse(read(path));
 const sha256=path=>createHash('sha256').update(readFileSync(resolve(source,path))).digest('hex');
 const legacyAssets=()=>{
 const approvalPath=json('arena/client/public/assets/manifest.json').approvalRecord;
 const animationPath='arena/client/public/assets/animation/coverage.json';
 const tilesPath='arena/client/public/assets/tiles/manifest.json';
 const animation=json(animationPath),tiles=json(tilesPath);
  return {approval:{path:approvalPath,sha256:sha256(approvalPath)},animation:{contentVersion:animation.contentVersion,coverage:{path:animationPath,sha256:sha256(animationPath)}},
   tiles:{schemaVersion:tiles.schemaVersion,contentVersion:tiles.contentVersion,manifest:{path:tilesPath,sha256:sha256(tilesPath)}}};
 };
 const currentAssets=(mobility=false)=>{
  const provenancePath='arena/art/asset-provenance-v0.3.0.json';
  const provenance=json(provenancePath);
  const entry=path=>({path:`arena/client/dist/assets/${path}`,sha256:sha256(`arena/client/dist/assets/${path}`)});
  return {
   provenance:{path:provenancePath,sha256:sha256(provenancePath),
    ...(mobility ? {version:'0.3.0',scope:'inherited-baseline',note:'Inherited art provenance; not v0.5.0 approval.'} : {})},
   groups:Object.fromEntries(Object.entries(provenance.groups).map(([name,group])=>[name,{
    entries:group.entries.map(entry),
    ...(group.index ? (()=>{
     const index=json(`arena/client/dist/assets/${group.index}`);
     return {assetSetId:index.assetSetId,clips:index.clips.map(clip=>{
      const path=`${clip.root.replace(/^\/assets\//,'')}/${clip.descriptor}`;
      const descriptor=entry(path);
      const details=mobility && name==='player' && ['run','jump','climb'].includes(clip.action)
       ? json(descriptor.path) : undefined;
      return {action:clip.action,descriptor,
       ...(details?.clip?.phaseFrames!==undefined ? {phaseFrames:details.clip.phaseFrames} : {}),
       ...(details?.directions!==undefined ? {directions:details.directions} : {})};
     })};
    })() : {}),
   }])),
  };
 };
 const modules=Object.fromEntries(['client','script-sdk','script-toolchain','tools'].map(name=>
  [name,json(`arena/${name}/package.json`).version]));
 for(const name of ['server','script-runner']) modules[name]=read(`arena/${name}/Cargo.toml`).match(/^version = "([^"]+)"/m)[1];
 const locks=['client/package-lock.json','script-toolchain/package-lock.json','tools/package-lock.json','server/Cargo.lock','script-runner/Cargo.lock'];
 return {protocol:'arena.v1',modules,
  assets: version==='0.5.0' ? currentAssets(true) : ['0.3.0','0.4.0','0.4.1'].includes(version) ? currentAssets() : legacyAssets(),
  ...(['0.4.0','0.4.1'].includes(version) ? {rules:{schemaVersions:[1,2],provenance:{path:'arena/release/rule-provenance-v0.4.0.json',sha256:sha256('arena/release/rule-provenance-v0.4.0.json')}}} : {}),
  ...(version==='0.5.0' ? {
   rules:{schemaVersions:[1,2],provenance:{path:'arena/release/rule-provenance-v0.4.0.json',
    sha256:sha256('arena/release/rule-provenance-v0.4.0.json'),version:'0.4.0',scope:'inherited-baseline',
    note:'Inherited rules provenance; not v0.5.0 approval.'},
    sdk:{version:modules['script-sdk'],mobility:{path:'arena/script-sdk/src/mobility.ts',sha256:sha256('arena/script-sdk/src/mobility.ts')}}},
   world:{simulationVersion:7,version:json('arena/shared/world-map-v5.json').version,
    map:{path:'arena/shared/world-map-v5.json',sha256:sha256('arena/shared/world-map-v5.json')}},
  } : {}),
  dependencies:Object.fromEntries(locks.map(path=>[`arena/${path}`,sha256(`arena/${path}`)])),
  toolchain:Object.fromEntries(['npm','rustc','cargo'].map(command=>[command,execFileSync(command,['--version'],{encoding:'utf8'}).trim()]))};
}
