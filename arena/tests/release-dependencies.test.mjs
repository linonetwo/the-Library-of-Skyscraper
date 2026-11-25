import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, readlinkSync, realpathSync, rmSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, isAbsolute } from 'node:path';
import { execFileSync } from 'node:child_process';
import { copyDependencies } from '../release/dependencies.mjs';

test('copied npm bins survive tar extraction and relocation without the old source',()=>{
 const root=mkdtempSync(resolve(tmpdir(),'arena-npm-relocation-'));
 try {
  const cache=resolve(root,'cache/node_modules');
  const put=(path,text)=>{mkdirSync(resolve(path,'..'),{recursive:true});writeFileSync(path,text);};
  for(const [installation,name,bin,link] of [
   [cache,'relative-tool','cli.js','../relative-tool/cli.js'],
   [cache,'old-tool','bin/tool.js','/removed/build/source/arena/client/node_modules/old-tool/bin/tool.js'],
   [resolve(cache,'old-tool/node_modules'),'@scope/nested','cli.js','/removed/other/source/node_modules/@scope/nested/cli.js'],
  ]) {
   put(resolve(installation,name,'package.json'),JSON.stringify({name,bin:{[name.split('/').at(-1)]:bin}}));
   const target=resolve(installation,name,bin);
   put(target,`#!/usr/bin/env node\nconsole.log(${JSON.stringify(name)});\n`);chmodSync(target,0o755);
   mkdirSync(resolve(installation,'.bin'),{recursive:true});symlinkSync(link,resolve(installation,'.bin',name.split('/').at(-1)));
  }
  const source=resolve(root,'source/node_modules');mkdirSync(resolve(root,'source'));symlinkSync(cache,source);
  const payload=resolve(root,'staging/package/node_modules');copyDependencies(source,payload);
  assert.equal(readlinkSync(resolve(cache,'.bin/old-tool')),'/removed/build/source/arena/client/node_modules/old-tool/bin/tool.js');
  execFileSync('tar',['-czf',resolve(root,'package.tar.gz'),'package'],{cwd:resolve(root,'staging')});
  rmSync(resolve(root,'source'),{recursive:true});rmSync(resolve(root,'cache'),{recursive:true});rmSync(resolve(root,'staging'),{recursive:true});
  const moved=resolve(root,'another/location');mkdirSync(moved,{recursive:true});
  execFileSync('tar',['-xzf',resolve(root,'package.tar.gz')],{cwd:moved});
  const installation=resolve(moved,'package/node_modules');
  for(const [command,expected] of [['.bin/relative-tool','relative-tool'],['.bin/old-tool','old-tool'],['old-tool/node_modules/.bin/nested','@scope/nested']]) {
   const executable=resolve(installation,command);
   assert.equal(isAbsolute(readlinkSync(executable)),false);
   assert(realpathSync(executable).startsWith(installation+'/'));
   assert.equal(execFileSync(executable,{encoding:'utf8'}).trim(),expected);
  }
  assert.equal(readlinkSync(resolve(installation,'.bin/relative-tool')),'../relative-tool/cli.js');
 } finally {rmSync(root,{recursive:true,force:true});}
});
