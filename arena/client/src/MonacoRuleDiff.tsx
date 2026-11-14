import { useEffect, useRef } from "react";
import { monaco } from "./monacoSetup";

interface Props { original: string; modified: string; fileName: string }
let nextDiff = 0;

export default function MonacoRuleDiff({ original, modified, fileName }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const instance = useRef<monaco.editor.IStandaloneDiffEditor | null>(null);
  useEffect(() => {
    const id = ++nextDiff;
    const model = {
      original: monaco.editor.createModel(original, "typescript",
        monaco.Uri.from({ scheme: "arena-diff", path: `/${id}/original/${fileName}` })),
      modified: monaco.editor.createModel(modified, "typescript",
        monaco.Uri.from({ scheme: "arena-diff", path: `/${id}/modified/${fileName}` })),
    };
    const editor = monaco.editor.createDiffEditor(host.current!, {
      theme: "arena-ink", automaticLayout: true, renderSideBySide: false,
      readOnly: true, originalEditable: false, minimap: { enabled: false },
      fontSize: 13, scrollBeyondLastLine: false, ariaLabel: "规则源码差异",
    });
    editor.setModel(model);
    instance.current = editor;
    return () => {
      editor.setModel(null);
      editor.dispose();
      model.original.dispose();
      model.modified.dispose();
      instance.current = null;
    };
  // Keep the models alive when changing files: an in-flight worker diff still
  // needs both models until its result reaches the editor.
  }, []);
  useEffect(() => {
    const model = instance.current!.getModel()!;
    if (model.original.getValue() !== original) model.original.setValue(original);
    if (model.modified.getValue() !== modified) model.modified.setValue(modified);
  }, [original, modified]);
  return <div ref={host} className="script-diff" role="region" aria-label="规则源码差异" />;
}
