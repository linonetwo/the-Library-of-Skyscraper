import { createContext, useContext, useEffect, useState } from "react";
import { useArenaSession } from "./useArenaSession";
import type { Appearance, Session } from "./types";

export const presetNames = {
  gather: "资源优先",
  defend: "守卫书库",
  explore: "深入探索",
};
const stateNames: Record<string, string> = {
  idle: "等待指令",
  moving: "探索行进",
  gathering: "采集藏材",
  transporting: "运返中庭",
  delivering: "藏材入库",
  fighting: "迎战威胁",
  retreating: "撤退休整",
  defending: "守卫书库",
  guarding: "守卫书库",
  scouting: "巡查书库",
};
export const stateName = (value = "idle") => stateNames[value] || value;

export function useArenaWorkspace() {
  const arena = useArenaSession();
  const { session, snapshot, connection, busy } = arena;
  const [selected, setSelected] = useState<string | null>(null);
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [showRoutes, setShowRoutes] = useState(true);
  const [view, setView] = useState<"map" | "rules" | "journal">("map");
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
    arena.command({ type: "equip", actorId: actor!.id,
      appearance: { ...actor!.appearance, ...change } });
  const ready =
    !!snapshot &&
    connection === "connected" &&
    !busy &&
    snapshot.phase === "running";
  const training = snapshot?.mode === "training";
  const isOwner = actor?.owner === session?.playerId;
  const selectActor = (id: string) => {
    setSelected(id);
    setSelectedRoom(null);
  };
  useEffect(() => {
    setSelected(
      (current) =>
        current ||
        snapshot?.actors.find((a) => a.owner === session?.playerId)?.id ||
        null,
    );
  }, [snapshot, session?.playerId]);
  useEffect(() => {
    if (player) {
      setPreset(player.rule.preset);
      setThreshold(player.rule.retreatHp);
    }
  }, [player?.rule.preset, player?.rule.retreatHp]);
  const enter = (next: Session | undefined) => {
    if (next) {
      setLobby(false);
      setSelected(null);
      setSelectedRoom(null);
      setView("map");
    }
  };
  const start = async (mode: "training" | "online", join = false) =>
    enter(await arena.start(mode, join ? joinId : undefined));
  const resume = async (saved: Session) => enter(await arena.resume(saved));
  return {
    ...arena,
    start,
    resume,
    selected,
    selectedRoom,
    setSelectedRoom,
    equip,
    zoom,
    setZoom,
    showRoutes,
    setShowRoutes,
    view,
    setView,
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
