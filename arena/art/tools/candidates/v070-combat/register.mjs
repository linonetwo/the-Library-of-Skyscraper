import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
const here=path.dirname(fileURLToPath(import.meta.url)),repo=path.resolve(here,'../../../../..');
const recover=process.argv[2],sourceCommit=process.argv[3];
if(!recover||!sourceCommit)throw Error('Usage: register.mjs ACCEPTED_RECOVER_DIRECTORY SOURCE_COMMIT');
const publicRoot=path.join(repo,'arena/client/public/assets'),root=path.join(publicRoot,'iso-v070-combat-study');
const sources={cast:path.join(here,'candidates/eight/cast'),recover:path.resolve(recover),'ink-fx':path.join(here,'candidates/ink-fx')};
const sets={};
for(const [name,source]of Object.entries(sources)){
 const target=path.join(root,name);
 execFileSync(process.execPath,[path.join(here,'../../copy-runtime-clip.mjs'),source,target],{stdio:'inherit'});
 sets[name]={descriptor:`${name}/atlas-budget.json`,files:JSON.parse(await readFile(path.join(target,'source-hashes.json'),'utf8'))};
}
const clip=action=>({action,root:`/assets/iso-v070-combat-study/${action}`,descriptor:'atlas-budget.json'});
await mkdir(root,{recursive:true});
await writeFile(path.join(root,'index.json'),JSON.stringify({assetSetId:'iso-v070-combat-study',clips:['cast','recover'].map(clip),effects:{inkFx:{root:'/assets/iso-v070-combat-study/ink-fx',descriptor:'atlas-budget.json'}}},null,2)+'\n');
const mainFile=path.join(publicRoot,'iso-v030-base/index.json'),main=JSON.parse(await readFile(mainFile,'utf8'));
main.assetSetId='iso-v070-player-mobility-combat';
main.clips=[...main.clips.filter(entry=>!['cast','recover'].includes(entry.action)),...['cast','recover'].map(clip)];
await writeFile(mainFile,JSON.stringify(main,null,2)+'\n');
await writeFile(path.join(root,'manifest.json'),JSON.stringify({sourceCommit,scope:'Layered cast32, recover64 and four independent ink phases. Offline acceptance does not establish live world-contact or gameplay-timing validation.',sets},null,2)+'\n');
