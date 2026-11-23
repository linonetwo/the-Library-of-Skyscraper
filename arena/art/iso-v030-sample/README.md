# v0.3.0 同相机纸娃娃样板（未批准）

本目录不替换历史四头源或现有运行时图集。生成器仅接受文本提示，**本次没有上传参考图能力**；风格与几何通过文字合同约束，生成后必须实看并独立复核。

## 第一质量门

- 来源：`../source/iso-v030-body-sample.png`，由用户指定 proxy-imagegen / GPT Image 2 新生成；一旦成功不重复请求同一源。
- 首次SSE中断后第二次成功；原PNG具有真实透明alpha，查看器若忽略alpha会显示隐藏褐色RGB。`source-on-white.png`仅为正确透明合成的检查图。
- 首源的1/3、2/4步态重复，**不通过walk**；当前只取NE/SW单帧用于camera-pose样板，不伪装成完整idle/walk。
- 第一批动作目标为NE/SW各4个交替步态，body与对应帧前臂/手的body-front拆层；当前完成状态见生产矩阵。
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

## 首批世界物件

`build-world-assets.mjs`生成`client/public/assets/iso-v030-world/manifest.json`所列独立资源堆、携带包、NE/SW墨影中立sprite和脚手架前后层。每条记录显式canvas、pivot、anchor、footprint、source crop/scale；runtime按元数据和scale1放置。`build-inkguard-rig.mjs`保留对应方向的头/躯干/臂/下摆/靴切分与关节；墨影完整运动/攻击/受击/倒地仍待制作。

资源堆约1.3×1.0格、0.8m高；手持包40格透明画布中约27px宽，以pelvis/手部contact注册，跟角色pose。施工顺序为back→实际建筑→front，三者共用建筑worldPosition；前后mask仅决定遮挡。敌人中立图共用128×160画布、ground `(64,144)`，高约1.35m。

验证：`node --test iso-v030-sample/world-assets.test.mjs`；实际产品布局与方向显示由前端接入后独立验看。完整八向动作及装备目标见`P3-PRODUCTION-MATRIX.md`。

## 其余六向方向源与比例注册

`iso-v030-body-{ew,ns,nwse}-neutral.png`分别提供两方向中立body及完整左右臂腿。E/W首次请求成功，N/S与NW/SE各一次503后技能自动重试成功；三张源保持原像素。它们的原始比例约5–6头，尚未获四头源批准。

`build-direction-prototypes.mjs`将无发head与body独立等比缩放到192格、可见crown-ground132px的初步注册候选；各源crop、缩放、neck/ground锚和SHA记录于`direction-prototypes/registration.json`。这不是整个人像纵向压缩，也不是正式动作图集。完整臂腿的关节注册、前后拆层、装备适配与产品相机仍待逐项接受。现预览仅用于核对六方向及比例，成功源不重复请求。

## 第二衣装与不同发型轮廓

`build-midnight.mjs`使用一次成功的深蓝黑短束发源，输出独立前后发片；`hair-three-states-preview.png`以同一裸身体对照裸头、ivory短碎发、midnight束发。NE背向的后脑与可见尾束在身体前，SW尾束在身体后，按方向显式分层。源前片与后片之间的选择已记录，未把头皮或脸烘入发片。

`build-warden.mjs`把新深蓝长袖短外套注册为躯干衣、左右上袖/前袖5件，近袖使用`outfit-warden-front`覆盖裸近臂。袖片对齐既有肩/肘/腕，衣装适配的轴向与横向映射比例明确记录；自然手仍来自身体，手腕以下保留可见。第一次请求进程以143退出且无图，后续请求成功一次即停止。两套装备的`equipment-*/attachments.json`供离线工具沿同pose导出；当前静态接缝制作门不等于完整动作与实机接受。

## 六方向完整附件初注册

`build-six-direction-rigs.mjs`输出`attachments-six-directions/rig.json`，每方向12件真实无发头、躯干、左右两段臂、两段腿及靴。统一近竖直腿段24.98637/23.98948px、世界骨长0.318770/0.306052m，站姿髋高0.734822m，运动候选髋高0.66m。方向、左右横轨、足底偏移和可复建source裁片均保留。

新生成完整肢体较原同相机身体偏壮，N/S/NW/SE另有显式`widthFit`厚度注册候选，标记`thicknessFitReviewPending`，未声称全为等比。S方向独立腿的黑色髋帽与躯干轮廓不合，改用同张源左列中立人体中完全可见的左右臂腿裁片；独立肢体原图仍保留。S头片同时清理颈侧误带的服装像素。当前为零变换重组页，近远遮挡、实际动作/装备与接地审阅继续。

## 法杖握持初注册

`build-staff-grip.mjs`复用历史法杖和八向握手源中的NE/SW独立裁片，按新rig真实`rightWrist`重新注册，不沿用旧body挂点。原`right-forearm-hand`被互补切为前臂与自然手；空手显示`hand-front`，握杖显示`hand-grip`，两者互斥。杖轴握点与握手内的掌心接触点对齐，源hash、crop、scale、wrist/grip/pivot均记录，未新增生图请求。`staff-grip-rest-preview.png`只检查静态注册；动作仍需独立持杖腕姿和接触/收招pose。

自然手使用rightWrist位置，并继承rightElbow绝对角以保持与原前臂的连续接缝；握持手和法杖使用明确wrist绝对角。二者的不同角度继承规则写入附件元数据。

`build-hair-directions.mjs`完成其余E/W/N/S/NW/SE两种发型的独立前后片，与NE/SW合计八向源。E/W/N/S两张源首次成功；NW/SE同类四件源第一次进程143无产物，重试成功后保留。源内SE透明面孔开口误带棕色下颌描边，注册脚本仅在指定区域去除该非头发像素，完整源不改。`hair-six-directions-preview.png`显示同一无发身体上切换两种独立轮廓；动作适配和实机仍单独验收。

## 语义动作与落地视角变体

`SEMANTIC-POSE-CONTRACT.md`记录attack/负重/卸货/采集/建设编目/受击/倒地的接触语义与当前制作状态。`build-down-variants.mjs`使用一次成功的独立落地头/躯干源，保留真正卧姿的胸腹透视和无发闭眼头部，不旋转整张站姿人像。

`variants-down/registration.json`显式提案down专用256透明原画布、groundPivot128/204.8、renderScale1；相对192画布只加32px边距，世界尺寸不变，最终运行时接入等待主代理确认。当前只有head/torso两件，世界腿/撑地手、过渡四相和全部衣发还待制作。源、初注册与proposal分开记录，未标倒地动作完成。
