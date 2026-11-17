import { useEffect, useState } from "react";
import { animationFrame } from "./animationCatalog";
import type { Appearance } from "./types";
import { AnimatedDollPreview, type AnimationAtlas } from "./AnimatedDollPreview";
import { animationLayerNames, animationLayers } from "./walkLayers";

const idleAtlases = Promise.all(animationLayerNames.idle.map(async layer => {
  const response = await fetch(`/assets/animation/idle-${layer}.json`);
  return [layer, await response.json()] as const;
})).then(entries => Object.fromEntries(entries));

export default function PaperDoll({outfit="scholar",hair="ivory",weapon=true,small=false}: Partial<Appearance> & {small?:boolean}) {
 const [frame,setFrame]=useState(0);
 useEffect(()=>{ const timer=window.setInterval(()=>setFrame(animationFrame("idle",performance.now())),250); return ()=>window.clearInterval(timer); },[]);
 const [atlases,setAtlases]=useState<Record<string,AnimationAtlas>>();
 useEffect(()=>{ void idleAtlases.then(setAtlases); },[]);
 return <div className={`paper-doll layered-preview ${small?"small":""} ${outfit}`}
  aria-label={`${outfit==="scholar"?"学者长袍":"守卫制服"}纸娃娃角色`}>
  {atlases && <AnimatedDollPreview action="idle" atlases={atlases}
   layers={animationLayers("idle",{outfit,hair,weapon})} direction="S" frame={frame} />}
 </div>;
}
