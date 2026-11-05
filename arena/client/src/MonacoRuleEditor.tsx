import { useEffect, useRef } from "react";
import * as monaco from "monaco-editor/esm/vs/editor/editor.api";
import "monaco-editor/esm/vs/language/typescript/monaco.contribution";
import EditorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import TsWorker from "monaco-editor/esm/vs/language/typescript/ts.worker?worker";
import views from "../../script-sdk/src/views.ts?raw";
import contract from "../../script-sdk/src/contract.ts?raw";
import type { RuleDiagnostic } from "./scriptTypes";

self.MonacoEnvironment = {
  getWorker: (_, label) => label === "typescript" || label === "javascript"
    ? new TsWorker() : new EditorWorker(),
};
const ts = (monaco.languages as typeof import("monaco-editor").languages).typescript;
ts.typescriptDefaults.setCompilerOptions({
  target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext,
  strict: true, lib: ["es2022"], noEmit: true,
});
ts.typescriptDefaults.addExtraLib(
  `declare module "@skyscraper/arena-script-sdk" {\n${views}\n${contract.replace(/^import type[\s\S]*?;\n/, "")}\n}`,
  "file:///arena-sdk.d.ts",
);
monaco.editor.defineTheme("arena-ink", {
  base: "vs-dark", inherit: true, rules: [],
  colors: { "editor.background": "#10252c", "editor.foreground": "#d7decf",
    "editorLineNumber.foreground": "#637e7b", "editorCursor.foreground": "#e8cf97" },
});

interface Props {
  source: string;
  onChange: (value: string) => void;
  diagnostics: RuleDiagnostic[];
}
export default function MonacoRuleEditor({ source, onChange, diagnostics }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const instance = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const change = useRef(onChange);
  change.current = onChange;
  useEffect(() => {
    const model = monaco.editor.createModel(source, "typescript", monaco.Uri.parse("file:///main.ts"));
    const editor = monaco.editor.create(host.current!, {
      model, theme: "arena-ink", automaticLayout: true, minimap: { enabled: false },
      fontSize: 13, lineNumbersMinChars: 3, scrollBeyondLastLine: false,
      ariaLabel: "TypeScript规则源码", tabSize: 2, padding: { top: 14 },
    });
    instance.current = editor;
    const subscription = model.onDidChangeContent(() => change.current(model.getValue()));
    return () => { subscription.dispose(); editor.dispose(); model.dispose(); instance.current = null; };
  }, []);
  useEffect(() => {
    const model = instance.current?.getModel();
    if (model && model.getValue() !== source) model.setValue(source);
  }, [source]);
  useEffect(() => {
    const model = instance.current?.getModel();
    if (model) monaco.editor.setModelMarkers(model, "arena-compiler", diagnostics.map(item => ({
      severity: item.severity === "error" ? monaco.MarkerSeverity.Error : monaco.MarkerSeverity.Warning,
      message: item.message, startLineNumber: item.line, startColumn: item.column,
      endLineNumber: item.line, endColumn: item.column + 1,
    })));
  }, [diagnostics]);
  return <div ref={host} className="script-monaco" />;
}
