/** Pixel anchors are in the original untrimmed atlas canvas, like groundPivot. */
export type RegisteredPoint = readonly [number, number];
export type DollFrameAnchors = {
  grip: RegisteredPoint;
  staffTip: RegisteredPoint;
  supportPalm?: RegisteredPoint;
  supportFoot?: RegisteredPoint;
};
export type DollAnchorName = keyof DollFrameAnchors;
/** Foot and anchor are already projected points; never project their pixel delta again. */
export function registeredAnchorPoint(foot: {x:number;y:number}, pixel: RegisteredPoint,
  groundPivot: RegisteredPoint, renderScale: number) {
  return {x:foot.x+(pixel[0]-groundPivot[0])*renderScale,
    y:foot.y+(pixel[1]-groundPivot[1])*renderScale};
}
/** Uses the caller's simulation time and exclusive authoritative boundary. */
export function timedPhaseFrame(simTimeMs:number,startTick:number,endTick:number,tickDurationMs:number,
  range:{first:number;last:number}) {
  const start=startTick*tickDurationMs,end=endTick*tickDurationMs;
  if(end<=start||simTimeMs<start||simTimeMs>=end)return undefined;
  return range.first+Math.min(range.last-range.first,
    Math.floor((simTimeMs-start)/(end-start)*(range.last-range.first+1)));
}
