import type {AssetSetIndex} from './assetSetLoader';
/** A map needs the normal fallback clips even when a workshop study contains only new actions. */
export function mapStudyIndex(main:AssetSetIndex,study:AssetSetIndex):AssetSetIndex{
 return {assetSetId:`${main.assetSetId}+${study.assetSetId}`,
  clips:[...new Map([...main.clips,...study.clips].map(clip=>[clip.action,clip])).values()]};
}
