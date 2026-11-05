# 守卫服行走层制作记录

## 2026-11-05

使用用户指定 `proxy-imagegen` / GPT Image 2。首次请求HTTP503，技能按默认重试策略发起第二次请求并成功，退出码0。源PNG `walk-outfit-warden.png` 为887×1774 RGBA、651193字节；完整提示词保留于 `walk-outfit-warden-prompt.txt`。

设计为深红皮甲、棕色分片护腰、紧凑铜肩片；前胸铜扣与背部书纹区分朝向。4列为左右迈步及经过姿态，8行为 `S SW W NW N NE E SE`；每格拥有独立胸廓扭转、肩线与下摆形变。

制作过程：

1. 复用 `source-sprites.mjs` 清理色键边缘并按格提取衣装主体。
2. `prepare-warden-walk.mjs` 沿学者服身体注册扩展肩片和护腰尺寸，保留32组独立放置坐标。
3. 新提取 `registered-layer.mjs` 管理独立图层打包、来源与coverage写入；月白发与守卫服共用该模块。每种素材的生成、清理、定位由自己的小脚本描述。
4. 输出 `walk-outfit-warden.{png,json,provenance.json}`，并复用 `walk-body-front` 保持胸前摆臂遮挡。
5. 输出 `arena/art/walk-warden-ivory-preview.png`，展示身体→守卫服→前景手臂→月白发完整组合。

图集784×1568、192×192单元、2px留白、脚底锚点(0.5,0.9)。帧键 `walk/outfit-warden/{direction}/{00..03}`。源裁切和放置记录为 `walk-outfit-warden-registration.json`。

当前 walk 守卫服8方向均为prototype。肩片与手臂交接、侧后方向匹配、边缘细节继续精修；基础体方向漂移与精确三头身沿用身体制作任务。午夜发、法杖和其他动作进入下一制作批次。

复现：`cd arena/art && npm run build:animation && npm test`。
