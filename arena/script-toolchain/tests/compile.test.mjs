import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import test from 'node:test';
import { compileRule } from '../src/compile.mjs';

const main = `import type { RuleContext, RuleDecisionResult } from '@skyscraper/arena-script-sdk';
export function decide(ctx: RuleContext): RuleDecisionResult {
  return { intents: [] };
}`;

test('strict TypeScript diagnostics preserve source positions', async () => {
  const result = await compileRule({ files: { 'main.ts': `${main}\nconst count: number = "four";` } });
  assert.equal(result.bundle, undefined);
  assert.deepEqual(result.diagnostics.map(({ file, line, column, code }) => ({ file, line, column, code })),
    [{ file: 'main.ts', line: 5, column: 7, code: 2322 }]);
});

test('multi-file bundle exposes decide and contains source map', async () => {
  const result = await compileRule({ files: {
    'main.ts': `import { intents } from './strategy'; export function decide() { return { intents }; }`,
    'strategy.ts': `import type { ActionIntentDraft } from '@skyscraper/arena-script-sdk';
export const intents: ActionIntentDraft[] = [];`,
  } });
  assert.deepEqual(result.diagnostics, []);
  assert.match(result.bundle.code, /var __arenaRule/);
  assert.match(result.bundle.code, /decide:/);
  const map = JSON.parse(result.bundle.sourceMap);
  assert.ok(map.sources.some(source => source.endsWith('/strategy.ts')));
  assert.ok(map.sourcesContent.some(source => source.includes('ActionIntentDraft')));
});

test('official gather example and shared strategy compile unchanged', async () => {
  const files = Object.fromEntries(await Promise.all(
    ['examples/gather.ts', 'examples/shared.ts', 'src/index.ts', 'src/contract.ts', 'src/views.ts']
      .map(async name => [name, await readFile(new URL(`../../script-sdk/${name}`, import.meta.url), 'utf8')]),
  ));
  const result = await compileRule({ files, entry: 'examples/gather.ts' });
  assert.deepEqual(result.diagnostics, []);
  assert.ok(result.bundle.code.includes('decideSquad'));
});

test('hash uses canonical names, ordering, entry and source contents', async () => {
  const a = await compileRule({ files: { 'main.ts': main, 'other.ts': 'export const value = 1;' } });
  const b = await compileRule({ files: { 'other.ts': 'export const value = 1;', './main.ts': main } });
  const c = await compileRule({ files: { 'main.ts': main, 'other.ts': 'export const value = 2;' } });
  assert.equal(a.bundle.sourceHash, b.bundle.sourceHash);
  assert.equal(a.bundle.code, b.bundle.code);
  assert.notEqual(a.bundle.sourceHash, c.bundle.sourceHash);
});

test('ambient environment is ES2022 and the official SDK', async () => {
  const result = await compileRule({ files: { 'main.ts': `${main}
document.title = 'x';
process.exit();
fetch('https://example.com');
` } });
  assert.equal(result.diagnostics.length, 3);
  assert.ok(result.diagnostics.every(item => item.severity === 'error'));
});

test('module contract requires synchronous decide returning intents', async () => {
  const result = await compileRule({ files: { 'main.ts': 'export function decide() { return 5; }' } });
  assert.equal(result.bundle, undefined);
  assert.match(result.diagnostics[0].message, /RuleDecisionResult/);
});

test('CLI accepts multiple JSON lines and emits one response for each', async () => {
  const cli = spawn(process.execPath, [new URL('../cli.mjs', import.meta.url).pathname]);
  let output = '';
  cli.stdout.on('data', data => { output += data; });
  cli.stdin.end(`${JSON.stringify({ files: { 'main.ts': main } })}\n${JSON.stringify({ files: { 'main.ts': 'export const decide = 4;' } })}\n`);
  await new Promise((resolve, reject) => {
    cli.on('error', reject);
    cli.on('close', code => code === 0 ? resolve() : reject(new Error(`exit ${code}`)));
  });
  const responses = output.trim().split('\n').map(line => JSON.parse(line));
  assert.equal(responses.length, 2);
  assert.ok(responses[0].bundle);
  assert.equal(responses[1].diagnostics[0].severity, 'error');
});
