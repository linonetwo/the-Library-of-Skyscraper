# 学者衣装行走层生成记录

## 2026-11-05：32帧衣装完成试产

本轮使用用户指定 `proxy-imagegen` / GPT Image 2，首次调用生成成功，进程退出码0，源PNG为887×1774、755431字节。完整提示词保留于 `walk-outfit-scholar-prompt.txt`，原图保留于 `walk-outfit-scholar.png`。

画面为象牙白/青绿无袖短背心，前扣与背部书纹区分朝向；4列×8行，方向 `S SW W NW N NE E SE`。每格保留独立绘制的衣装形变。

制作流程：

1. 清理生成图的红/黄/紫色键污染，产出 `walk-outfit-scholar-clean.png`。
2. 源图裁切框与身体上的放置框分别管理；身体注册值由 `prepare-scholar-walk.mjs` 的32个手工坐标给出。源图边界提取只影响裁切，实际放置由固定注册坐标决定。
3. `walk-outfit-scholar-registration.json` 记录每帧裁切、放置及来源；独立PNG/Pixi JSON打包到 `/assets/animation/walk-outfit-scholar.*`。
4. 从身体原像素提取可见前臂/手部，生成 `walk-body-front.*`。叠层顺序 `body → outfit-scholar → body-front`，使经过胸前的摆臂显示在衣装前方。
5. 生成 `arena/art/walk-scholar-preview.png` 组合素材表；实机画面由主代理在动画检查台拍摄。

规格：192×192单元、2px留白，图集784×1568，共32帧，脚底参考锚点(0.5,0.9)。帧键 `walk/outfit-scholar/{direction}/{00..03}` 与 `walk/body-front/{direction}/{00..03}`。来源记录置于对应 `.provenance.json`。

实际完成范围为 walk 学者服 prototype。画面已呈现全部方向、逐帧衣装及前景摆臂。待美修项：背心胸廓偏宽、袖口及领口贴合、侧后方向衣装/身体朝向一致性、细碎浅色边缘；基础体的NW/NE passing方向漂移与三头身归一化继续列入身体制作任务。发型、守卫服、法杖和其他动作仍在制作队列。

复现：`cd arena/art && npm run build:animation`。本轮美术测试7项通过。

## 早期生成记录

前一轮连续三次 Responses API HTTP500，退出码1；当时无源图产出。本轮保留原提示词并完成新请求，以上成功源图及打包结果取代前次缺图状态。
