import { useCallback, useEffect, useState } from "react";
import { arenaApi } from "./arenaApi";
import type { Command, Session, Snapshot } from "./types";
import { readExpeditions, rememberExpedition } from "./expeditionLibrary";

export function useArenaSession() {
  const [session, setSession] = useState<Session | null>(() =>
    JSON.parse(sessionStorage.getItem("arena-session") || "null"),
  );
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [expeditions, setExpeditions] = useState(readExpeditions);
  const [connection, setConnection] = useState<
    "idle" | "connecting" | "connected" | "disconnected"
  >("idle");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const acceptSnapshot = useCallback((next: Snapshot) => {
    setSnapshot(next);
  }, []);

  // Every user request shares one status and error boundary.
  const perform = async <T>(operation: () => Promise<T>) => {
    setBusy(true);
    setError("");
    try {
      return await operation();
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!session) return;
    let disposed = false;
    let socket: WebSocket | undefined;
    let reconnect: ReturnType<typeof setTimeout>;
    let attempts = 0;
    const scheduleReconnect = () => {
      if (disposed) return;
      setConnection("disconnected");
      reconnect = setTimeout(connect, Math.min(1000 * 2 ** attempts++, 10000));
    };
    const connect = async () => {
      setConnection("connecting");
      try {
        const next = await arenaApi.state(session);
        if (disposed) return;
        acceptSnapshot(next);
        socket = arenaApi.subscribe(session);
        socket.onopen = () => {
          attempts = 0;
          setConnection("connected");
          setError("");
        };
        socket.onmessage = (event) => acceptSnapshot(JSON.parse(event.data));
        socket.onerror = () => socket?.close();
        socket.onclose = scheduleReconnect;
      } catch (cause) {
        if (disposed) return;
        setError((cause as Error).message);
        scheduleReconnect();
      }
    };
    void connect();
    return () => {
      disposed = true;
      clearTimeout(reconnect);
      socket?.close();
    };
  }, [session, acceptSnapshot]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (session && snapshot && session.sessionId === snapshot.sessionId
      && (snapshot.paused || snapshot.phase === "settled" || snapshot.tick % 10 === 0)) {
      setExpeditions(rememberExpedition(session, snapshot));
    }
  }, [session, snapshot]);
  useEffect(() => {
    const sync = () => setExpeditions(readExpeditions());
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  const start = (mode: "training" | "online", joinId?: string) =>
    perform(async () => {
      const next = await (joinId === undefined
        ? arenaApi.create(mode)
        : arenaApi.join(joinId));
      const state = await arenaApi.state(next);
      setExpeditions(rememberExpedition(next, state));
      sessionStorage.setItem("arena-session", JSON.stringify(next));
      setSnapshot(null);
      setSession(next);
      return next;
    });
  const resume = (next: Session) => perform(async () => {
    const state = await arenaApi.state(next);
    sessionStorage.setItem("arena-session", JSON.stringify(next));
    setSnapshot(state);
    setSession(next);
    setExpeditions(rememberExpedition(next, state));
    setNotice("远征已接续，原小队与装束已恢复。");
    return next;
  });
  const command = (value: Command) =>
    perform(async () => {
      const next = await arenaApi.command(session!, value);
      acceptSnapshot(next);
      if (value.type === "rule") setNotice("行动规则已发布，下一模拟步生效。");
    });
  const exportReplay = () =>
    perform(async () => {
      const recording = await arenaApi.replay(session!);
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(recording, null, 2)], {
          type: "application/json",
        }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = `arena-replay-${session!.sessionId}-tick-${recording.finalSnapshot.tick}.json`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNotice("已导出完整命令回放。");
    });
  const copySession = () =>
    perform(async () => {
      await navigator.clipboard.writeText(session!.sessionId);
      setNotice("赛局编号已复制。");
    });

  return {
    session,
    snapshot,
    connection,
    error,
    setError,
    busy,
    notice,
    start,
    resume,
    expeditions,
    command,
    exportReplay,
    copySession,
  };
}
