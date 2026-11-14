import { X, Hammer } from "lucide-react";

import { useArena } from "./ArenaWorkspace";
import type { Room } from "./types";

export default function RoomPopup({ room }: { room: Room }) {
  const { command, setSelectedRoom, actor, ready, isOwner } = useArena();

  return (
    <div className="room-popup">
      <button
        className="close-button"
        aria-label="关闭房间详情"
        onClick={() => setSelectedRoom(null)}
      >
        <X size={14} />
      </button>
      <small>房间档案 / {room.id}</small>
      <h3>{room.name}</h3>
      <p>
        藏材 {room.resources} · 威胁生命 {room.enemyHp}
      </p>
      <div className="room-actions">
        <button
            disabled={!ready || !isOwner}
          onClick={() =>
            void command({
              type: "move",
              actorId: actor!.id,
              roomId: room.id,
            })
          }
        >
          派遣选中角色
        </button>
        <button
          disabled={!ready}
          onClick={() =>
            void command({
              type: "build",
              roomId: room.id,
              kind: "tower",
            })
          }
        >
          <Hammer size={13} />
          建造哨塔
        </button>
        <button
          disabled={!ready}
          onClick={() =>
            void command({
              type: "build",
              roomId: room.id,
              kind: "catalog",
            })
          }
        >
          建造编目台
        </button>
      </div>
    </div>
  );
}
