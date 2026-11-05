import {
  Swords,
  ScrollText,
  Feather,
  Shield,
  ArrowUpRight,
  Check,
  Flag,
  Package,
  Sparkles,
} from "lucide-react";

import PaperDoll from "./PaperDoll";
import { outfitNames, roleNames } from "./types";
import type { Outfit } from "./types";

import { useArena, presetNames, stateName } from "./ArenaWorkspace";

export default function CharacterInspector() {
  const {
    snapshot,
    command,
    equip,
    setView,
    preset,
    player,
    actor,
    ownActors,
    outfit,
    ready,
    isOwner,
  } = useArena();

  return (
    <aside className="inspector">
      <div className="inspector-top">
        <span className="eyebrow">CHARACTER DOSSIER</span>
        <span className="serial">
          NO.{" "}
          {actor
            ? String(
                ownActors.findIndex((a) => a.id === actor.id) + 1,
              ).padStart(3, "0")
            : "—"}
        </span>
      </div>
      <div className="character-heading">
        <h2>{actor ? roleNames[actor.role] : "待命的巡书者"}</h2>
        <span>{actor ? actor.role.toUpperCase() : "THE ARCHIVIST"}</span>
      </div>
      <div className="portrait-frame">
        <div className="portrait-rings" />
        <PaperDoll
          outfit={outfit}
          hair={actor?.appearance.hair ?? "ivory"}
          weapon={actor?.appearance.weapon ?? true}
        />
        <span className="portrait-caption">PAPER DOLL / 三头身纸娃娃</span>
        <div className="portrait-seal">
          <Feather size={19} />
        </div>
      </div>
      <div className="character-stats">
        <div>
          <span>生命</span>
          <b>{actor ? `${actor.hp} / ${actor.maxHp}` : "—"}</b>
        </div>
        <div>
          <span>当前位置</span>
          <b>
            {snapshot?.rooms.find((r) => r.id === actor?.roomId)?.name ||
              "尚未入场"}
          </b>
        </div>
        <div>
          <span>行动状态</span>
          <b className="state-text">{stateName(actor?.state)}</b>
        </div>
        <div>
          <span>随身藏材</span>
          <b>{actor ? `${actor.cargo} / ${actor.cargoCapacity}` : "—"}</b>
        </div>
      </div>
      <div className="wardrobe">
        <div className="panel-title">
          <h3>纸娃娃装束</h3>
          <small>外观 · 赛局同步与回放记录</small>
        </div>
        <div className="outfit-options">
          {(["scholar", "warden"] as Outfit[]).map((item) => (
            <button
              key={item}
              disabled={!ready || !isOwner}
              className={item === outfit ? "selected" : ""}
              onClick={() => void equip({ outfit: item })}
            >
              {item === "scholar" ? (
                <Sparkles size={16} />
              ) : (
                <Shield size={16} />
              )}
              <span>{outfitNames[item]}</span>
              {item === outfit && <Check size={12} />}
            </button>
          ))}
        </div>
        <div className="appearance-options">
          <span>发色</span>
          <button
            disabled={!ready || !isOwner}
            aria-label="月白发色"
            className={`hair-swatch ivory ${!actor || actor.appearance.hair === "ivory" ? "selected" : ""}`}
            onClick={() => void equip({ hair: "ivory" })}
          />
          <button
            disabled={!ready || !isOwner}
            aria-label="墨蓝发色"
            className={`hair-swatch midnight ${actor?.appearance.hair === "midnight" ? "selected" : ""}`}
            onClick={() => void equip({ hair: "midnight" })}
          />
          <label>
            <input
              type="checkbox"
              disabled={!ready || !isOwner}
              checked={actor?.appearance.weapon ?? true}
              onChange={(e) => void equip({ weapon: e.target.checked })}
            />{" "}
            携带法杖
          </label>
        </div>
        <small>行走试产：学者或守卫服／月白发型／收起法杖。其余装束按当前图层展示。</small>
      </div>
      <div className="quick-actions">
        <button
          disabled={!ready || !isOwner}
          onClick={() => void command({ type: "gather", actorId: actor!.id })}
        >
          <Package size={15} />
          采集
        </button>
        <button
          disabled={!ready || !isOwner || actor?.roomId !== "room-0" || actor?.cargo === 0}
          onClick={() => void command({ type: "deliver", actorId: actor!.id })}
        >
          <Package size={15} />
          卸货入库
        </button>
        <button
          disabled={!ready || !isOwner}
          onClick={() => void command({ type: "attack", actorId: actor!.id })}
        >
          <Swords size={15} />
          攻击
        </button>
        <button
          disabled={!ready || !isOwner}
          onClick={() => void command({ type: "capture", actorId: actor!.id })}
        >
          <Flag size={15} />
          编目
        </button>
      </div>
      <div className="doctrine-card">
        <div>
          <ScrollText size={16} />
          <h3>当前行动规则</h3>
          <button aria-label="编辑行动规则" onClick={() => setView("rules")}>
            <ArrowUpRight size={15} />
          </button>
        </div>
        <strong>{player ? presetNames[player.rule.preset] : "尚未发布"}</strong>
        <p>
          {player
            ? `生命低于 ${player.rule.retreatHp}% 时自动撤退。`
            : "在训练局中试验属于你的小队策略。"}
        </p>
        <span>规则驱动，而非繁复微操</span>
      </div>
    </aside>
  );
}
