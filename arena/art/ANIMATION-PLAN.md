# 四头身纸娃娃与标准等角地块美术合同

当前目标是**四头身、真实分层**，不是整张生成角色立绘。v0.2.0交付idle/walk八向各4帧，适配两衣装×两发型×空手/法杖；run移至v0.3.0候选。当前全部为prototype，矩阵见`../client/public/assets/animation/coverage.json`，不得以测试通过代替实机批准。

## 当前来源与构建

- 独立中立身体`source/four-head-neutral.png`与衣装`source/four-head-outfits.png`经四头骨架注册；64中立换装方向组合已通过独立制作门。不是整套动作发布批准。
- idle由该专用站姿源产生四帧呼吸/衣摆/发梢微动，y112以下身体像素不动；walk用`source/four-head-walk-body.png`、`four-head-walk-scholar.png`、`four-head-walk-warden.png`的独立动作源。两发型与法杖复用既有设计并重新注册，闭握为持杖专用层。
- 当前每动作14个图集，共28个。每层保留源图/prompt哈希、源裁切、挂点/摆放和可复建注册。真实生成结果、源偏差与待修项仅记`source/four-head-generation.md`。
- 默认`npm run build`与`npm run build:animation`均直接执行地块→四头中立fit→四头idle/walk→组合预览，不生成历史整图/角色覆盖。验收`npm run build && npm test`；地块单独`npm run build:tiles`，中立fit单独`npm run build:fit`。旧整图构建仅保留为显式`npm run build:archive`历史入口。

## 统一接口

- 方向`S SW W NW N NE E SE`；S朝屏幕、N背屏幕。PNG/Pixi JSON键`{action}/{layer}/{direction}/{00..}`。
- cell192×192、padding2、anchor`(0.5,0.9)`。裸颅冠y12→下颏52为40px头单位，冠→sole172为160px四头；注册脚点172.8比最下opaque像素172低0.8px，整套固定，不能逐帧漂移。地图/预览只整体等比缩放同一doll。
- idle4×250ms，walk4×125ms，均循环；帧数/时长使用动作目录。每帧冠/颈/髋/左右手与武器深度注册共享给衣装和装备。
- 顺序：staff-back → hair-back → body → outfit → staff-front → body-front → hand-grip → hair-front。空手不显示武器/闭握；两动作都拆前后发片。聚合hair/staff图只作索引兼容与重建检查。
- 基础身体、衣装、前后发片、前手和前后武器始终可独立切换；禁止完整角色图替代角色预览。非对称饰品/持杖手不得整图镜像。
- 地面128×64标准2:1菱形，独立高件128×192并显式footprint/pivot；PNG总高度不是tileHeight。`assets/tiles/manifest.json`定义资源，不生成整张地图背景。详见`source/four-head-isometric-contract.md`。

## v0.2.0精简待办

- [x] 标准floor/独立props原图、透明打包、manifest、接缝测试，供全屏地图集成。
- [x] 四头中立八向全换装fit制作门、idle/walk完整分层试产与来源追溯。
- [ ] walk后半周期修复候选已通过定点接触表复查；继续真实FPS循环复审抬膝幅度/腿粗/摆臂过渡，hash不同不等于步态正确。
- [ ] 全部idle/walk组合真实播放逐帧审查：握掌不重复、指杖接触、肩甲/袖边、发片、膝踝、脚底和转向连续性。
- [ ] 同源地图/预览/工坊、双客户端/回放/换装回归；完整128动作方向组合、512组合帧具备证据后才批准。

## 后续动作候选（非本版）

run每向6帧：独立前倾/腾空/大摆臂，v0.3.0候选；jump6帧：蓄力/起跳/腾空/落地；climb6帧：抓握/提膝/攀升；法杖使用8帧：起手/施法/收招。受击/死亡等后续补齐。所有新动作仍为四头骨架并适配全部已发布换装，不能加速/平移既有动作冒充。

## 历史试产（已被当前合同取代）

2026-10-28至11-15曾按三头身方向制作`walk-body-eight-directions.png`及旧idle/walk，实际源有2.5–2.8头、侧后passing方向漂移、白边等问题。11-05至11-14逐步加入两衣装、两发型、法杖；11-15统一比例与握点。这些源与脚本保留作历史追溯，不是当前执行合同或主构建入口。

11-17旧run三张源在用户改四头身前已成功生成，保留为历史试产，未进入当前runtime或获批准。旧生成说明和`source/motion-unification.md`描述当时结果，不得据此恢复旧比例目标。所有概念/素材表均非实机截图。
