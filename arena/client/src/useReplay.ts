import { useEffect, useState } from "react";
import { eventFrameIndex, type EventFocus } from "./eventReplay";
import { arenaApi } from "./arenaApi";
import type { Session, Snapshot } from "./types";
import type { RuleHistory } from "./replayRuleState";

export interface ReplayFrame {
  operationIndex: number;
  tick: number;
  snapshot: Snapshot;
}
export interface ReplayTimeline {
  sessionId: string;
  frames: ReplayFrame[];
  ruleHistory?: RuleHistory;
}

export function useReplay(session: Session, target?: EventFocus | null) {
  const [timeline, setTimeline] = useState<ReplayTimeline | null>(null);
  const [eventLocated, setEventLocated] = useState<boolean | null>(null);
  const [error, setError] = useState("");
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  useEffect(() => {
    let active = true;
    setTimeline(null);
    setEventLocated(null);
    setIndex(0);
    setPlaying(false);
    setError("");
    void arenaApi.timeline(session).then(
      (recording) => { if (active) {
        setTimeline(recording);
        if (target) {
          const match = target.sessionId === recording.sessionId ? eventFrameIndex(recording.frames, target.event, (recording.ruleHistory?.changes ?? []).filter(change => "reset" in change).map(change => change.operationIndex)) : null;
          setEventLocated(match !== null);
          if (match !== null) setIndex(match);
        }
      } },
      (cause: Error) => { if (active) setError(cause.message); },
    );
    return () => { active = false; };
  }, [session.sessionId, session.token, target]);

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
  return { timeline, eventLocated, frame: timeline?.frames[index], error, index, lastIndex, playing, speed, setSpeed, seek, toggle };
}
