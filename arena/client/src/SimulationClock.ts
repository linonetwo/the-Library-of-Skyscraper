import type { Snapshot } from "./types";

/** One scene clock; identical snapshots and UI rerenders never restart it. */
export class SimulationClock {
  private session = "";
  private tick = -1;
  private paused = true;
  private received = 0;
  private duration = 500;

  update(snapshot: Snapshot, now: number, presentationPaused = false) {
    const paused=snapshot.paused||presentationPaused;
    if (
      snapshot.sessionId !== this.session ||
      snapshot.tick !== this.tick ||
      paused !== this.paused
    ) {
      this.received = now;
    }
    this.session = snapshot.sessionId;
    this.tick = snapshot.tick;
    this.paused = paused;
    this.duration = snapshot.tickDurationMs || 500;
  }

  sample(now: number) {
    return (
      this.tick * this.duration +
      (this.paused
        ? 0
        : Math.min(this.duration, Math.max(0, now - this.received)))
    );
  }
}
