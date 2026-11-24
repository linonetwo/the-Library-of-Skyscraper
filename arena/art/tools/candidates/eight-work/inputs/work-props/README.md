# 工作与运输 · 六向道具源

补 N/NW/W 与 S/SE/E 六个独立视图，NE/SW 继续使用原成功道具，不镜像、不重复请求。四列分别为纸材、小木槌、开册和皮带捆扎文书包；两个纸类物体的阅读轴、双掌捆包的前沿、槌头的近端均随朝向变化，不能用同一固定屏幕图替代。每行由同一高位等距相机绘制。图源不是运行时 atlas。

`source/work-props-{front,back}.png` 与对应提示保留，使用指定的 proxy-imagegen。`node register.mjs` 从 alpha 邻接域恢复原裁区，按同一比例缩到真实投影的产品尺寸。`surface-points.json` 是在宽 990 的等比预览上人工选取的实物表面点（原分辨率坐标也写入 manifest）。所有点再次检查缩至产品尺寸后的 alpha。

`manifest.json` 的 `contacts` 均是**缩图局部像素坐标**；角色的左/右不是屏幕的左/右。`pivot` 就是主接触点，不是图像几何中心。相对 manifest 读取 `image`。

| 物件 | 主接触 | 副接触 |
| --- | --- | --- |
| paper | `rightPalm`，纸堆近缘 | collect 第 1、2 相 |
| mallet | `rightGrip`，木柄下段 | `strikeFace` 标击面 |
| folio | `leftPalmSpine`，近阅读者的书脊端 | `rightPageEdge` 按页外沿；`gutterCenter` 标中缝 |
| cargo | `actorLeftPalm` | `actorRightPalm`；侧视两个支撑面在屏幕深度方向错开 |

只交付源、尺标和锚点，不代表双掌 IK 与产品实播通过。工作动作连续接触页由动作组用相同文件复烘。
