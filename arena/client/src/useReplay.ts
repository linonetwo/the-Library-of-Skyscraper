import { useEffect, useState } from "react";
import { arenaApi } from "./arenaApi";
import type { Session, Snapshot } from "./types";

export interface ReplayFrame {
  operationIndex: number;
  tick: number;
  snapshot: Snapshot;
}
export interface ReplayTimeline {
  sessionId: string;
  frames: ReplayFrame[];
}

export function useReplay(session: Session) {
  const [timeline, setTimeline] = useState<ReplayTimeline | null>(null);
  const [error, setError] = useState("");
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  useEffect(() => {
    let active = true;
    setTimeline(null);
    setIndex(0);
    setPlaying(false);
    setError("");
    void arenaApi.timeline(session).then(
      (recording) => { if (active) setTimeline(recording); },
      (cause: Error) => { if (active) setError(cause.message); },
    );
    return () => { active = false; };
  }, [session.sessionId, session.token]);

  const lastIndex = (timeline?.frames.length ?? 1) - 1;
  useEffect(() => {
    if (!playing) return;
    if (index === lastIndex) {
      setPlaying(false);
      return;
    }
    const timer = window.setTimeout(() => setIndex(index + 1), 500 / speed);
    return () => window.clearTimeout(timer);
  }, [playing, index, lastIndex, speed]);

  const seek = (next: number) => { setPlaying(false); setIndex(next); };
  const toggle = () => {
    if (!playing && index === lastIndex) setIndex(0);
    setPlaying(!playing);
  };
  return { timeline, frame: timeline?.frames[index], error, index, lastIndex, playing, speed, setSpeed, seek, toggle };
}
