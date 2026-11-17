import { Check, X } from "lucide-react";
import { ArenaContext, useArenaWorkspace } from "./ArenaWorkspace";
import GameHUD from "./GameHUD";
import Battlefield from "./Battlefield";
import CharacterInspector from "./CharacterInspector";
import LobbyDialog from "./LobbyDialog";
import HelpDialog from "./HelpDialog";

export default function App() {
  const workspace = useArenaWorkspace();
  const { lobby, help, error, setError, notice, inspecting, setInspecting } = workspace;
  return (
    <ArenaContext.Provider value={workspace}>
      <div className="app-shell">

        <div className="main-shell" inert={lobby || help}>
          <GameHUD />
          <main className="workspace">
            <Battlefield />
            {inspecting && <div className="character-drawer"><button className="drawer-close" aria-label="关闭角色面板" onClick={() => setInspecting(false)}>关闭 ×</button><CharacterInspector /></div>}
          </main>
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
