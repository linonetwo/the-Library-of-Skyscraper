# 月白发型行走层制作记录

## 2026-11-05

使用用户指定 `proxy-imagegen` / GPT Image 2。本轮首次调用成功，源图 `walk-hair-ivory.png` 为887×1774 RGBA、2,024,695字节。原提示词保留于 `walk-hair-ivory-prompt.txt`。

设计：月白短层次发，暖米白高光与淡紫灰暗部；前视保留脸部开口，侧视露出面向移动方向的脸，背视为完整层叠发帽。4列对应行走周期的发梢/刘海次级摆动，8行对应 `S SW W NW N NE E SE`。

制作：

1. `source-sprites.mjs` 按格清理灰白杂点、色键污染，提取每格主体连通区域。月白高光通过暖色与紫色的色差保留。
2. `prepare-ivory-walk.mjs` 提供32组头顶/耳线注册坐标，固定身体192×192单元与脚底锚点。源图各帧实际发梢形状保留，按各自注册坐标放置。
3. 短发长度止于耳际，通过一个前发层表达；背向完整发帽同属该层。长发、披发等后续款式拆分后发与前发轨迹。
4. 导出 `walk-hair-ivory.png`、Pixi JSON及来源记录，位置为 `arena/client/public/assets/animation/`。
5. `walk-scholar-ivory-preview.png` 组合32帧身体、学者服、前景摆臂、月白发，用于素材审看。实机截图交由主代理加入当日日报。

图集784×1568；每格192×192，2px留白，锚点(0.5,0.9)。帧键 `walk/hair-ivory/{direction}/{00..03}`。叠层顺序 `body → outfit-scholar → body-front → hair-ivory`。

覆盖状态为 walk/hair-ivory 八方向 prototype。待精修：浅色边缘、高光细点、侧后方与基础体passing朝向的一致性、整体精确三头身。完整四层组合已可预览；法杖、守卫套装、午夜发和其他动作继续制作。

复现：`cd arena/art && npm run build:animation && npm test`。
