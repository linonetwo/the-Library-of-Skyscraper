import type { NamedRecordingRange } from './coverage';
import type { RecordingIdentity } from './index';

export interface RangeStore { getItem(key: string): string | null; setItem(key: string, value: string): void }
export function rangeKey(identity: RecordingIdentity) { return `arena.recordings.v1:${identity.sessionId}:${identity.ownerId}`; }
export function loadRanges(store: RangeStore, identity: RecordingIdentity): NamedRecordingRange[] {
  const raw = store.getItem(rangeKey(identity));
  if (!raw) return [];
  try { return JSON.parse(raw) as NamedRecordingRange[]; }
  catch { return []; }
}
/** Only local recording metadata, never tokens, graph configuration or runtime memory. */
export function saveRange(store: RangeStore, identity: RecordingIdentity, ranges: NamedRecordingRange[], range: NamedRecordingRange): NamedRecordingRange[] {
  if (range.sessionId !== identity.sessionId || range.ownerId !== identity.ownerId) throw new Error('Named range belongs to another recording or owner');
  const next = [...ranges.filter(existing => existing.name !== range.name), range];
  store.setItem(rangeKey(identity), JSON.stringify(next));
  return next;
}
