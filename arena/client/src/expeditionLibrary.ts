import type { Session, Snapshot } from "./types";

export interface Expedition {
  session: Session;
  mode: Snapshot["mode"];
  tick: number;
  phase: Snapshot["phase"];
  updatedAt: number;
}
const key = "arena-expeditions";
export const readExpeditions = (): Expedition[] =>
  JSON.parse(localStorage.getItem(key) || "[]");

export function rememberExpedition(session: Session, snapshot: Snapshot) {
  const entries = readExpeditions();
  const previous = entries.find(entry => entry.session.sessionId === session.sessionId
    && entry.session.playerId === session.playerId);
  const entry: Expedition = {
    session, mode: snapshot.mode, tick: snapshot.tick,
    phase: snapshot.phase, updatedAt: Date.now(),
  };
  if (previous) Object.assign(previous, entry);
  else entries.push(entry);
  entries.sort((left, right) => right.updatedAt - left.updatedAt);
  localStorage.setItem(key, JSON.stringify(entries));
  return entries;
}
