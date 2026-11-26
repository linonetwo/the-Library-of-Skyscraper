import * as monaco from "monaco-editor/esm/vs/editor/editor.api";
import "monaco-editor/esm/vs/basic-languages/typescript/typescript.contribution";
import * as ts from "monaco-editor/esm/vs/language/typescript/monaco.contribution";
import EditorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import TsWorker from "monaco-editor/esm/vs/language/typescript/ts.worker?worker";
import tactics from "../../shared/tactical.ts?raw";
import chant from "../../script-sdk/src/chant.ts?raw";
import custom from "../../script-sdk/src/custom.ts?raw";
import mobility from "../../script-sdk/src/mobility.ts?raw";
import views from "../../script-sdk/src/views.ts?raw";
import contract from "../../script-sdk/src/contract.ts?raw";

self.MonacoEnvironment = {
  getWorker: (_, label) => label === "typescript" || label === "javascript"
    ? new TsWorker() : new EditorWorker(),
};
ts.typescriptDefaults.setCompilerOptions({
  target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.NodeJs,
  allowImportingTsExtensions: true,
  strict: true, lib: ["lib.es2022.d.ts"], noEmit: true,
});
ts.typescriptDefaults.setEagerModelSync(true);
ts.typescriptDefaults.addExtraLib(
  `declare module "@skyscraper/arena-script-sdk" {\n${tactics.replace(/^import type.*;\n/gm, "")}\n${chant.replace(/^import type.*;\n/gm, "").replace(/^declare /gm, "")}\n${custom.replace(/^import type.*;\n/gm, "")}\n${mobility}\n${views.replace(/^import type.*;\n/gm, "")}\n${contract.replace(/^import type[\s\S]*?;\n/gm, "")}\n}`,
  "file:///arena-sdk.d.ts",
);
monaco.editor.defineTheme("arena-ink", {
  base: "vs-dark", inherit: true, rules: [],
  colors: { "editor.background": "#10252c", "editor.foreground": "#d7decf",
    "editorLineNumber.foreground": "#637e7b", "editorCursor.foreground": "#e8cf97" },
});

export { monaco };
