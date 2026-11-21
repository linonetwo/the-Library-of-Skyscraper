# v0.3 纸娃娃动作运行时合同

状态：主代理接受 Astra 的动作语义与分层实施设计，Sol 分域实施。沿用 sprite atlas、权威任务/旅行与模拟时钟；PR45 为已合入基线。16相位 NE/SW 仍为待实播接受的视觉候选，全方向完整动作继续逐项制作。

## 单一选片与取帧

客户端一个纯函数 `resolveAnimation(actor, simTimeMs, motion) -> {clip, frame, direction}`；ActorView 只负责定位、选层及换纹理。`motion` 使用既有权威位置插值结果，动作函数只消费移动状态/路程，不另行规划移动。

| 优先级 | 权威条件 | clip / 播放 |
| --- | --- | --- |
| 1 | HP=0 / downed | `down`：一次播放后保持末帧 |
| 2 | 有效 attack cue | `attack`：一次，朝向 cue.targetPosition |
| 3 | 有效 deliver cue | `unload`：一次；cargo 已归零仍播完有效 cue |
| 4 | 有效 impactCue，且无上述主动动作 | `hit`：一次；位置继续服从权威移动 |
| 5 | 实际在移动，包括房内 approach | cargo>0 用 `carry`，否则 `walk` |
| 6 | 有效 gather cue、实际施工或编目工作阶段 | `collect` / `build-catalog` |
| 7 | 其余 | `idle`；有货时保留藏材挂件 |

工作中的移动优先于旧工作 cue，避免采完离开仍挥工具。排队/blocked/等资源使用 idle，不展示正在施工。`carry` 是负重行走姿态，静止负重由 idle 加挂件表达；藏材挂件沿同 pose 注册，在 unload 时根据 cue 保留到卸货接触帧。敌人也消费同一选片/时间约定，使用自己的贴图集合。

目录每 clip 声明 `{frameCount, frameDurationsMs, playback: loop|once|holdLast, layers, groundPivot, renderScale}`；等时动作可用 `frameMs` 简写，walk/carry 另声明 `cycleWorldStride`，unload 声明藏材离手的 `releaseFrame`。八方向与各帧共用地面锚，192 是透明画布，样板 renderScale=1；素材采用自己的已注册参数。

一处纯取帧函数将时长数组累加为边界，选择当前时间所在的半开区间；一次动作先将 cue 的模拟时长比例映射到素材总时长，再查累计边界，末尾钳到末帧；循环动作取模后同样查表。这样起手/接触/收招可以不等时，目录只描述时长与帧，不增加事件脚本。工作循环以权威工作开始 tick 为锚；相同任务连续 tick 保持锚，任务/阶段重新进入时更新。

只使用一个随快照推进、最多外推一个 tick 的 `simTimeMs`，暂停冻结，回放拖动直接按目标时间求解；新 session 重置时间原点。有效 cue 区间为 `[startedTick, startedTick+durationTicks)`。down 的 durationTicks=0 表示终态，使用该 clip 的素材时长播放后保持；旧数据缺 down cue 时直接显示末帧。各 cue 重复到达不会重启动画。

walk/carry 相位以实体累计 `motionDistanceMilli / 1000 / cycleWorldStride` 求模；共享移动执行点按实际位移累加，静止保持。该快照字段覆盖 travel 和房内 approach，存档/回放保留，旧数据默认 0；客户端按与位置相同的快照插值比例插值距离。每次移动恢复上次步相，换行走方向保持相位。这样变速/暂停/回放使用同一规律；180ms 步频候选对应 1.5m/s、0.72s 一周期、1.08m 周期步幅。idle 用模拟时间循环。

实体同时保存 `lastMoveDirection: {x,y}`，表示最后非零世界位移向量（方向用途，不要求单位长度）。共享移动执行点仅在真实位移时更新，停住保留；旧数据默认 `{x:1,y:1}`，按当前投影为屏幕 S。活动 attack/工作 cue 的 target 覆盖表现朝向；其余包括 hit/down 使用该持久方向。回放随机 seek 直接消费当前快照，即使停住多 tick 也能确定朝向，不回扫历史。该字段与 motionDistanceMilli 同时纳入 Actor/Enemy 存档及回放；迁移沿既有旧字段比较规则处理。

