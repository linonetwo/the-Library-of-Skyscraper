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
    selected,
    outfits,
    setOutfits,
    hairs,
    setHairs,
    weapons,
    setWeapons,
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
          hair={actor ? hairs[actor.id] : "ivory"}
          weapon={actor ? weapons[actor.id] !== false : true}
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
      </div>
      <div className="wardrobe">
        <div className="panel-title">
          <h3>纸娃娃装束</h3>
          <small>外观 · 本机保存于当前页面</small>
        </div>
        <div className="outfit-options">
          {(["scholar", "warden"] as Outfit[]).map((item) => (
            <button
              key={item}
              disabled={!actor}
              className={item === outfit ? "selected" : ""}
              onClick={() =>
                actor && setOutfits({ ...outfits, [actor.id]: item })
              }
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
            disabled={!actor}
            aria-label="月白发色"
            className={`hair-swatch ivory ${!actor || !hairs[actor.id] || hairs[actor.id] === "ivory" ? "selected" : ""}`}
            onClick={() => actor && setHairs({ ...hairs, [actor.id]: "ivory" })}
          />
          <button
            disabled={!actor}
            aria-label="墨蓝发色"
            className={`hair-swatch midnight ${actor && hairs[actor.id] === "midnight" ? "selected" : ""}`}
            onClick={() =>
              actor && setHairs({ ...hairs, [actor.id]: "midnight" })
            }
          />
          <label>
            <input
              type="checkbox"
              disabled={!actor}
              checked={actor ? weapons[actor.id] !== false : true}
              onChange={(e) =>
                actor &&
                setWeapons({ ...weapons, [actor.id]: e.target.checked })
              }
            />{" "}
            携带法杖
          </label>
        </div>
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
