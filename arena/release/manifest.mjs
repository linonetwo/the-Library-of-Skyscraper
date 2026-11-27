import { releaseProfile } from './release-profiles.mjs';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

export function buildMetadata(source, version) {
 const profile=releaseProfile(version);
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
    ...(mobility ? {version:'0.3.0',scope:'inherited-baseline',note:`Inherited art provenance; not v${version} approval.`} : {})},
   ...(profile.tactics ? (()=>{
    const path='iso-v070-combat-study/index.json';
    const index=json(`arena/client/dist/assets/${path}`);
    return {effects:{index:entry(path),entries:Object.fromEntries(Object.entries(index.effects).map(([name,effect])=>{
     const path=`${effect.root.replace(/^\/assets\//,'')}/${effect.descriptor}`;
     return [name,{descriptor:entry(path)}];
    }))}};
   })() : {}),
   groups:Object.fromEntries(Object.entries(provenance.groups).map(([name,group])=>[name,{
    entries:group.entries.map(entry),
    ...(group.index ? (()=>{
     const index=json(`arena/client/dist/assets/${group.index}`);
     return {assetSetId:index.assetSetId,clips:index.clips.map(clip=>{
      const path=`${clip.root.replace(/^\/assets\//,'')}/${clip.descriptor}`;
      const descriptor=entry(path);
      const details=mobility && name==='player' && ['run','jump','climb',...(profile.tactics ? ['cast','recover'] : [])].includes(clip.action)
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
  assets: profile.assets==='legacy' ? legacyAssets() : currentAssets(profile.assets==='mobility'),
  ...(profile.rules==='graph' ? {rules:{schemaVersions:[1,2],provenance:{path:'arena/release/rule-provenance-v0.4.0.json',sha256:sha256('arena/release/rule-provenance-v0.4.0.json')}}} : {}),
  ...(profile.rules==='mobility' ? {
   rules:{schemaVersions:[1,2],provenance:{path:'arena/release/rule-provenance-v0.4.0.json',
    sha256:sha256('arena/release/rule-provenance-v0.4.0.json'),version:'0.4.0',scope:'inherited-baseline',
    note:`Inherited rules provenance; not v${version} approval.`},
    sdk:{version:modules['script-sdk'],mobility:{path:'arena/script-sdk/src/mobility.ts',sha256:sha256('arena/script-sdk/src/mobility.ts')}},
    ...(profile.composition ? {composition:{schemaVersion:2,moduleKinds:['gather','haul','build','defend','retreat','scout','patrol','escort',...(profile.tactics ? ['attack','repair','claim','cast'] : [])],
     references:['room','ownRole',...(profile.tactics ? ['enemy','enemyInRoom','ownBuilding','ownBuildingInRoom','controlPoint'] : [])],moduleVisits:{traceVersion:2,perActorLimit:8,missing:'unrecorded',truncatedField:'moduleVisitsTruncated'}}} : {})},
   ...(profile.tactics ? {skills:{inkStrike:{path:'arena/script-sdk/skills/ink-strike.js',sha256:sha256('arena/script-sdk/skills/ink-strike.js')}},customModules:{graphSchemaVersion:2,immutableRevisions:true,namedExits:true,fixedFallback:true,execution:'same-rule-project-v8'}} : {}),
   world:{simulationVersion:profile.tactics ? 8 : 7,version:json('arena/shared/world-map-v5.json').version,
    map:{path:'arena/shared/world-map-v5.json',sha256:sha256('arena/shared/world-map-v5.json')},
    ...(profile.tactics ? {scenarios:Object.fromEntries(['first-expedition','seal-contest-v1'].map(name=>{
     const path=`arena/shared/${name}.json`;return [name,{path,sha256:sha256(path)}];
    }))} : {})},
  } : {}),
  dependencies:Object.fromEntries(locks.map(path=>[`arena/${path}`,sha256(`arena/${path}`)])),
  toolchain:Object.fromEntries(['npm','rustc','cargo'].map(command=>[command,execFileSync(command,['--version'],{encoding:'utf8'}).trim()]))};
}
