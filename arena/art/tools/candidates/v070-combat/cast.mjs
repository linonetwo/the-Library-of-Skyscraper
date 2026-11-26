/** Eight deliberately authored chant / point / settle poses; no new world movement. */
export function castPoses(direction){
 const heading=direction.worldForward,forward=[64*(heading[0]-heading[1]),32*(heading[0]+heading[1])],size=Math.hypot(...forward),u=forward.map(v=>v/size);
 const release=(Math.atan2(u[1],u[0])*180/Math.PI+90);
 const extension=[-4,-6,0,10,9,6,2,0],lift=[-6,-12,-15,-12,-10,-6,-2,0],wind=u[0]>0?24:-24;
 const angles=[wind,wind*.65,release*.65,release,release,release*.65,wind*.5,0];
 return extension.map((reach,frame)=>{
  const wristTargets={};
  for(const side of ['left','right']){
   const shoulder=direction.joints[side+'Shoulder'].cell,wrist=direction.joints[side+'Wrist'].cell,elbow=direction.joints[side+'Elbow'].cell;
   const cross=(wrist[0]-shoulder[0])*(elbow[1]-shoulder[1])-(wrist[1]-shoulder[1])*(elbow[0]-shoulder[0]);
   const target=[wrist[0]+u[0]*(side==='right'?reach:reach*.35),wrist[1]+u[1]*(side==='right'?reach:reach*.35)+lift[frame]];
   const distance=Math.hypot(target[0]-shoulder[0],target[1]-shoulder[1]),length=Math.hypot(...direction.joints[side+'Elbow'].restOffset)+Math.hypot(...direction.joints[side+'Wrist'].restOffset);
   if(distance>length+.01)throw Error(`Cast unreachable ${side}/${frame}: ${distance}/${length}`);
   wristTargets[side+'Wrist']={point:target,bend:cross>=0?1:-1};
  }
  return{durationMs:125,joints:{},wristTargets,rootScreenDelta:[0,0],attachmentAngles:{staff:angles[frame],'right-hand-grip':angles[frame]},supportContacts:{phase:frame<=2?'chanting':frame<=4?'release':'recovery',feet:['left','right']}};
 });
}
