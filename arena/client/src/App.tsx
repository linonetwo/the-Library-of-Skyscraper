import { Check, X } from "lucide-react";
import { ArenaContext, useArenaWorkspace } from "./ArenaWorkspace";
import NavigationRail from "./NavigationRail";
import ArenaHeader from "./ArenaHeader";
import Battlefield from "./Battlefield";
import CharacterInspector from "./CharacterInspector";
import EventStrip from "./EventStrip";
import LobbyDialog from "./LobbyDialog";
import HelpDialog from "./HelpDialog";

export default function App() {
  const workspace = useArenaWorkspace();
  const { lobby, help, error, setError, notice } = workspace;
  return (
    <ArenaContext.Provider value={workspace}>
      <div className="app-shell">
        <NavigationRail />
        <div className="main-shell" inert={lobby || help}>
          <ArenaHeader />
          <main className="workspace">
            <Battlefield />
            <CharacterInspector />
          </main>
          <EventStrip />
        </div>
        {error && (
          <div className="toast error" role="alert">
            <span>{error}</span>
            <button aria-label="关闭错误消息" onClick={() => setError("")}>
              <X size={16} />
            </button>
          </div>
        )}
        {notice && (
          <div className="toast notice" role="status">
            <Check size={16} />
            {notice}
          </div>
        )}
        {lobby && <LobbyDialog />}
        {help && <HelpDialog />}
      </div>
    </ArenaContext.Provider>
  );
}
