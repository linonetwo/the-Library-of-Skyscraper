# 学者衣装行走层生成记录

状态：**生成失败，无源位图，不构成动画覆盖**。

- 请求：使用 `proxy-imagegen/scripts/generate.sh`，指定 GPT Image 2；提示词完整保存在 `walk-outfit-scholar-prompt.txt`。
- 结果：连续三次 Responses API HTTP 500，进程退出码 1；没有最终 PNG，不记录虚构的图片来源哈希。
- 没有更换供应商、没有无上限重试、没有使用静态正面衣装填充八方向。
- 目标：象牙白/青绿短款无袖学者背心，前扣/背部书纹区别方向；32帧全部衣装独立透明，头、手、腿空白。
- 当前源基础体自身 NW/NE passing 帧有方向漂移；衣装完成也不会自动解除基础体验收缺陷。

## 已实现技术准备

`equipment-pipeline.mjs` 接受人工审核的32个 crop/placement 注册，不按不透明包围盒自动居中、不镜像、不合成步态。输出独立 PNG、Pixi JSON、来源/提示词/注册表/输出哈希记录，192×192、2px留白、脚底锚点(0.5,0.9)。短背心顶端66px及145px以下禁止不透明像素，空帧/重复帧/缺失方向/错误尺寸或哈希全部拒绝。技术检查成功也只能是 prototype，不能更新 releaseApproved。

配方字段：`schemaVersion:1, action:"walk", layer:"outfit-scholar", source, prompt, sourceSha256, promptSha256, sourceSize:[width,height], frames:[{name:"walk/outfit-scholar/S/00",crop:{x,y,w,h},placement:{x,y,w,h}}, ...]`。source/prompt 路径相对于配方文件。图像成功生成并完成逐帧定位之后，才创建真实配方；不提前伪造尺寸或哈希。

运行：`node build-equipment.mjs <reviewed-registration.json> <output-directory>`；测试 `node --test equipment.test.mjs`。合成测试纹理只在内存内验证管线，不写入游戏资产。

仍需：成功源图、实际透明清理、32帧逐一身体对齐/手遮挡审查、八向播放审查、实机截图、coverage登记。以上全部尚未完成。
