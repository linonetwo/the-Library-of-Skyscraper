import type {TacticalActorSnapshot,TacticalEvent} from '../../shared/tactical';
import type {RegisteredClip} from './animationCatalog';
import {timedPhaseFrame} from './registeredAnchors.ts';
/** Each authority interval has its own frame range on the same simulation clock. */
export function sampleCast(state:TacticalActorSnapshot|undefined,simTimeMs:number,tickMs:number,ranges?:RegisteredClip["phaseFrames"]){
 const cast=state?.weapon==='staff'?state.cast:undefined;
 if(!cast)return undefined;
 const chanting=timedPhaseFrame(simTimeMs,cast.startedTick,cast.releaseTick,tickMs,ranges?.chanting??{first:0,last:2});
 if(chanting!==undefined)return {frame:chanting,phase:'chanting' as const};
 const recoveryTick=Math.min(cast.releaseTick+1,cast.endsTick); // Rust view: release lasts exactly one tick.
 const release=timedPhaseFrame(simTimeMs,cast.releaseTick,recoveryTick,tickMs,ranges?.release??{first:3,last:4});
 if(release!==undefined)return {frame:release,phase:'release' as const};
 const frame=timedPhaseFrame(simTimeMs,recoveryTick,cast.endsTick,tickMs,ranges?.recovery??{first:5,last:7});
 return frame===undefined?undefined:{frame,phase:'recovery' as const};
}
/** Only an authority-confirmed damaging release carries its historical ground position. */
export function inkRelease(event:TacticalEvent|undefined){
 return event?.action==='cast'&&event.phase==='released'&&event.targetPosition?event.targetPosition:undefined;
}
