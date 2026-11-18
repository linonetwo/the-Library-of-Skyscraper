import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectPackage } from './package.mjs';

const [version, commit, output] = process.argv.slice(2);
const repository = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const destination = resolve(output);
const source = resolve(destination, 'source');
const evidence = resolve(destination, 'evidence');
mkdirSync(source, { recursive: true });
mkdirSync(evidence, { recursive: true });
const run = (command, args, cwd = source) => execFileSync(command, args, { cwd, stdio: 'inherit' });
const sourceCommit = execFileSync('git', ['rev-parse', `${commit}^{commit}`], { cwd: repository, encoding: 'utf8' }).trim();
const recipeCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repository, encoding: 'utf8' }).trim();
const archive = resolve(destination, 'source.tar');
run('git', ['archive', '--format=tar', `--output=${archive}`, sourceCommit], repository);
run('tar', ['-xf', archive, '-C', source]);
run('rm', [archive]);
for (const module of ['client', 'script-toolchain', 'tools'])
  run('npm', ['ci', '--prefix', `arena/${module}`]);
run('npm', ['--prefix', 'arena/client', 'run', 'build']);
for (const module of ['server', 'script-runner'])
  run('cargo', ['build', '--locked', '--manifest-path', `arena/${module}/Cargo.toml`]);
await collectPackage({ source, destination, version, sourceCommit, recipeCommit });
writeFileSync(resolve(evidence, 'BUILD.md'), `Local candidate rebuilt from ${sourceCommit}.\nPackaging recipe ${recipeCommit}.\nVersion ${version}; cargo debug --locked; npm ci and client production build completed.\nTags and hosted releases follow the version delivery plan.\n`);
