import { useEffect, useState } from "react";
import type { Appearance } from "./types";
import { dollThumbnail } from "./dollThumbnail";
export default function PaperDoll({outfit="scholar",hair="ivory",weapon=true,small=false}: Partial<Appearance> & {small?:boolean}) {
 const [image,setImage]=useState("");
 useEffect(()=>{
  let disposed=false;
  void dollThumbnail({outfit,hair,weapon}).then((url)=>{if(!disposed)setImage(url);}).catch((cause)=>{if(!disposed)console.error("角色预览加载失败",cause);});
  return ()=>{disposed=true;};
 },[outfit,hair,weapon]);
 return <div className={`paper-doll layered-preview ${small?"small":""} ${outfit}`}
  aria-label={`${outfit==="scholar"?"学者长袍":"守卫制服"}纸娃娃角色`}>
  {!image && <span role="status" aria-label="角色预览加载中" style={{position:"absolute",left:"35%",top:"70%",width:"30%",height:8,borderRadius:"50%",background:"#0b1c2680"}} />}
  {image && <div style={{width:192,height:192}}><img role="img" src={image} width={192} height={192} alt="同相机角色预览" /></div>}
 </div>;
}
