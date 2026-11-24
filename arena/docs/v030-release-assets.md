# v0.3.0 本地产包合同（给 Sol；非发布批准）

目标：从冻结的游戏提交重建后，读 `package/manifest.json` 即可定位**实际随包**的游戏资源、版本和审查出处。保留目录、启动方式、`local-candidate`、逐文件 `FILES.sha256` 和归档哈希；不重做资源扫描器，不改历史版本配方。

## 最小改动

1. 在**游戏源**新增 `arena/art/asset-provenance-v0.3.0.json`：按下面的资源组登记入口及已有评审链接、被审完整提交、批准范围（离线源／实机）和仍待验收项。一个 PR 已合不等于视觉或发布批准；没有对应意见的范围记为待验，不写批准。不要在此文件写它自身所在的最终提交号。
2. `buildMetadata(source, version)` 对 `0.3.0` 读取该记录；`collectPackage` 传入版本并把记录原样复制到包内同路径。包 manifest 记录其路径和 SHA256，保留既有协议、模块版本、锁文件与工具链字段。旧版保留原分支。`animation/coverage.json` 与 `approval-v0.2.0.json` 只说明旧资源，不作 v0.3 主场覆盖或整版批准。
3. 对下表的显式入口记录**包内相对路径及实际 dist 字节 SHA256**（`arena/client/dist/assets/` 为包内前缀）。角色索引另外列 `assetSetId`，逐个沿 `clips[].root + descriptor` 写动作、包内 descriptor 路径及哈希；不要另造动作表，也不要重复列所有 PNG。图页和其他负载已有 `FILES.sha256`。

| 运行时读取者 | `assets/` 下的实际入口 | 出处与边界 |
| --- | --- | --- |
| `dollAssets.ts` 主角色与工作 | `iso-v030-base/index.json` | PR63 是 idle/walk 源；PR73 是五工作动作源；PR85 将工作动作挂在**同一个**玩家索引。按冻结提交实物登记，不能用源 PR 代替实机验收。玩家战斗仍在制作；最终挂载后按实际索引和对应意见补齐。 |
| `EnemyScene.ts` | `iso-v030-enemy-eight-final-1f8e013/index.json` | 区分 PR68 敌人五动作源与 PR79 产品接入的审查。目录名短哈希不代替被审提交号。 |
| `MapCanvas.tsx`、`worldAssets.ts`、`libraryLayout.ts` | `tiles/manifest.json`、`iso-v030-world/manifest.json`、`p3-buildings/manifest.json`、`p3-buildings/buildings-atlas.json`、`p3-environment/manifest.json`、`p3-environment/environment-atlas.json` | 分开记录地面、世界物件、建筑、环境；从各项实际评审引用范围，例如 PR59 的环境接入不覆盖建筑。 |

4. 在**配方**新增 `arena/release/notes-v0.3.0.md`（沿用现有按版本复制的机制），说明实际包内容、启动方式、已知限制及验收状态；更新 `arena/release/README.md` 加 v0.3 示例，保留 v0.2 的历史重建说明。

## 两个提交与交接

`sourceCommit` 是 `build.mjs` 参数解析出的完整游戏提交：源码、版本数据、资源、出处记录、依赖锁和由此构建的 dist／二进制均来自它。`recipeCommit` 是运行打包命令的**干净已提交配方** HEAD，提供 manifest／收包脚本、启动器、运行说明与当版 notes。两者可相同，不应以当前工作树内容或两个短哈希混报。用全新输出目录构建。

现可交付元数据代码，但不固定未完 P3 为最终源，不打 tag。玩家战斗等资源和分项实机验收齐备后，固定 source/recipe 并集中构建；在新解包目录核对 `FILES.sha256`，用包内 `start.sh` 启动实际客户端、服务端和 runner，执行既定 P5 胜败、双端、脚本/恢复与回放验收，证据关联两提交和归档哈希。5175 的连续 tick233 胜利是主试玩证据，不是该归档的启动或整版发布证明。
