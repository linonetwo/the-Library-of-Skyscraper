import { useState } from "react";
import {
  saveCustomModuleDefinition,
  type CustomModuleDraft,
  type CustomModuleDefinition,
} from "../../../../behavior-modules/graph";
import { readCustomAuthorDraft, readCustomModules, writeCustomAuthorDraft, writeCustomModules } from "./customModuleStore";

export function useCustomModules() {
  const [definitions, setDefinitions] = useState(readCustomModules);
  const [draft, setDraft] = useState(readCustomAuthorDraft);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const edit = (next: CustomModuleDraft | null) => {
    setDraft(next);
    writeCustomAuthorDraft(next);
    setError("");
  };
  const save = async () => {
    if (!draft) return;
    setSaving(true);
    setError("");
    try {
      const definition = await saveCustomModuleDefinition(draft);
      setDefinitions(current => {
        const next = [definition, ...current.filter(item => item.definitionId !== definition.definitionId || item.revisionId !== definition.revisionId)];
        writeCustomModules(next);
        return next;
      });
      return definition;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setSaving(false);
    }
  };
  const remove = (definition: CustomModuleDefinition) => {
    setDefinitions(current => {
      const next = current.filter(item => item.definitionId !== definition.definitionId || item.revisionId !== definition.revisionId);
      writeCustomModules(next);
      return next;
    });
  };
  return { definitions, draft, edit, save, remove, saving, error };
}
