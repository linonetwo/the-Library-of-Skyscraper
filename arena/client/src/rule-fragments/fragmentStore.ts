import type { GraphFragment } from "../../../behavior-modules/graph";
import { serverStorageKey } from "../serverConnection";

export interface SavedGraphFragment {
  id: string;
  name: string;
  fragment: GraphFragment;
}
const key = () => serverStorageKey("arena-personal-rule-fragments:v1");
export function readFragments(): SavedGraphFragment[] {
  return JSON.parse(localStorage.getItem(key()) ?? "[]");
}
export function writeFragments(fragments: SavedGraphFragment[]) {
  localStorage.setItem(key(), JSON.stringify(fragments));
}
