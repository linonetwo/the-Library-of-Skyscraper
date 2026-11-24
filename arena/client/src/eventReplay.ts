import type { Snapshot } from "./types";
import type { ReplayFrame } from "./useReplay";
export type RecordedEvent = Snapshot["events"][number];
export type EventFocus = { sessionId: string; event: RecordedEvent };

/** Describe the server's settlement record, without inferring a cause. */
export function resultEvent(snapshot: Snapshot) {
  return [...snapshot.events].reverse().find(event => event.kind === "settlement")
    ?? snapshot.events.at(-1);
}
const sameEvent = (a: RecordedEvent, b: RecordedEvent) =>
  a.id === b.id && a.tick === b.tick && a.kind === b.kind && a.message === b.message && a.playerId === b.playerId;

/** Current journal events belong to the latest attempt. Resets reuse IDs and ticks;
 * use recorded reset boundaries, with tick/ID rollback for older timelines. */
export function eventFrameIndex(frames: ReplayFrame[], event: RecordedEvent, resets: number[] = []): number | null {
  let start = 0;
  const lastId = (frame: ReplayFrame) => frame.snapshot.events.at(-1)?.id ?? 0;
  for (let i = 1; i < frames.length; i++) {
    if (resets.includes(frames[i].operationIndex) || frames[i].tick < frames[i - 1].tick ||
        lastId(frames[i]) < lastId(frames[i - 1])) start = i;
  }
  for (let i = start; i < frames.length; i++) {
    if (frames[i].snapshot.events.some(candidate => sameEvent(candidate, event))) return i;
  }
  return null;
}
