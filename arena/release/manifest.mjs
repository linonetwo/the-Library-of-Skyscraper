import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

export function buildMetadata(source) {
 const read=path=>readFileSync(resolve(source,path),'utf8');
 const json=path=>JSON.parse(read(path));
 const sha256=path=>createHash('sha256').update(readFileSync(resolve(source,path))).digest('hex');
 const approvalPath='arena/art/approval-v0.2.0.json';
 const animationPath='arena/client/public/assets/animation/coverage.json';
 const tilesPath='arena/client/public/assets/tiles/manifest.json';
 const animation=json(animationPath),tiles=json(tilesPath);
 const modules=Object.fromEntries(['client','script-sdk','script-toolchain','tools'].map(name=>
  [name,json(`arena/${name}/package.json`).version]));
 for(const name of ['server','script-runner']) modules[name]=read(`arena/${name}/Cargo.toml`).match(/^version = "([^"]+)"/m)[1];
 const locks=['client/package-lock.json','script-toolchain/package-lock.json','tools/package-lock.json','server/Cargo.lock','script-runner/Cargo.lock'];
 return {protocol:'arena.v1',modules,
  assets:{approval:{path:approvalPath,sha256:sha256(approvalPath)},animation:{contentVersion:animation.contentVersion,coverage:{path:animationPath,sha256:sha256(animationPath)}},
   tiles:{schemaVersion:tiles.schemaVersion,contentVersion:tiles.contentVersion,manifest:{path:tilesPath,sha256:sha256(tilesPath)}}},
  dependencies:Object.fromEntries(locks.map(path=>[`arena/${path}`,sha256(`arena/${path}`)])),
  toolchain:Object.fromEntries(['npm','rustc','cargo'].map(command=>[command,execFileSync(command,['--version'],{encoding:'utf8'}).trim()]))};
}
