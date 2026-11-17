# 竞技场美术管线

当前采用四头身独立纸娃娃与标准等角地块，生成来源与注册偏差见 [四头身制作记录](source/four-head-generation.md)，接口与验收范围见 [ANIMATION-PLAN.md](ANIMATION-PLAN.md)。所有素材仍为 prototype；原图保留，不能用程序画图或概念图冒充游戏截图。

运行 `npm ci && npm run build && npm test`：依次生成地块、四头中立换装、idle/walk 图集与组合预览，再检查来源与分层合同。`build` 与 `build:animation` 使用相同当前管线，历史整图构建仅通过 `build:archive` 显式运行。标准 Pixi 图集、2px 留白与 SHA-256 来源清单生成至 `../client/public/assets/`；贴图为 PNG，不依赖运行时生成服务。

每动作14层、八向各4帧，统一192px画布。绘制顺序为 staff-back → hair-back → body → outfit → staff-front → body-front → hand-grip → hair-front；空手不显示杖与闭握。两衣装×两发型×空手/法杖只影响外观，不改变竞技数值。图集坐标、注册修正和来源受版本控制，生成式素材仍需独立实机美术审查和发布权利审查。

覆盖矩阵位于 `../client/public/assets/animation/coverage.json`。`walk-{scholar|warden}-{ivory|midnight}[-staff]-preview.png` 展示八向四帧换装组合；`idle-walk-{scholar|warden}-{ivory|midnight}-comparison.png` 对照两动作。接触页不是运行时截图或独立动作批准。

idle 从独立中立源生成四帧250ms呼吸/衣摆/发梢微动，y112以下身体不动；walk 从独立行走源注册四帧125ms动作，不使用idle平移冒充行走。法杖使用逐帧解剖右手挂点与前后深度，前后发片、前手与闭握均为独立层。

历史三头身管线与整图源仅供追溯，不能作为当前比例或动作合同。`build:idle` 仍是当前完整动画构建的别名；地块与中立fit可分别用 `build:tiles`、`build:fit` 重建。测试通过不等于步态与完整换装播放已获批准。
