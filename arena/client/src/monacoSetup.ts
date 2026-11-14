import * as monaco from "monaco-editor/esm/vs/editor/editor.api";
import "monaco-editor/esm/vs/basic-languages/typescript/typescript.contribution";
import "monaco-editor/esm/vs/language/typescript/monaco.contribution";
import EditorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import TsWorker from "monaco-editor/esm/vs/language/typescript/ts.worker?worker";
import views from "../../script-sdk/src/views.ts?raw";
import contract from "../../script-sdk/src/contract.ts?raw";

self.MonacoEnvironment = {
  getWorker: (_, label) => label === "typescript" || label === "javascript"
    ? new TsWorker() : new EditorWorker(),
};
const ts = (monaco.languages as typeof import("monaco-editor").languages).typescript;
ts.typescriptDefaults.setCompilerOptions({
  target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.NodeJs,
  allowImportingTsExtensions: true,
  strict: true, lib: ["es2022"], noEmit: true,
});
ts.typescriptDefaults.setEagerModelSync(true);
ts.typescriptDefaults.addExtraLib(
  `declare module "@skyscraper/arena-script-sdk" {\n${views}\n${contract.replace(/^import type[\s\S]*?;\n/, "")}\n}`,
  "file:///arena-sdk.d.ts",
);
monaco.editor.defineTheme("arena-ink", {
  base: "vs-dark", inherit: true, rules: [],
  colors: { "editor.background": "#10252c", "editor.foreground": "#d7decf",
    "editorLineNumber.foreground": "#637e7b", "editorCursor.foreground": "#e8cf97" },
});

export { monaco };
