import { useState } from "react";
import type { RuleDraft } from "./ruleDraft";

export function ScriptFiles({ draft, selectFile, addFile, setEntry }: {
  draft: RuleDraft;
  selectFile: (file: string) => void;
  addFile: (file: string) => void;
  setEntry: (file: string) => void;
}) {
  const [name, setName] = useState("");
  return <div className="script-project">
    <div className="script-tabs" role="tablist" aria-label="规则源码文件">
      {Object.keys(draft.files).map(file => <button key={file} role="tab"
        aria-selected={file === draft.activeFile} onClick={() => selectFile(file)}>
        {file}{file === draft.entry ? " · 入口" : ""}
      </button>)}
    </div>
    <div className="script-project-tools">
      <label>入口 <select aria-label="规则入口文件" value={draft.entry}
        onChange={event => setEntry(event.target.value)}>
        {Object.keys(draft.files).map(file => <option key={file}>{file}</option>)}
      </select></label>
      <input aria-label="新规则文件名" placeholder="helpers.ts" value={name}
        onChange={event => setName(event.target.value)} />
      <button disabled={!name.trim()} onClick={() => { addFile(name.trim()); setName(""); }}>添加文件</button>
    </div>
  </div>;
}