## 权威 cue：同 tick 的明确结果

当前 combat 中“先受击后攻击”会覆盖同 tick hit；简单改成 hit 优先，又会令每 4 tick 同步对打的敌人始终只播受击。服务端保留两份小信息，客户端仍只选一个主 clip：

- `actionCue` 保存 attack/deliver/gather/build/catalog 主动动作；新增可空 `impactCue` 复用 cue DTO，保存 hit/down、受击 tick 和来源坐标。各自写入对应信息，受击不会覆盖主动动作。旧 checkpoint 的 impactCue 默认 null，读取旧 actionCue.hit/down 时映射到 impact 信息。
- HP=0 优先进入 down，起点取 impactCue.down.startedTick。存活且主动动作有效时保留 attack/unload 主 clip，并按 impactCue 的模拟时间显示短受击 tint；主动动作空档才使用 hit clip。持续工作可被 hit clip 短暂打断，随后按原阶段时间恢复。
- 同 tick 多次命中保持首个 hit 起点/来源，最后一次致死命中升级为 down；HP/伤害仍按实际全部结算。主动动作同 tick 冲突按 attack > deliver > 工作确定主表现。双方同步攻击必须同时保留各自 attack 与 impact，动画结果不依赖二者写入顺序。
- gather→collect、deliver→unload 是客户端唯一命名映射；build/catalog 共用 build-catalog clip。持续工作通过实际任务阶段和 Task.stageStartedTick 表达；阶段改变时设置，重复写相同阶段时保留，旧数据默认 0。

## 衣装、手与前后层

沿用现有资产命名，新增真实内容层，不受历史 14 层数量约束。默认由后至前：

`weapon-back → hair-back → body → outfit → weapon-front → body-front → outfit-front → hand-front 或 hand-grip → hair-front`

`outfit` 含躯干衣与后侧袖；新增 `outfit-<id>-front` 是近侧袖/衣摆，覆盖共用裸近臂，袖口透明露手。`body-front` 保留近臂；自然手 `hand-front` 与握持手 `hand-grip` 互斥。握持动作由素材定义，weapon 开关决定是否显示道具；完整手掌不会重复叠两份。特定动作确需遮挡变化时，目录提供该 clip/方向的固定层序，保持一个选层入口。

所有衣发、工具、挂件沿同 pose 独立导出；共用裸身体保留服装无关轮廓。旧 atlas 走原层序兼容，新 clip 按新声明一次接入。目录只登记完整可用的素材集合；候选缺片清单单独可见，发布验收逐项核对完整动作与八方向。

艺术已确认近袖独立生产可行：warden 为明显长袖短外套、分叉衣摆，两向独立前后袖/躯干衣。第二发型采用深色短马尾/侧束发独立轮廓，前后层独立制作。

## 有界实施与验收

- 艺术：确认近袖/自然手分层与八向 clip 清单，先 warden 长袖 + scholar 各一组同 pose 检查袖口、握把与前后遮挡。
- 服务端 Sol：分离 action/impact 写入；新增 motionDistanceMilli、lastMoveDirection 与 Task.stageStartedTick 小字段，复用共享移动/阶段切换点，补双方 4 tick 同步 attack+hit、致死 down、unload cargo=0、阶段开始锚、静止多 tick 后回放方向及旧 checkpoint 默认值用例。
- 客户端 Sol：目录、纯 resolveAnimation、单一选层函数；移除新动作的墙钟闪烁/旋转立绘占位。复用实际产品 renderer。
- 验收：暂停与恢复帧稳定；回放前后拖动同时间同帧；倒地末帧保持；同 tick 优先级不依调用先后；负重移动→卸货→空手连续；长袖不露裸前臂、手与杖接触正确。路程锁足同时检查帧间和循环接缝，离散数值零误差与自然步态分别记录。

步频与采样密度分开：四个关键 pose 表示一个左右循环，atlas 可烘焙更多中间相位。当前四帧保持、连续移动会在 125ms 内移动约 13.4 屏幕像素；180ms 为约 19.3 像素。180ms 对比只判断节奏/步幅，不等于连续锁足达标；后续保持同一周期和世界速度增加烘焙相位，按实播脚漂决定密度。

