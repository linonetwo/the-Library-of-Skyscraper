import { cpSync, existsSync, lstatSync, readdirSync, readFileSync, readlinkSync, realpathSync, symlinkSync, unlinkSync } from 'node:fs';
import { basename, dirname, isAbsolute, relative, resolve } from 'node:path';

/** Copy an npm installation, retaining relative links and repairing old copied .bin links. */
export function copyDependencies(source, destination) {
 cpSync(realpathSync(source),destination,{recursive:true,verbatimSymlinks:true});
 const visit=directory=>{
  const entries=readdirSync(directory,{withFileTypes:true});
  if(basename(directory)==='node_modules') repairBins(directory,entries);
  for(const entry of entries) if(entry.isDirectory()) visit(resolve(directory,entry.name));
 };
 visit(destination);
}
function repairBins(installation,entries) {
 const binDirectory=resolve(installation,'.bin');
 if(!existsSync(binDirectory)) return;
 const packages=entries.filter(entry=>entry.isDirectory()&&!entry.name.startsWith('.')).flatMap(entry=>{
  const path=resolve(installation,entry.name);
  return entry.name.startsWith('@') ? readdirSync(path).map(name=>resolve(path,name)) : [path];
 });
 const bins=new Map();
 for(const directory of packages) {
  const manifest=resolve(directory,'package.json');
  if(!existsSync(manifest)) continue;
  const {name,bin}=JSON.parse(readFileSync(manifest,'utf8'));
  for(const [command,path] of Object.entries(typeof bin==='string' ? {[name.split('/').at(-1)]:bin} : bin??{})) {
   const targets=bins.get(command)??[];
   targets.push(resolve(directory,path)); bins.set(command,targets);
  }
 }
 for(const command of readdirSync(binDirectory)) {
  const link=resolve(binDirectory,command);
  if(!lstatSync(link).isSymbolicLink()) continue;
  const original=readlinkSync(link);
  if(!isAbsolute(original)) continue;
  const targets=(bins.get(command)??[]).filter(target=>existsSync(target));
  const target=targets.length===1 ? targets[0] : targets.find(target=>original.endsWith('/'+relative(installation,target)));
  if(!target) throw new Error(`No installed package bin declaration for ${link}`);
  unlinkSync(link); symlinkSync(relative(dirname(link),target),link);
 }
}
