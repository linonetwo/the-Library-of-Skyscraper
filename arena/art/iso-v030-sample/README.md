# v0.3.0 同相机纸娃娃样板（未批准）

本目录不替换历史四头源或现有运行时图集。生成器仅接受文本提示，**本次没有上传参考图能力**；风格与几何通过文字合同约束，生成后必须实看并独立复核。

## 第一质量门

- 来源：`../source/iso-v030-body-sample.png`，由用户指定 proxy-imagegen / GPT Image 2 新生成；一旦成功不重复请求同一源。
- 首次SSE中断后第二次成功；原PNG具有真实透明alpha，查看器若忽略alpha会显示隐藏褐色RGB。`source-on-white.png`仅为正确透明合成的检查图。
- 首源的1/3、2/4步态重复，**不通过walk**；当前只取NE/SW单帧用于camera-pose样板，不伪装成完整idle/walk。
- 仅NE/SW各4个真实步态，body与对应帧前臂/手的body-front拆层；不能用旧平视图纵向挤压。
- 四头解剖、正交yaw45°/elevation30°；`X=64(x-y), Y=32(x+y)-78.3837z`，1格=1m，tile128×64。
- 人高1.7m（垂直投影133.25px），保留192×192透明格与ground pivot `(96,172.8)`。此高度不包含头部水平深度带来的投影包围盒增量。
- 注册后角色约131–133px crown-to-ground，产品样板`renderScale=1`；不能将整张192透明画布缩成136px。原始源的等比缩放只做一次，attachment里的`sourceScale`仅溯源。
- 先3×3独立tile、u/v书架各1、讲台1、角色前后绕行与8格1.5m/s走道。现道具可复用但注册与尺寸须显式记录。
- 新源、分层、注册、场景截图均为prototype / releaseApproved:false，独立评审通过后才扩8方向、14层、2服装×2发色×武器开关及动作集。
- 后续最低动作/状态包括采集、携带运输、入库、受击、倒地；不得用idle完整人像表示死亡。

## 分层顺序目标

`weapon-staff-back → hair-back → body → outfit → weapon-staff-front → body-front → hand-grip → hair-front`

样板阶段只启用body、body-front，所有层共用同帧注册；先证明相机/四头/足点，再量产外观。完整14层目标与原源保持不变。

## 独立装备与完整肢体追加

`build-equipment.mjs`把成功一次的新scholar/ivory源注册为独立衣、前发、后发；领口显式透明开口，未将整个人像作为替代。`build-complete-attachments.mjs`使用另一张成功一次的完整伸展臂腿源，输出`attachments-complete/rig.json`及两向各15个附件（身体12件+衣发3件）；原`attachments/`真实短腿源保留用于追溯，不拉伸。

新完整双腿每方向的thigh/shin长度一致；髋关节位于原“crotch”参考点上10px、躯干遮挡内。头/躯干不变，肢体仅等比缩放，近远顺序和脚接触待离线pose工具与实机复核。`complete-limbs-rest-preview.png`只是zero-transform注册查看，不是walk通过。

验证：`node --test iso-v030-sample/sample.test.mjs`。它检查画布/可见高度单位、独立层keys、裁边、无重复缩放、左右完整骨长一致；不替代视觉验画。
