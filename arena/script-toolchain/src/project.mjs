import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const sdkRoot = new URL('../../script-sdk/', import.meta.url);
export const sdkVersion = JSON.parse(readFileSync(new URL('package.json', sdkRoot))).version;
export const toolchainVersion = '0.0.1';
export const options = {
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  lib: ['lib.es2022.d.ts'],
  strict: true,
  noEmit: true,
  types: [],
  allowImportingTsExtensions: true,
  verbatimModuleSyntax: true,
};
const sdkSources = readdirSync(new URL('src/', sdkRoot)).filter(name => name.endsWith('.ts'))
  .map(name => [`/sdk/${name}`, readFileSync(new URL(`src/${name}`, sdkRoot), 'utf8')]);
const libDirectory = path.dirname(ts.getDefaultLibFilePath(options));
const libFiles = new Map(readdirSync(libDirectory).filter(name => /^lib\..*\.d\.ts$/.test(name))
  .map(name => [path.join(libDirectory, name), readFileSync(path.join(libDirectory, name), 'utf8')]));

export function createProject(files, entry) {
  const sources = new Map(Object.entries(files).map(([name, text]) => [
    path.posix.resolve('/project', name), text,
  ]));
  const entryPath = path.posix.resolve('/project', entry);
  const userSources = [...sources].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0);
  for (const [name, text] of sdkSources) sources.set(name, text);
  sources.set('/contract.ts', `
import type { ActionRuleModule } from '/sdk/index.ts';
import * as rule from ${JSON.stringify(entryPath)};
const contract: ActionRuleModule = rule;
`);
  function resolve(specifier, importer) {
    if (specifier === '@skyscraper/arena-script-sdk') return '/sdk/index.ts';
    if (!specifier.startsWith('.') && !specifier.startsWith('/')) return;
    const resolved = path.posix.resolve(path.posix.dirname(importer), specifier);
    return [resolved, `${resolved}.ts`, `${resolved}/index.ts`,
      resolved.replace(/\.js$/, '.ts')].find(name => sources.has(name));
  }
  const host = {
    ...ts.createCompilerHost(options),
    getCurrentDirectory: () => '/project',
    fileExists: name => sources.has(name) || libFiles.has(name),
    readFile: name => sources.get(name) ?? libFiles.get(name),
    getSourceFile(name, languageVersion) {
      const text = this.readFile(name);
      return text === undefined ? undefined : ts.createSourceFile(name, text, languageVersion, true);
    },
    resolveModuleNames: (names, importer) => names.map(name => {
      const resolvedFileName = resolve(name, importer);
      return resolvedFileName ? { resolvedFileName, extension: ts.Extension.Ts } : undefined;
    }),
  };
  return { sources, userSources, entryPath, resolve, host };
}

export function diagnostic(d) {
  const position = d.file?.getLineAndCharacterOfPosition(d.start ?? 0);
  return {
    file: d.file?.fileName.replace('/project/', '') ?? '',
    line: position ? position.line + 1 : 0,
    column: position ? position.character + 1 : 0,
    message: ts.flattenDiagnosticMessageText(d.messageText, '\n'),
    severity: d.category === ts.DiagnosticCategory.Warning ? 'warning' : 'error',
    code: d.code,
  };
}