## 走路生产增补：720ms / 16 相位候选

唯一新增对比为 **16 帧 × 45ms = 720ms**，速度 1.5 world/s，周期步幅 1.08 world，两步/周期（每步 0.54 world）。四个关键 pose 留作美术控制点，旧四帧产物保留为历史 prototype。此次先 NE/SW，同一参数用于普通 walk；负重 carry 后续独立姿态沿同一位移合同制作。

### 离线烘焙与产品播放

- 相位 `i=0..15`，时间 `i×45ms`；NE rootScreenDelta=`[4.32i,-2.16i]`，SW 取反；周期闭合点为 NE `[69.12,-34.56]`。renderScale=1，源关节长度与纸娃娃注册保持不变。
- 工具先在美术确认的四关键 pose 间作周期插值：关节角走短弧、位置/腕目标平滑插值，再对每个生成相位重新求支撑脚 world anchor 的两段腿 IK。每半周期切一次支撑脚，沿用已确认的方向 knee bend；摆动脚沿独立足轨和抬脚弧求解。支撑脚目标按 `plantWorld-rootScreenDelta` 回到角色局部坐标；逐帧重新锁定同一个地面点，不插值已经烘焙的图片或最终腿角。
- 循环接缝按连续第 16 相位检查：root 前进完整周期后与下一周期第 0 相位连接；报告各相位可达性、足底误差、支撑切换和接缝误差。插值出现不可达时回交美术调整目标，不改变骨长掩盖。
- 客户端从目录读取 frameCount/frameMs/cycleWorldStride，以插值后的累计权威路程选帧。样板用同一个产品 ActorView，演示路程 12 world / 8 秒，帧相位由同一路程驱动，NE/SW 分别直行；固定相机、缩放与装备。样板展示不改权威游戏速度。
- 16 帧的 frame-hold 位移上界约 `sqrt(4.32²+2.16²)=4.83` 屏幕像素（100%缩放）。12 帧约 6.44px，故本批选16而不同时试两套。这个值是采样残余，不称连续零滑步；独立查看全速8秒、接缝和近景脚廓，仍可见明显锯齿滑步时再评采样密度。

### 图集与 GPU 预算

每 action / 实际内容 layer 输出可装入 Pixi 的 atlas；按每帧 alpha 包围盒 trim，保留 `orig=192×192`、`trim.x/y/w/h`、原 groundPivot 与统一 renderScale。ActorView 使用原尺寸锚，不按裁切后纹理高重新缩放。裁片预留 2px 透明边/边缘挤出防采样串色，先不旋转裁片。真正空的帧只引用共享透明 texel，整层为空时不导出该层图集，目录记录实际 active layers。

不裁切时，8向×16帧×192²×RGBA8 = **18MiB / layer**；NE/SW 两向为 **4.5MiB / layer**，例如8个实际层扩八向是144MiB，仅此一个动作。若平均有效框约80×144，八向16帧原始像素约5.63MiB/layer，但排布空隙、边缘和页尺寸另计；这个例子不作为实际压缩保证。

工具随产物列出 atlas 页尺寸与 `Σ(width×height×4)` 的解码显存估算、源帧数/非空帧数、trim 前后像素量、active layers、方向覆盖。PNG 文件大小独立报告；若开启 mipmap，另计约4/3系数。先用 tight packing 多页上限2048，按实际输出核算，避免每层补满大方图。样板只加载当前动作/衣发需要的层，正式目录复用已有纹理缓存，完整动作与八向扩展前汇总预算。

### 分工与本批交付

艺术 Astra 冻结自然垂臂与近远腿足轨四关键 pose；工具 Sol 在新候选目录实现16相位重采样/逐相IK、trim atlas及报告；客户端 Sol 仅接产品样板目录参数与正确 trim 锚，输出两向8秒实播。先检查袖口/握把/足点注册、相位接缝、可辨自然步态与实际资源预算，再扩八向；本批不修改 PR45 或替换正式动作目录。
