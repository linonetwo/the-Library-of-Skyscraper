import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { MobilityChoice } from "./mobilityChoices";
import { useArenaSession } from "./useArenaSession";
import type { Appearance, Session, ScenarioId } from "./types";

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
  const [view, setView] = useState<"map" | "rules" | "journal">(() =>
    new URLSearchParams(window.location.search).get("view") === "rules" ? "rules" : "map",
  );
  useEffect(() => {
    const url = new URL(window.location.href);
    if (view === "rules") url.searchParams.set("view", "rules");
    else if (url.searchParams.get("view") === "rules") url.searchParams.delete("view");
    window.history.replaceState(null, "", url);
  }, [view]);
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
  const focusActor = (id: string) => setFocusIntent((old) => ({
    kind: "actor", id, revision: (old?.revision ?? 0) + 1,
  }));
  const selectActor = (id: string) => {
    if (selected !== id) setMobilityChoice(null);
    setSelected(id);
    focusActor(id);
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
    scenarioId?: ScenarioId,
  ) =>
    enter(await arena.start(mode, join ? joinId : undefined, scenarioId), destination);
  const resume = async (saved: Session, destination: "map" | "rules" = "map") =>
    enter(await arena.resume(saved), destination);
  const openAiEditor = async () => {
    if (session) { setView("rules"); return; }
    const saved = arena.expeditions.find((entry) => entry.mode === "training");
    if (saved) await resume(saved.session, "rules");
    else await start("training", false, "rules");
  };
  const directEntry = useRef(false);
  useEffect(() => {
    if (directEntry.current || new URLSearchParams(window.location.search).get("view") !== "rules") return;
    directEntry.current = true;
    void openAiEditor();
  }, []);
  return {
    ...arena,
    openAiEditor,
    mobilityChoice,
    setMobilityChoice,
    focusActor,
    overviewMap: () => setFocusIntent((old) => ({ kind: "overview", revision: (old?.revision ?? 0) + 1 })),
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
