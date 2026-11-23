# 墨影守卫 · 八向动作美术源

候选范围：八个独立方向（不镜像）和 idle / walk / attack / hit / down 五动作；本目录只交付美术源、注册与两向模板证据，不修改客户端或服务端。产品挂载与实播验收另行执行。

| 输入 | 原始绘制与注册 |
| --- | --- |
| NE、SW 站姿 | 复用原 9 件中立体与新源 `source/inkguard-complete-legs.png`；拆上下腿和靴，清理躯干旧臂残丝并为接缝补重叠像素。原中立参见 `../source/iso-v030-inkguard-neutral.png`。 |
| N、NW、W 与 S、SE、E 站姿 | `source/inkguard-six-parts-{back,front}.png` 各有 21 件独立绘制；source 内完整臂/腿按关节拆分，注册后每朝向 13 块。`six/standing-rig.json` 含骨架、前向、远近层和腕目标。 |
| 八向倒地 | 两向原始屈膝→撑地→侧卧图及六向新姿势图保留在 `source/`。每相分为头罩、撑臂、其余身体三个互补表面，按原图落脚/撑地接触配准，不旋转站姿冒充倒地。两向着地服色经墨紫分级，保留金属与眼睛。 |

相机 128×64 等距地砖/yaw45°/elevation30°。普通格 192/pivot [96,172.8]；倒地 256/[128,204.8]，renderScale=1。墨影身高1.35，腿长 .265/.255、髋 .54、踝 .10、轨宽 .16。步行16×45ms，stride=1.08，speed=1.5。原地腕目标用独立关节求解，脚用相同世界比例的 standing 链。

已有 proxy-imagegen 成功源及提示词均保留，无需再次调用生图服务。`source/generate-six.sh` 记录六向提示的行顺序；`six/source-registration.json` 含原图 SHA、各件裁切/尺寸/锚点、每个倒地接触像素。安装仓库 `arena/art` 既有依赖后依次运行：

```sh
cd arena/art/iso-v030-enemy
node register-neutral.mjs && node register-legs.mjs && node register-actions.mjs
node register-down.mjs && node register-six.mjs
node bake-eight.mjs "$PWD" /tmp/inkguard-eight-baked
```

`bake-eight.mjs` 由独立工具 PR65 提供。每动作 baked 输出含 contact-sheet、debug、GIF、atlas-budget、trim/pivot 及报告。八向最终离线烘焙有32/128/32/16/32相，walk 128接触帧数值报告最大锁脚误差0。静止动作不执行这项步态审计。上述不是产品运行时通过声明。
