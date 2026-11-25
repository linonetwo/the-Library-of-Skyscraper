import { copyDependencies } from './dependencies.mjs';
import { buildMetadata } from './manifest.mjs';
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { platform, release, arch } from 'node:os';

export async function collectPackage({ source, destination, version, sourceCommit, recipeCommit, runtimeReuse }) {
 const payload=resolve(destination,'package');
 for(const dir of ['bin','data','logs','arena/client','arena/art']) mkdirSync(resolve(payload,dir),{recursive:true});
 const copy=(from,to)=>cpSync(from,to,{recursive:true,verbatimSymlinks:true});
 const metadata=buildMetadata(source,version);
 copy(resolve(source,(metadata.assets.provenance??metadata.assets.approval).path),resolve(payload,(metadata.assets.provenance??metadata.assets.approval).path));
 if(metadata.rules) {
  const path=metadata.rules.provenance.path;
  mkdirSync(dirname(resolve(payload,path)),{recursive:true});
  copy(resolve(source,path),resolve(payload,path));
 }
 for(const name of ['server','script-runner']) {
  const binary=`skyscraper-arena-${name}`;
  const target=process.env.CARGO_TARGET_DIR ? resolve(source,process.env.CARGO_TARGET_DIR) : resolve(source,`arena/${name}/target`);
  copy(resolve(target,'debug',binary),resolve(payload,'bin',binary));
 }
 copyDependencies(resolve(source,'arena/client/node_modules'),resolve(payload,'arena/client/node_modules'));
 for(const name of ['dist','package.json','package-lock.json','vite.config.ts'])
  copy(resolve(source,'arena/client',name),resolve(payload,'arena/client',name));
 for(const module of ['script-sdk','script-toolchain','tools']) {
  const from=resolve(source,'arena',module), to=resolve(payload,'arena',module);
  cpSync(from,to,{recursive:true,verbatimSymlinks:true,filter:path=>path!==resolve(from,'node_modules')});
  if(existsSync(resolve(from,'node_modules'))) copyDependencies(resolve(from,'node_modules'),resolve(to,'node_modules'));
 }
 copy(fileURLToPath(new URL('./start.sh',import.meta.url)),resolve(payload,'start.sh'));
 chmodSync(resolve(payload,'start.sh'),0o755);
 copy(fileURLToPath(new URL(`./notes-v${version}.md`,import.meta.url)),resolve(payload,`notes-v${version}.md`));
 const readme=readFileSync(new URL('./runtime-README.md',import.meta.url),'utf8')
  .replaceAll('{{version}}',version).replaceAll('{{sourceCommit}}',sourceCommit);
 writeFileSync(resolve(payload,'README.md'),readme);
 writeFileSync(resolve(payload,'manifest.json'),JSON.stringify({version,status:'local-candidate',sourceCommit,recipeCommit,...metadata,
  platform:`${platform()} ${release()} ${arch()}`,node:process.version,binaries:runtimeReuse ? 'reused cargo debug --locked' : 'cargo debug --locked',
  ...(runtimeReuse ? {runtimeReuse} : {}),ports:[5173,8787],
  data:'empty package-local directory',steamDesktopArtifact:false},null,2)+'\n');
 execFileSync('bash',['-c',"find . -type f ! -name FILES.sha256 -print0 | sort -z | xargs -0 sha256sum > FILES.sha256"],{cwd:payload});
 const archive=`arena-v${version}-${platform()}-${arch()}-candidate.tar.gz`;
 execFileSync('tar',['-czf',archive,'package'],{cwd:destination});
 const hash=execFileSync('sha256sum',[archive],{cwd:destination});
 writeFileSync(resolve(destination,archive+'.sha256'),hash);
}
