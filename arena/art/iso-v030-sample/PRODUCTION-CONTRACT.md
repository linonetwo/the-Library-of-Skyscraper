# 同方向分肢 → 统一pose → 离线14层图集

状态：root与技术设计Astra已选择此路线；当前仅两向相机静态样板，尚非动作交付。

1. 每个方向拥有独立源与attachment，不旋转/镜像一张人物冒充八向。保留相机yaw45/elevation30、四头解剖、世界足点和192格。新增暴露面须新绘/生成，不用透视拉伸掩盖。
2. 美术提供torso、head、左右上臂/前臂/手、左右大腿/小腿/靴，以及服装/头发/武器attachment；标记肩/肘/腕/髋/膝/踝、contact heel/toe、重心、近远肢与跨身遮挡。原始源与切分mask可追溯。
3. 共用语义pose：左右腿严格半周期反相、对侧摆臂、支撑脚world-space锁定、重心起伏、转向近远关系。身体与衣发使用同一pose时钟，衣摆/发梢延迟是attachment局部规则，禁止各外观独立猜步态。
4. Sol离线工具按pose驱动2D分肢或低多边形网格，处理关节覆盖/轮廓修补，再输出既有14层PNG atlas、registration与provenance。运行时继续现有sprite层组合，不新增骨骼运行框架。
5. 图集顺序维持staff-back → hair-back → body → outfit → staff-front → body-front → grip → hair-front。武器不得左右镜像；前后层可按每帧真实遮挡拆分。
6. 首门仅NE/SW、一套衣发、冻结pose，产品ActorView/isoGeometry真实3×3tile+u/v+讲台遮挡；次门是8格1.5m/s且脚底不滑的完整交替walk；再扩8向与外观。
7. 最低玩法美术另含采集/携带运输/卸货、受击、独立倒地姿态、墨影敌人状态、目标/工地/资源态。90°旋转站立图与Graphics敌人只属联调占位，不能作发布验收。

首源说明：真正alpha透明；图像查看器若忽略alpha会显出隐藏褐色RGB。1/3及2/4相位重复，因此原整帧源不得被标walk通过。成功源仅生成一次（首次SSE中断后的第二次请求成功），保留原文件，不继续用整套外观帧生成碰运气。
