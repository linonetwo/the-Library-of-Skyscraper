import type { Session } from "./types";
import type { RuleSourceProject } from "./scriptTypes";
import { recallSource } from "./scriptTemplates";

export interface RuleDraft {
  files: Record<string, string>;
  entry: string;
  activeFile: string;
  baseVersion?: string;
}
export const draftKey = (session: Session | null) => session
  ? `arena-rule-project:${session.sessionId}:${session.playerId}` : "arena-rule-project:scratch";
export function projectDraft(project: RuleSourceProject, baseVersion?: string): RuleDraft {
  const entry = project.entry ?? "main.ts";
  return { files: project.files, entry, activeFile: entry, baseVersion };
}
export function readDraft(session: Session | null): RuleDraft {
  const key = draftKey(session);
  const saved = localStorage.getItem(key);
  if (saved) return JSON.parse(saved);
  const legacy = localStorage.getItem("arena-rule-draft");
  const source = legacy && !localStorage.getItem("arena-rule-draft-imported") ? legacy : recallSource;
  const draft = projectDraft({ files: { "main.ts": source } });
  localStorage.setItem(key, JSON.stringify(draft));
  if (legacy) localStorage.setItem("arena-rule-draft-imported", key);
  return draft;
}
