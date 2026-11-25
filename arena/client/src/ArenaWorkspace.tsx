import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { MobilityChoice } from "./mobilityChoices";
import { useArenaSession } from "./useArenaSession";
import type { Appearance, Session } from "./types";

export const presetNames = {
  gather: "资源优先",
  defend: "守卫书库",
  explore: "深入探索",
};
export { stateName } from "./actorActivity";

export function useArenaWorkspace() {
  const arena = useArenaSession();
  const { session, snapshot, connection, busy } = arena;
  const [inspecting, setInspecting] = useState(false);
  const [mobilityChoice, setMobilityChoice] = useState<MobilityChoice>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [focusIntent, setFocusIntent] =
    useState<import("./cameraController").FocusIntent>();
  const [selectedRoom, updateSelectedRoom] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [showRoutes, setShowRoutes] = useState(true);
  const [view, setView] = useState<"map" | "rules" | "journal">("map");
  const [journalFocus, setJournalFocus] = useState<import("./eventReplay").EventFocus | null>(null);
  const journalAttempt = useRef({ sessionId: snapshot?.sessionId, tick: snapshot?.tick ?? 0 });
  useEffect(() => {
    if (snapshot && (snapshot.sessionId !== journalAttempt.current.sessionId || snapshot.tick < journalAttempt.current.tick)) setJournalFocus(null);
    if (snapshot) journalAttempt.current = { sessionId: snapshot.sessionId, tick: snapshot.tick };
  }, [snapshot?.sessionId, snapshot?.tick]);
  const [lobby, setLobby] = useState(false);
  const [help, setHelp] = useState(false);
  const [joinId, setJoinId] = useState("");
  const [preset, setPreset] = useState<"gather" | "defend" | "explore">(
    "gather",
  );
  const [threshold, setThreshold] = useState(35);

  const player = snapshot?.players.find((p) => p.id === session?.playerId);
  const actor = snapshot?.actors.find((a) => a.id === selected);
  const room = snapshot?.rooms.find((r) => r.id === selectedRoom);
  const ownActors =
    snapshot?.actors.filter((a) => a.owner === session?.playerId) || [];
  const outfit = actor?.appearance.outfit ?? "scholar";
  const equip = (change: Partial<Appearance>) =>
    arena.command({
      type: "equip",
      actorId: actor!.id,
      appearance: { ...actor!.appearance, ...change },
    });
  const ready =
    !!snapshot &&
    connection === "connected" &&
    !busy &&
    snapshot.phase === "running";
  const training = snapshot?.mode === "training";
  const isOwner = actor?.owner === session?.playerId;
  const setSelectedRoom = (id: string | null) => {
    updateSelectedRoom(id);
    if (id) {
      setInspecting(false);
      setFocusIntent((old) => ({
        kind: "room",
        id,
        revision: (old?.revision ?? 0) + 1,
      }));
    }
  };
  const selectActor = (id: string) => {
    setMobilityChoice(null);
    setSelected(id);
    setFocusIntent((old) => ({
      kind: "actor",
      id,
      revision: (old?.revision ?? 0) + 1,
    }));
    setInspecting(false);
    setSelectedRoom(null);
  };
  const focusedSession = useRef("");
  const lastTick = useRef(-1);
  useEffect(() => {
    if (!snapshot || !session) return;
    const initial = snapshot.actors.find(
      (a) => a.owner === session.playerId && a.hp > 0,
    );
    if (!initial) return;
    const key = `${snapshot.sessionId}/${session.playerId}`;
    const retry = snapshot.tick === 0 && lastTick.current > 0;
    if (focusedSession.current !== key || retry) {
      focusedSession.current = key;
      setSelected(initial.id);
      setSelectedRoom(null);
      setZoom(1);
      setFocusIntent((old) => ({
        kind: "actor",
        id: initial.id,
        revision: (old?.revision ?? 0) + 1,
      }));
    }
    lastTick.current = snapshot.tick;
  }, [snapshot, session?.playerId]);
  useEffect(() => {
    if (player) {
      setPreset(player.rule.preset);
      setThreshold(player.rule.retreatHp);
    }
  }, [player?.rule.preset, player?.rule.retreatHp]);
  const enter = (
    next: Session | undefined,
    destination: "map" | "rules" = "map",
  ) => {
    if (next) {
      setLobby(false);
      setSelected(null);
      setMobilityChoice(null);
      setSelectedRoom(null);
      setView(destination);
    }
  };
  const start = async (
    mode: "training" | "online",
    join = false,
    destination: "map" | "rules" = "map",
  ) =>
    enter(await arena.start(mode, join ? joinId : undefined), destination);
  const resume = async (saved: Session, destination: "map" | "rules" = "map") =>
    enter(await arena.resume(saved), destination);
  return {
    ...arena,
    mobilityChoice,
    setMobilityChoice,
    start,
    resume,
    selected,
    inspecting,
    setInspecting,
    selectedRoom,
    focusIntent,
    setSelectedRoom,
    equip,
    zoom,
    setZoom,
    showRoutes,
    setShowRoutes,
    view,
    setView,
    journalFocus,
    setJournalFocus,
    lobby,
    setLobby,
    help,
    setHelp,
    joinId,
    setJoinId,
    preset,
    setPreset,
    threshold,
    setThreshold,
    player,
    actor,
    room,
    ownActors,
    outfit,
    ready,
    training,
    isOwner,
    selectActor,
  };
}

export const ArenaContext = createContext<ReturnType<typeof useArenaWorkspace>>(
  null!,
);
export const useArena = () => useContext(ArenaContext);
