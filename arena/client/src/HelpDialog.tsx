import { X } from "lucide-react";

import { useArena } from "./ArenaWorkspace";
import { useDialog } from "./useDialog";
export default function HelpDialog() {
  const { help, setHelp } = useArena();
  const dialog = useDialog(() => setHelp(false));
  return (
    <div className="modal-backdrop" onClick={() => setHelp(false)}>
      <section
        ref={dialog}
        tabIndex={-1}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label="操作指南"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="close-button"
          aria-label="关闭操作指南"
          onClick={() => setHelp(false)}
        >
          <X size={20} />
        </button>
        <span className="eyebrow">FIELD NOTES</span>
        <h2>巡书者的第一课</h2>
        <ol className="help-list">
          <li>开启训练远征，或创建联机赛局并分享编号。</li>
          <li>点击小队卡片或地图角色，查看生命、位置与装束。</li>
          <li>点击地图房间，派遣选中角色或消耗藏材建造建筑。</li>
          <li>在“规则”页设置行动预设与撤退阈值，确认后发布。</li>
          <li>训练局可暂停与单步。赛局日志记录每次服务端决策。</li>
        </ol>
        <p>
          装束用于搭配角色外观，选择保留于当前页面。重新连接赛局后即可继续指挥小队。
        </p>
      </section>
    </div>
  );
}
