import { Radio, RotateCcw } from "lucide-react";
import { presetNames, useArena } from "./ArenaWorkspace";

export function ScriptVersion({ busy, onDisable }: {
  busy: boolean;
  onDisable: () => void;
}) {
  const { player, snapshot, ready } = useArena();
  const script = player?.script;
  return <section className={`script-version ${script ? "active" : ""}`} aria-label="当前规则版本">
    <Radio size={17} />
    <div>
      <strong>{script ? "TS 规则已接管小队" : "行动预设运行中"}</strong>
      {script ? <small>
        <code>{script.sourceHash.slice(0, 12)}</code> · {script.entry} · 发布于 T{script.publishedAtTick}
        {snapshot?.paused && " · 单步推进观察行动"}
      </small> : <small>{player ? presetNames[player.rule.preset] : "创建赛局后即可发布规则"}</small>}
    </div>
    {script && <button disabled={busy || !ready} onClick={onDisable}>
      <RotateCcw size={13} />恢复行动预设
    </button>}
  </section>;
}
