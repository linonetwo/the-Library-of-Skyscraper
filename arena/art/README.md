# 竞技场美术管线

`source/library-map.png` 与 `source/doll-sheet.png` 使用用户指定的 proxy-imagegen / GPT Image 2 生成。原图保留，不能用程序画图或概念图冒充游戏截图。

运行 `npm ci && npm run build`：色键透明化、独立图层对齐、2px 边缘留白、标准 Pixi 图集及 SHA-256 来源清单生成至 `../client/public/assets/`。贴图为 PNG，不依赖运行时生成服务。

图层统一虚拟画布，顺序为 body → outfit → hair → weapon。衣装与发型组合只影响外观，不改变竞技数值。图集坐标、对齐修正和内容版本均受版本控制。生成式素材仍需进一步人工美术审查和发布权利审查；模型输出不保证完美层间兼容。

八向动画走独立试产管线：`npm run build:animation`。范围和制作队列见 [ANIMATION-PLAN.md](ANIMATION-PLAN.md)，覆盖矩阵位于 `../client/public/assets/animation/coverage.json`。当前 walk 包含32帧身体、学者服、守卫服、月白发与前景手臂，状态 prototype。组合素材预览为 `walk-scholar-ivory-preview.png` 和 `walk-warden-ivory-preview.png`，制作记录分别为 [学者服](source/walk-outfit-scholar-generation.md)、[守卫服](source/walk-outfit-warden-generation.md)、[月白发](source/walk-hair-ivory-generation.md)。

行走法杖另有32帧完整逻辑层、按朝向拆分的前/后杖层和逐帧握点轨迹。持杖组合预览为 `walk-scholar-staff-preview.png`、`walk-warden-staff-preview.png`；接口与制作过程见 [法杖记录](source/walk-weapon-staff-generation.md)。
