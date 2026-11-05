export type Point = { x: number; y: number };
export type Direction = "S" | "SW" | "W" | "NW" | "N" | "NE" | "E" | "SE";
const compass: Direction[] = ["E", "SE", "S", "SW", "W", "NW", "N", "NE"];
export function facing(from: Point, to: Point): Direction {
  const sector = Math.round(Math.atan2(to.y - from.y, to.x - from.x) / (Math.PI / 4));
  return compass[(sector + 8) % 8];
}

/** Presentation motion follows authoritative destinations; it never changes simulation. */
export class ActorMotion {
  private from: Point;
  private to: Point;
  private started = 0;
  direction: Direction = "S";
  constructor(position: Point, readonly duration = 450) {
    this.from = this.to = position;
  }
  sample(now: number) {
    const progress = Math.min(1, Math.max(0, (now - this.started) / this.duration));
    const moving = progress < 1 && (this.from.x !== this.to.x || this.from.y !== this.to.y);
    return {
      x: this.from.x + (this.to.x - this.from.x) * progress,
      y: this.from.y + (this.to.y - this.from.y) * progress,
      moving,
      direction: this.direction,
      frame: moving ? Math.floor((now - this.started) / 100) % 4 : 0,
    };
  }
  move(to: Point, now: number, snap = false) {
    if (snap) {
      this.from = this.to = to;
      return;
    }
    if (to.x === this.to.x && to.y === this.to.y) return;
    this.from = this.sample(now);
    this.direction = facing(this.from, to);
    this.to = to;
    this.started = now;
  }
}
