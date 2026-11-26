import type { CustomModuleDefinition, CustomModuleDraft } from "../../../../behavior-modules/graph";
import { serverStorageKey } from "../../serverConnection";

const libraryKey = () => serverStorageKey("arena-personal-custom-modules:v1");
const draftKey = () => serverStorageKey("arena-custom-module-author-draft:v1");

export function readCustomModules(): CustomModuleDefinition[] {
  return JSON.parse(localStorage.getItem(libraryKey()) ?? "[]");
}
export function writeCustomModules(definitions: CustomModuleDefinition[]) {
  localStorage.setItem(libraryKey(), JSON.stringify(definitions));
}
export function readCustomAuthorDraft(): CustomModuleDraft | null {
  return JSON.parse(localStorage.getItem(draftKey()) ?? "null");
}
export function writeCustomAuthorDraft(draft: CustomModuleDraft | null) {
  if (draft) localStorage.setItem(draftKey(), JSON.stringify(draft));
  else localStorage.removeItem(draftKey());
}
