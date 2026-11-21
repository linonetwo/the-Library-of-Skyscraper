export type ClipTiming = {
  frameCount: number;
  frameMs?: number;
  frameDurationsMs?: readonly number[];
  playback: "loop" | "once" | "holdLast";
};

export function clipDuration(clip: ClipTiming) {
  return clip.frameDurationsMs
    ? clip.frameDurationsMs.reduce((sum, duration) => sum + duration, 0)
    : clip.frameCount * clip.frameMs!;
}

/** Frame intervals are half open; a completed one-shot retains its last frame. */
export function frameAt(clip: ClipTiming, elapsedMs: number) {
  const duration = clipDuration(clip);
  const elapsed = Math.max(0, elapsedMs);
  let remaining =
    clip.playback === "loop" ? elapsed % duration : Math.min(elapsed, duration);
  for (let frame = 0; frame < clip.frameCount - 1; frame++) {
    const length = clip.frameDurationsMs?.[frame] ?? clip.frameMs!;
    if (remaining < length) return frame;
    remaining -= length;
  }
  return clip.frameCount - 1;
}
