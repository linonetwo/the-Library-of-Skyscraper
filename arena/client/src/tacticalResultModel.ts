import sealContest from '../../shared/seal-contest-v1.json' with {type:'json'};
import type {Snapshot} from './types';
/** Only formats authority settlement facts; scores never decide the displayed winner. */
export function tacticalResultModel(snapshot:Snapshot,playerId?:string){
 const result=snapshot.result;
 if(!result)return undefined;
 const winnerId=result.winner;
 const participating=snapshot.players.some(player=>player.id===playerId);
 const winnerName=snapshot.players.find(player=>player.id===winnerId)?.name||winnerId;
 const seconds=Math.floor(snapshot.tick*(snapshot.tickDurationMs??sealContest.tickDurationMs)/1000);
 const configuredGoal=snapshot.scenarioConfig?.exclusiveScoreTicks;
 return {
  draw:!winnerId,
  heading:!winnerId?'据点争夺 · 平局':!participating?'据点争夺结束':winnerId===playerId?'据点争夺胜利':'据点争夺失利',
  winnerLabel:winnerId?`${winnerName}${winnerId===playerId?'（本人）':''}`:'平局',
  reason:result.reason,
  scoreGoal:typeof configuredGoal==='number'?configuredGoal:sealContest.exclusiveScoreTicks,
  duration:`${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`,
  players:[...snapshot.players].sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id)).map(player=>({
   id:player.id,name:player.name||player.id,score:player.score,own:player.id===playerId,winner:player.id===winnerId,
  })),
 };
}
