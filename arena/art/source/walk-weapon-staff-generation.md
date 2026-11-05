# 法杖行走层制作记录

## 2026-11-05

使用用户指定 `proxy-imagegen` / GPT Image 2，本轮首次调用成功，退出码0。源图 `walk-weapon-staff.png` 为887×1774 RGBA、604633字节，提示词保留于 `walk-weapon-staff-prompt.txt`。

设计：胡桃木杖身、棕皮握把、古铜月牙笼与青绿宝珠、书纹和小挂穗。32个独立武器姿态，八方向杖首结构、四帧倾角和挂穗各有变化。图像内容仅为法杖。

制作：

1. 复用 `source-sprites.mjs` 清理色键边缘、提取每格法杖主体。
2. `staff-registration.mjs` 记录32组身体右手握点、源图皮握把中心、携带外倾角，以及八方向前后遮挡。
3. 以握把为锚点做刚体转动和缩放，贴合已有行走摆臂。实看首版组合后，增加经过帧外倾角，使杖首移到眼睛外侧。
4. `prepare-staff-walk.mjs` 通过共享注册管线打包完整逻辑层；`staff-layers.mjs` 按方向输出前杖与后杖图集，并生成学者/守卫两套组合预览。
5. 前景手臂沿用身体原像素，压在前杖层上；头发层位于最前。握点、倾角、层序另存 `.attachments.json`。

接口：

- `walk-weapon-staff.{png,json}`：完整32帧逻辑层，键 `walk/weapon-staff/{direction}/{00..03}`。
- `walk-weapon-staff-back.{png,json}`：后杖层，NW/N/NE/E可见，其他方向为透明帧。
- `walk-weapon-staff-front.{png,json}`：前杖层，S/SW/W/SE可见，其他方向为透明帧。
- 两辅助层键分别为 `walk/weapon-staff-back/{direction}/{frame}` 与 `walk/weapon-staff-front/{direction}/{frame}`。
- 图集784×1568，192×192格，2px留白，脚底参考锚点(0.5,0.9)。
- 合成：后杖 → 身体 → 衣装 → 前杖 → 前景手臂 → 头发。

组合预览为 `walk-scholar-staff-preview.png`、`walk-warden-staff-preview.png`。已实看握点、面部遮挡、前后朝向与两套衣装组合，调整经过帧杖首穿脸问题。覆盖记录为 walk/weapon-staff 八方向prototype。

后续美修：专用闭合握杖手势、背向经过帧手腕朝向、杖脚与腿部交叠细节、挂穗边缘。现身体采用通用摆臂，持杖姿势继续定稿；施法起手/释放/收招仍是独立 weapon-staff 动作模块的制作任务。

复现：`cd arena/art && npm run build:animation && npm test`。
