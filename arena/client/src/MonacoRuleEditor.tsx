import { useEffect, useRef } from "react";
import { monaco } from "./monacoSetup";
import type { RuleDiagnostic } from "./scriptTypes";

interface Props {
  files: Record<string, string>;
  activeFile: string;
  onChange: (value: string) => void;
  diagnostics: RuleDiagnostic[];
  onPositionChange?: (position: {
    file: string;
    line: number;
    column: number;
  }) => void;
  location?: { file: string; line: number; column: number; nonce: number };
}

export default function MonacoRuleEditor({
  files,
  activeFile,
  onChange,
  diagnostics,
  location,
  onPositionChange,
}: Props) {
  const host = useRef<HTMLDivElement>(null);
  const instance = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const models = useRef(new Map<string, monaco.editor.ITextModel>());
  const views = useRef(new Map<string, monaco.editor.ICodeEditorViewState>());
  const selected = useRef<string | undefined>(undefined);
  const syncing = useRef(false);
  const change = useRef(onChange);
  change.current = onChange;
  const positionChange = useRef(onPositionChange);
  positionChange.current = onPositionChange;

  useEffect(() => {
    const editor = monaco.editor.create(host.current!, {
      model: null,
      theme: "arena-ink",
      automaticLayout: true,
      minimap: { enabled: false },
      fontSize: 13,
      lineNumbersMinChars: 3,
      scrollBeyondLastLine: false,
      ariaLabel: "TypeScript规则源码",
      tabSize: 2,
      padding: { top: 14 },
    });
    instance.current = editor;
    const subscription = editor.onDidChangeModelContent(() => {
      if (!syncing.current) change.current(editor.getValue());
    });
    const cursor = editor.onDidChangeCursorPosition((event) => {
      if (selected.current)
        positionChange.current?.({
          file: selected.current,
          line: event.position.lineNumber,
          column: event.position.column,
        });
    });
    return () => {
      cursor.dispose();
      subscription.dispose();
      editor.dispose();
      for (const model of models.current.values()) model.dispose();
      models.current.clear();
      views.current.clear();
      selected.current = undefined;
      instance.current = null;
    };
  }, []);

  useEffect(() => {
    const editor = instance.current!;
    syncing.current = true;
    if (selected.current && selected.current !== activeFile) {
      const view = editor.saveViewState();
      if (view) views.current.set(selected.current, view);
    }
    for (const [file, source] of Object.entries(files)) {
      const model = models.current.get(file);
      if (!model) {
        models.current.set(
          file,
          monaco.editor.createModel(
            source,
            "typescript",
            monaco.Uri.from({ scheme: "file", path: `/${file}` }),
          ),
        );
      } else if (model.getValue() !== source) {
        model.setValue(source);
      }
    }
    const activeModel = models.current.get(activeFile) ?? null;
    if (editor.getModel() !== activeModel) {
      editor.setModel(activeModel);
      const view = views.current.get(activeFile);
      if (view) editor.restoreViewState(view);
    }
    selected.current = activeFile;
    for (const [file, model] of models.current) {
      if (!(file in files)) {
        model.dispose();
        models.current.delete(file);
        views.current.delete(file);
      }
    }
    syncing.current = false;
  }, [files, activeFile]);

  useEffect(() => {
    for (const [file, model] of models.current) {
      monaco.editor.setModelMarkers(
        model,
        "arena-compiler",
        diagnostics
          .filter((item) => item.file === file)
          .map((item) => ({
            severity:
              item.severity === "error"
                ? monaco.MarkerSeverity.Error
                : monaco.MarkerSeverity.Warning,
            message: item.message,
            startLineNumber: item.line,
            startColumn: item.column,
            endLineNumber: item.line,
            endColumn: item.column + 1,
          })),
      );
    }
  }, [diagnostics, files]);

  useEffect(() => {
    if (location?.file === activeFile) {
      const editor = instance.current!;
      editor.setPosition({
        lineNumber: location.line,
        column: location.column,
      });
      editor.revealLineInCenter(location.line);
      editor.focus();
    }
  }, [location, activeFile]);

  return <div ref={host} className="script-monaco" />;
}
