import { createHash } from 'node:crypto';
import ts from 'typescript';
import * as esbuild from 'esbuild';
import { createProject, diagnostic, options, sdkVersion, toolchainVersion } from './project.mjs';

export async function compileRule({ files, entry = 'main.ts' }) {
  const project = createProject(files, entry);
  const program = ts.createProgram({
    rootNames: [...project.userSources.map(([name]) => name), '/contract.ts'],
    options,
    host: project.host,
  });
  const diagnostics = ts.getPreEmitDiagnostics(program).map(diagnostic);
  if (diagnostics.some(item => item.severity === 'error')) return { diagnostics };
  try {
    const result = await esbuild.build({
      entryPoints: [project.entryPath],
      bundle: true,
      write: false,
      format: 'iife',
      globalName: '__arenaRule',
      platform: 'neutral',
      target: 'es2022',
      sourcemap: 'external',
      sourcesContent: true,
      outfile: '/rule.js',
      logLevel: 'silent',
      plugins: [{
        name: 'arena-project',
        setup(build) {
          build.onResolve({ filter: /.*/ }, args => {
            const name = project.resolve(args.path, args.importer || '/project/main.ts');
            return name
              ? { path: name, namespace: 'arena' }
              : { errors: [{ text: `Module ${args.path} is outside this rule project.` }] };
          });
          build.onLoad({ filter: /.*/, namespace: 'arena' }, args => ({
            contents: project.sources.get(args.path), loader: 'ts',
          }));
        },
      }],
    });
    const sourceHash = createHash('sha256').update(JSON.stringify({
      files: project.userSources,
      entry: project.entryPath,
      toolchain: toolchainVersion,
      sdk: sdkVersion,
      typescript: ts.version,
      esbuild: esbuild.version,
    })).digest('hex');
    return {
      diagnostics,
      bundle: {
        sourceHash,
        entry: project.entryPath.slice('/project/'.length),
        code: result.outputFiles.find(file => file.path.endsWith('.js')).text,
        sourceMap: result.outputFiles.find(file => file.path.endsWith('.map')).text,
      },
    };
  } catch (error) {
    return { diagnostics: [...diagnostics, ...error.errors.map(item => ({
      file: item.location?.file.replace(/^arena:\/project\//, '') ?? entry,
      line: item.location?.line ?? 0,
      column: item.location ? item.location.column + 1 : 0,
      message: item.text,
      severity: 'error',
      code: 'BUNDLE',
    }))] };
  }
}
