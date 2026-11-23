# 墨影 NE/SW 动作候选

状态：prototype，尚未接入产品或通过自然动作验收。独立新目录不修改玩家或工具core。

| 动作 | 配置 | 当前边界 |
| --- | --- | --- |
| idle | neutral/pose.json：4×250ms | 原9piece等比平移到192/pivot96,172.8，轻颈部呼吸 |
| walk | walk/pose.json：16×45ms | 新完整双腿，world骨长.265/.255、hipZ.54/ankleZ.10、轨宽.16，stride1.08 |
| attack | attack/pose.json：120/180/120/200ms | 原地近臂爪击，腕IK与worldStanding脚 |
| hit | hit/pose.json：100/150ms | 躯干退让、颈肩反应，worldStanding脚 |
| down | down/pose.json：120/160/180/240ms holdLast | 真正屈膝→撑地→侧卧独立源，256/pivot128,204.8；当前整轮廓变体，落点与跨clip一致性待审 |

新腿与倒地PNG由proxy-imagegen/GPT Image2 text-only生成，提示词保留于source。腿首请求成功；倒地首次SSE未完成，技能自动第二次成功。成功源保留。原中立复用仓库成功source与9piece，不重复请求。

倒地不是旋转站姿；当前没有敌人换装需求，使用真实姿势轮廓互斥附件。其余动作使用独立头/躯干/袍/手臂/上下腿/靴。侧卧新袍偏墨绿色，须与中立源在产品核对。walk先亲看接触页，再测连续脚廓/循环；数值零误差与自然步态接受分别记录。

复建：在arena/art安装既有依赖后，从仓库根依次运行本目录register-neutral.mjs、register-legs.mjs、register-actions.mjs、register-down.mjs；后者读取保留的down/source-registration.json精确crop注册。各pose交工具PR44的pose-export.mjs烘至新输出目录，避免覆盖审阅中的候选。

每动作统一atlas-budget.json描述，orig/trim/pivot完整。idle/attack/hit/down若报告0contact，表示未执行切脚审计，不声称零误差锁足；walk另有world-cycle-report。剩余六向待两向模板亲看后继续。
