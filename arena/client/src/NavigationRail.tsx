import {
  BookOpen,
  Compass,
  ScrollText,
  Settings2,
  Network,
  CircleHelp,
} from "lucide-react";

import { useArena } from "./ArenaWorkspace";

export default function NavigationRail() {
  const { view, setView, lobby, setLobby, help, setHelp } = useArena();

  return (
    <aside className="rail" inert={lobby || help}>
      <button
        className="brand-icon"
        aria-label="打开赛局入口"
        onClick={() => setLobby(true)}
      >
        <BookOpen size={27} />
      </button>
      <div className="rail-mark">
        书<br />苑
      </div>
      <nav aria-label="主导航">
        <button
          className={view === "map" ? "active" : ""}
          onClick={() => setView("map")}
          title="战场总览"
          aria-label="战场总览"
        >
          <Compass />
          <span>战场</span>
        </button>
        <button
          className={view === "rules" ? "active" : ""}
          onClick={() => setView("rules")}
          title="行动规则"
          aria-label="行动规则"
        >
          <Settings2 />
          <span>规则</span>
        </button>
        <button
          className={view === "journal" ? "active" : ""}
          onClick={() => setView("journal")}
          title="赛局日志"
          aria-label="赛局日志"
        >
          <ScrollText />
          <span>日志</span>
        </button>
        <button
          onClick={() => setLobby(true)}
          title="联机大厅"
          aria-label="联机大厅"
        >
          <Network />
          <span>联机</span>
        </button>
      </nav>
      <button
        className="help-button"
        aria-label="操作指南"
        onClick={() => setHelp(true)}
      >
        <CircleHelp size={21} />
      </button>
      <span className="rail-version">α 0.1</span>
    </aside>
  );
}
