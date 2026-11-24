# 玩家八向战斗 · 卧地分层源

攻击与受击复用 eight-base 已登记骨架，NE/SW 优先保留已烘成功的战斗图。此处只生产必须独立绘制的**着地朝向面**，不是八张完整人物或把站姿整图旋转。

`grounded/manifest.json` 提供八向各 8 件：无发头、基础身、学者衣、守卫衣、象牙短发前/后、墨蓝束发前/后。256 方格、缩放 1、地面枢轴 `[128,204.8]`。所有 `image` 均相对此 manifest。`hip/neck/crown` 为屏幕骨点，`shoulderWorld` 为世界空间左右肩。落地屏幕连线（髋/颈/颅顶）不代表球形头部的可见厚度；N/S 视角额外保留颅顶圆度。

NE/SW 已有成功头身、两衣两发模块无重绘；`source/legacy` 保留原登记以及仓库此前缺少的头发/服装成功原图与提示。原头身源在 `arena/art/source/iso-v030-down-head-torso-ne-sw.png`。

另六向由指定 proxy-imagegen 独立绘制 N/W/NW 与 S/E/SE 两张 3×6 分件表，两次请求均成功；`source/grounded-template.txt` 和 `source/generate.sh` 保留原完整提示和方位排列。不要再生成已有图。`source/landmarks.mjs` 为源像素实测关节和裁区（960 宽等比观察坐标）。发帽在地面支持面拆分，马尾和近颊边分属可单独启闭的层；裸头不烘入任何头发。服装没有捆绑武器或人物底色。

在 `arena/art` 安装现有依赖后运行 `node tools/candidates/eight-combat/register-grounded.mjs` 可重建全部新方向及统一索引。独立姿态工具将屈膝/撑手两相与半侧落髋/最终松手两相结合；二按部位替换而手臂、靴与杖仍由独立关节驱动。本提交不修改客户端、公共烘图工具或运行时资源。

验过八向着地层的裸头/裸身和穿戴组合，并复看 E/W 从屈膝到撑掌、再到落肩和最后松手。该验收是来源与离线静态姿态检查，不声称玩家实战路径已经接入。
