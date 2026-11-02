import { ScrollText, ChevronRight } from "lucide-react";

import { useArena } from "./ArenaWorkspace";

export default function EventStrip() {
  const { snapshot, setView } = useArena();

  return (
    <footer className="event-strip">
      <span className="event-title">
        <ScrollText size={14} />
        书苑纪事
      </span>
      {snapshot?.events.length ? (
        snapshot.events
          .slice(-2)
          .reverse()
          .map((event) => (
            <div key={event.id}>
              <time>T{String(event.tick).padStart(4, "0")}</time>
              <span>{event.message}</span>
            </div>
          ))
      ) : (
        <p>此刻的书页，正等待你的第一笔。</p>
      )}
      <button aria-label="查看完整日志" onClick={() => setView("journal")}>
        <ChevronRight size={16} />
      </button>
    </footer>
  );
}
