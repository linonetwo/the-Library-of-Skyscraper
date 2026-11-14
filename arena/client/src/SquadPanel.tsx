import { Feather, Check } from "lucide-react";

import PaperDoll from "./PaperDoll";
import { roleNames } from "./types";

import { useArena, stateName } from "./ArenaWorkspace";

export default function SquadPanel() {
  const { selected, ownActors, selectActor } =
    useArena();

  return (
    <section className="squad-section">
      <div className="panel-title">
        <h3>
          远征小队 <small>EXPEDITION PARTY</small>
        </h3>
        <span>
          {ownActors.length ? `${ownActors.length} 位巡书者` : "等待编队"}
        </span>
      </div>
      <div className="squad-cards">
        {ownActors.length ? (
          ownActors.map((unit, i) => (
            <button
              key={unit.id}
              className={`squad-card ${unit.id === selected ? "selected" : ""}`}
              onClick={() => selectActor(unit.id)}
            >
              <span className="card-number">0{i + 1}</span>
              <PaperDoll
                small
                {...unit.appearance}
              />
              <div>
                <small>{unit.role.toUpperCase()}</small>
                <strong>{roleNames[unit.role]}</strong>
                <span>{stateName(unit.state)}</span>
                <span>携带 {unit.cargo} / {unit.cargoCapacity}</span>
                <div className="health-track">
                  <i
                    style={{
                      width: `${(unit.hp / unit.maxHp) * 100}%`,
                    }}
                  />
                </div>
                <em>
                  {unit.hp} / {unit.maxHp}
                </em>
              </div>
              {unit.id === selected && (
                <Check className="card-check" size={13} />
              )}
            </button>
          ))
        ) : (
          <div className="squad-empty">
            <Feather size={21} />
            <span>
              小队尚未抵达。开启训练远征后，巡书使、采撷师与守卷人将加入你的队伍。
            </span>
          </div>
        )}
      </div>
    </section>
  );
}
