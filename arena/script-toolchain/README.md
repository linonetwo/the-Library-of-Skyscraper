# Arena TypeScript toolchain

`npm ci && npm test`

This package compiles in-memory rule projects. It supplies the ES2022 library and
the sibling `@skyscraper/arena-script-sdk` types; player code is never executed by
the compiler. TypeScript performs strict diagnostics, then esbuild bundles the
project into an IIFE exposing `__arenaRule.decide(ctx)` for the V8 runner.

```js
import { compileRule } from '@skyscraper/arena-script-toolchain';
const result = await compileRule({
  entry: 'main.ts', // default
  files: {
    'main.ts': `import type { RuleContext } from '@skyscraper/arena-script-sdk';
export function decide(ctx: RuleContext) { return { intents: [] }; }`,
  },
});
```

The result contains `diagnostics` with `file`, one-based `line` and `column`,
`message`, `severity`, and TypeScript diagnostic `code`. Project-level messages
use position zero. The synthetic `/contract.ts` checks the entry module against
`ActionRuleModule`. Compilation errors omit `bundle`.

Successful `bundle` fields are `sourceHash`, `entry`, `code`, and `sourceMap` (JSON
text including original sources). SHA-256 includes normalized sorted sources,
entry, SDK version, toolchain version, TypeScript version and esbuild version.
Relative project imports support `.ts`, extensionless paths and `.js` specifiers
resolving to TypeScript. SDK imports use `import type`; SDK code is type-only.
Dependencies come from the supplied files and official SDK.

`node cli.mjs` reads JSON requests, one per line, and writes one JSON result per
line. Process diagnostics go to stderr. Keep the process running for repeated
requests so the toolchain and standard library remain loaded. Runtime execution,
tick scheduling, memory and action settlement belong to the runner/server.
