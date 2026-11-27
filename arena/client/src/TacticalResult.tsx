import type {Snapshot} from './types';
import {tacticalResultModel} from './tacticalResultModel';
export default function TacticalResult({snapshot,playerId}:{snapshot:Snapshot;playerId?:string}){
 const result=tacticalResultModel(snapshot,playerId);
 if(!result)return null;
 return <>
  <span className="eyebrow">据点争夺 · 结算</span>
  <h2>{result.heading}</h2>
  <p>{result.draw?'本局平局，无单独胜方':`获胜方：${result.winnerLabel}`}</p>
  <ol className="tactical-scoreboard" aria-label="最终积分">
   {result.players.map(player=><li key={player.id} className={player.winner?'score-winner':undefined}>
    <span>{player.name}{player.own&&<small>本人</small>}{player.winner&&<small>胜方</small>}</span>
    <strong>{player.score}<small>分</small></strong>
   </li>)}
  </ol>
  <p>胜利条件：率先累计独占据点 {result.scoreGoal} 拍；超时比较积分。</p>
  <p className="tactical-result-reason">{result.reason}</p>
  <p>比赛时长 <b>{result.duration}</b>（游戏时间）</p>
 </>;
}
