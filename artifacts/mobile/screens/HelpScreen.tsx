import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';

interface Props {
  onMenuPress: () => void;
}

interface HelpEntry {
  id: string;
  title: string;
  category: string;
  content: string;
}

const HELP_DATA: HelpEntry[] = [
  // ─── 基本系统 ───
  {
    id: 'hp',
    title: '生命值 (HP)',
    category: '基本系统',
    content: `【生命值】范围 0–100，代表角色的综合生理状况。

计算公式：
  HP = 100 − 平均疼痛值 × 0.7 − 断裂节段数 × 5 + 急救加成

关键阈值：
• HP < 5：进入濒死状态，此时急救才能回血（+25）
• HP 受小肠各段平均疼痛值实时驱动

影响因素：
• 工具对肠段造成伤害 → 疼痛值上升 → HP下降
• 肠管断裂（broken）每处 -5 点固定惩罚
• 麻醉镇静剂降低疼痛感知（痛觉修正值），间接提升HP表现
• 急救、输血可在危急时恢复HP

提示：HP 每帧更新，在强烈刺激下会快速下降。使用镇静剂可缓冲疼痛对HP的影响。`,
  },
  {
    id: 'pleasure',
    title: '快感值',
    category: '基本系统',
    content: `【快感值】范围 0–100，代表角色的感官刺激程度。

计算公式：
  快感值 = 平均敏感度 × 0.6 + max(0, 平均压力 − 40) × 0.5

关键机制：
• 敏感度由振动器、抓握等刺激性操作累积
• 压力超过40后开始额外贡献快感（容积刺激）
• 灌肠注液可大幅提升肠腔压力，进而拉高快感值

影响因素：
• 振动器：直接对接触节段施加高敏感度增量
• 抓握工具：持续刺激提升局部敏感度
• 灌肠器：注液压力超过40时快感倍增
• 敏感度会随时间自然缓慢衰减

提示：快感值本身不造成伤害，但高快感状态会引发特殊对话。`,
  },
  {
    id: 'heartrate',
    title: '心率系统',
    category: '基本系统',
    content: `【心率】单位 bpm，正常范围 60–100。

计算公式（正常状态）：
  心率 = 72 + 平均疼痛 × 0.8 + 快感值 × 0.4 + 药物HR修正值
  范围限制：20–240 bpm

昏迷状态下强制固定：
• 心跳过速昏迷：175–195 bpm（每帧随机波动）
• 心跳过缓昏迷：25–35 bpm（每帧随机波动）

心电图颜色编码：
• 蓝色：< 50 bpm（危险的过缓）
• 绿色：50–100 bpm（正常）
• 黄绿色：100–130 bpm（轻度升高）
• 橙色：130–160 bpm（中度升高）
• 红色：> 160 bpm（危险的过速）

提示：强烈疼痛或兴奋剂叠加使用会使心率急剧飙升。昏迷状态下心电图会显示特殊波形。`,
  },
  {
    id: 'intestine_health',
    title: '肠道健康系统',
    category: '基本系统',
    content: `【肠道健康】每个肠段独立维护四项属性：

1. 健康值 (health)：0–100
   • 受到伤害时下降，不自动恢复
   • 降至0后节段更容易穿孔或断裂

2. 敏感度 (sensitivity)：累积值
   • 振动器、抓握累积；贡献快感值

3. 疼痛值 (pain)：0–100
   • 针刺、高压、强电击等造成疼痛
   • 贡献HP降低和心率上升

4. 压力值 (pressure)：
   • 灌肠注液、蠕动、工具挤压产生压力
   • 超过破裂阈值导致穿孔
   • 小肠破裂压力阈值：100
   • 大肠破裂压力阈值：180

伤害类型：
• 穿孔 (perforated)：压力超过阈值
• 断裂 (broken)：连接约束被破坏

调试模式下可视化：
  绿=健康 | 紫=敏感 | 红=疼痛 | 蓝=压力`,
  },
  {
    id: 'breath',
    title: '呼吸与膨胀',
    category: '基本系统',
    content: `【呼吸系统】腹腔随呼吸周期性扩张和收缩。

呼吸幅度 (breathAmplitude)：默认 1.2
• 控制腹腔扩张的幅度大小
• 兴奋剂使呼吸加快加深（+0.2/次，上限3.0）
• 镇静剂使呼吸减慢变浅（-0.15/次，下限0.2）
• 可在设置界面调整基础值（范围 0.2–3.0）

膨胀系数 (expansionScale)：默认 1.3
• 控制肠道整体膨胀比例
• 影响肠道物理体积和碰撞范围
• 可在设置界面调整（范围 0.0–4.0）

蠕动系统：
• 蠕动速度：控制肠道收缩波传播速率
• 蠕动波幅：控制收缩波的幅度
• 蠕动传导速度：波在肠段间传播的速度
• 泻药可临时大幅提升蠕动（600帧 ≈ 20秒）`,
  },

  // ─── 工具 ───
  {
    id: 'tool_metalrod',
    title: '金属棒',
    category: '工具',
    content: `【金属棒】在腹腔内搅动肠道的刚性工具。

参数：
• 杆长 (param1)：0–100，控制棒的物理长度
• 搅动强度 (param2)：0–100，控制与肠段接触时施力大小

使用方式：
1. 在工具栏选择"金属棒"
2. 在画布上拖动控制位置
3. 点击"启动"使工具持续施力
4. 可在已插入工具时缩回控制面板操作

物理影响：
• 接触肠段时施加推力使节点位移
• 高强度搅动会造成疼痛值上升
• 长时间接触同一节段导致健康值下降
• 可挤压大肠引发局部压力积聚

示例：杆长50 + 强度80 = 中等长度高强度搅动，快速造成局部疼痛`,
  },
  {
    id: 'tool_grab',
    title: '抓握',
    category: '工具',
    content: `【抓握工具】抓取并保持肠道节段的位置。

参数：
• 抓取范围 (param1)：0–100，影响能抓住的节点半径
• 抓取力度 (param2)：0–100，决定拉拽力的大小

使用方式：
1. 选择"抓握"工具
2. 在画布上点击目标肠段位置
3. 启动后持续抓取，拖动改变位置
4. 停止后肠段恢复物理计算

物理影响：
• 拉伸超出节段连接距离会产生张力
• 长时间拉伸刺激敏感度上升
• 力度过大会影响节段健康值
• 可用于暴露肠道特定区域便于其他工具操作

示例：范围30 + 力度60 = 精确抓取单一肠段，轻度拉伸刺激`,
  },
  {
    id: 'tool_vibrator',
    title: '振动器',
    category: '工具',
    content: `【振动器】对目标区域施加周期性振动刺激。

参数：
• 震动强度 (param1)：0–100，振动力度和敏感度增量
• 震动范围 (param2)：0–100，振动影响的节点半径

使用方式：
1. 选择"振动器"工具
2. 在画布上定位（可拖动）
3. 启动后持续振动
4. 范围大 = 覆盖更多肠段

物理影响：
• 范围内所有肠段的敏感度持续增加
• 高强度振动也会积累轻微疼痛值
• 对快感值贡献最直接（高敏感度 → 高快感）
• 小肠段密集区使用效果更显著

示例：强度80 + 范围60 = 广范围高强度振动，快速提升快感值至峰值

提示：振动器是提升快感值最高效的工具。`,
  },
  {
    id: 'tool_needle',
    title: '长柄针',
    category: '工具',
    content: `【长柄针】精准刺入造成局部穿刺伤害的工具。

参数：
• 针长 (param1)：0–100，针的物理刺入深度
• 穿刺强度 (param2)：0–100，每次刺击造成的伤害量

使用方式：
1. 选择"长柄针"
2. 定位到目标肠段
3. 启动后持续穿刺
4. 针长决定能触及的深度层

物理影响：
• 每帧对接触节段造成疼痛伤害
• 高强度穿刺使节段健康值快速下降
• 健康值归零的节段更易穿孔（ruptured）
• 穿孔节段会持续泄漏压力

危险操作示例：针长80 + 强度100 = 深度高强度穿刺，数秒内造成穿孔

注意：已穿孔节段需通过"肠道修补手术"才能恢复。`,
  },
  {
    id: 'tool_electric',
    title: '电击器',
    category: '工具',
    content: `【电击器】通过电极对组织施加电流刺激。

参数：
• 电压 (param1)：0–100V，决定伤害强度和对话类型
• 电击范围 (param2)：0–100，影响半径（基础30 + 参数×0.3）

使用方式：
1. 选择"电击器"
2. 在画布上点击放置电极（最多8个）
3. 多个电极可同时作用
4. 点击"清除电极"移除所有电极

对话触发阈值（根据电压）：
• < 25V：低压电击对话
• 25–50V：中压对话
• 50–75V：高压对话
• > 75V：极端电击对话

昏迷解除：
• 电压 > 55V 时可解除药物昏迷状态（强制复苏）

特殊：电极可区分命中小肠/大肠，分别触发不同对话系列

示例：2个电极电压60V + 范围50 = 中广范围，可解除昏迷并触发高压反应`,
  },
  {
    id: 'tool_syringe',
    title: '注射器',
    category: '工具',
    content: `【注射器】向肠道注射泻药溶液的医疗工具。

参数：
• 注射速度 (param1)：0–100 mL/s，液体注入速率
• 泻药浓度 (param2)：0–100，溶液浓度系数

使用方式：
1. 选择"注射器"
2. 定位到目标位置
3. 启动后持续注射
4. 液体向周围节段扩散

物理影响：
• 向目标肠段注入压力
• 压力经由扩散机制向邻近节段传播
• 高压导致节段膨胀，超过阈值穿孔
• 压力扩散速度可在设置中调节

示例：速度80 + 浓度60 = 快速注射，局部快速升压

提示：与灌肠器配合使用可从两端同时施压。`,
  },
  {
    id: 'tool_enema',
    title: '灌肠器',
    category: '工具',
    content: `【灌肠器】从肛门插入向肠道深处注液的工具。

参数：
• 灌肠流量 (param1)：0–200 mL/s，每步注液量
• 刺激程度 (param2)：0–100，局部刺激系数

插管深度系统（自动推进动画，每300ms一步）：
• 大肠段：节段索引 0→31（越小越深入）
• 小肠段：全穿越后进入（节段索引 0→55）

对话触发（按深度）：
  大肠浅段（0–8节）→ enema_large_shallow
  大肠中段（9–20节）→ enema_large_medium
  大肠深段（>20节）→ enema_large_deep
  进入小肠 → enema_enter_small
  小肠浅/中/深 → 对应系列

压力影响：
• 流量越大、深度越深，压力积聚越快
• 压力向前扩散，可引发全段膨胀
• 大肠破裂阈值180（比小肠100高）

提示：目标节段在控制台"灌肠流量"滑块中设置。可在控制台预调参数。`,
  },

  {
    id: 'tool_bayonet',
    title: '刺刀',
    category: '工具',
    content: `【刺刀】锋利的利刃，可直接刺穿肚脐进入腹腔，对肠道造成严重穿刺和切割伤害。

参数：
• 刺刀长度 (param1)：0–100，刀身伸入长度
• 刀宽 (param2)：0–100，刀身宽度/碰撞判定范围

特殊能力：
• 可直接刺穿肚脐（无需事先穿孔）
• 刀尖造成剧烈伤害（疼痛、健康值下降、穿孔）
• 刀身接触也会造成持续切割伤害
• 启动后自动搅动，刀尖反复划过肠壁

对话触发：
• 刺入时 → bayonet_pierce
• 深入刺刺到肠段 → bayonet_deep

物理影响：
• 刀尖接触范围内：疼痛 +0.9/帧，健康值 -0.8/帧
• 随机触发肠段穿孔（概率随刀宽增加）
• 刀身宽度越大，碰撞推开肠道越明显

警告：长时间激活会造成不可逆的肠道穿孔和健康损耗。`,
  },
  {
    id: 'tool_silicone_rod',
    title: '长硅胶棒',
    category: '工具',
    content: `【长硅胶棒】柔性硅胶材质的扩张棒，从肛门插入，沿大肠至小肠逐步扩张肠道。

参数：
• 直径 (param1)：0–100，棒的截面直径（影响扩张力度）
• 速度 (param2)：0–100，推进速度和刺激程度

使用方式：
1. 选择"长硅胶棒"工具
2. 拖动定位至大肠肠段
3. 启动后持续扩张

插入深度：
• 使用与灌肠器相同的位置追踪系统
• 大肠→小肠逐步推进
• 直径越大，扩张压力越强

物理影响：
• 直径超出肠道直径时：大幅施加压力
• 高压导致肠道膨胀，敏感度快速上升
• 可在大肠内逐段扩张，也可深入小肠
• 速度参数影响蠕动速度增量

提示：搭配放松腹部指令可更轻松地插入更大直径。`,
  },
  {
    id: 'tool_anal_beads',
    title: '拉珠',
    category: '工具',
    content: `【拉珠】由多颗逐渐增大的珠子串成的刺激工具，从肛门插入，利用每颗珠子的膨胀效果逐级刺激肠道。

参数：
• 插入深度 (param1)：0–100，目标插入深度（影响扩张系数）
• 拉出速度 (param2)：0–100，拉出时每颗珠子的刺激强度

使用方式：
1. 选择"拉珠"工具
2. 拖动定位至目标肠段
3. 启动后自动推进珠子
4. 停止启动时产生拔出刺激效果

视觉效果：
• 每颗珠子以独立圆圈渲染（从小到大）
• 珠链沿大肠走向分布
• 可深入至小肠

物理影响：
• 与长硅胶棒类似的压力/扩张机制
• 珠子间隔产生脉冲式膨胀-收缩刺激
• 拔出时触发 beads_pullout 对话（强烈刺激）

提示：拉珠拔出瞬间产生极强快感刺激。`,
  },

  // ─── 药剂与指令 ───
  {
    id: 'cmd_relax',
    title: '放松腹部',
    category: '药剂与指令',
    content: `【放松腹部】指令使腹腔肌肉短暂松弛。

效果：
• 激活 150 帧（约5秒）的松弛状态
• 松弛期间肠道阻力降低
• 工具更容易产生位移效果
• 降低肠道对外力的抵抗

参数关联：
• 松弛效果影响物理约束强度
• 与蠕动系统无关，不改变收缩波

冷却时间：12 秒（UI层限制，连续快速使用无额外效果）

使用建议：
• 在插入工具前使用，降低摩擦
• 搭配金属棒或灌肠器可获得更深入的位移效果
• 松弛期结束后腹腔恢复正常张力`,
  },
  {
    id: 'cmd_laxative',
    title: '服用泻药',
    category: '药剂与指令',
    content: `【服用泻药】强力促进肠道蠕动的药物。

效果：
• 激活 600 帧（约20秒）的强蠕动状态
• 蠕动速度在原基础上大幅提升
• 蠕动波幅增加，肠道收缩更剧烈

参数关联：
• peristalsisBase 在激活期间被设置为增强值
• 不影响breathAmplitude、heartRate等指标
• 与蠕动波幅(peristalsisWaveAmplitude)叠加

冷却时间：30 秒（UI层限制）

物理效果链：
  泻药激活 → 蠕动增强 → 肠道快速收缩
  → 内容物压力升高 → 疼痛/压力上升
  → HP缓慢下降

使用建议：
• 可用于测试肠道的压力承受极限
• 搭配灌肠器使用可造成极端压力积聚`,
  },
  {
    id: 'cmd_stimulant',
    title: '服用兴奋剂',
    category: '药剂与指令',
    content: `【服用兴奋剂】中枢神经兴奋药物，可叠加服用。

单次效果：
• 心率修正 +15 bpm（上限累积 +150）
• 呼吸幅度 +0.2（上限 3.0）
• 肠道蠕动修正 +0.1（上限 3.0）

药效时间：
• 默认 2 分钟（可在设置中调整 30s–5min）
• 再次服用重置倒计时
• 倒计时显示在命令栏按钮上

叠加机制：
• 每次服用叠加上述增量
• 所有修正值受上限限制
• 药效时间仅以最后一次服用为准

过量检测（20秒内 > 10次）：
• 触发【心跳过速昏迷】
• 例外：当前处于心跳过缓昏迷时，兴奋剂反而解除昏迷

对话触发：
• 正常服用 → cmd_stimulant 系列
• 过量 → overdose_tachycardia 系列（共4条）

参数关联：
  心率: heartRate = 72 + pain×0.8 + pleasure×0.4 + heartRateModifier
  蠕动: peristalsisBase = peristalsisSpeed + peristalsisModifier`,
  },
  {
    id: 'cmd_sedative',
    title: '服用麻醉镇静剂',
    category: '药剂与指令',
    content: `【服用麻醉镇静剂】麻醉性镇静药，可叠加服用。

单次效果：
• 心率修正 −12 bpm（最低累积 −120）
• 呼吸幅度 −0.15（下限 0.2）
• 痛觉修正 −5（最低 −50，减弱疼痛对HP的影响）

药效时间：
• 默认 2 分钟（可在设置中调整 30s–5min）
• 再次服用重置倒计时
• 倒计时显示在命令栏按钮上

叠加机制：
• 每次服用叠加上述减量
• 痛觉修正不消除疼痛，仅降低HP计算中的疼痛权重

过量检测（20秒内 > 10次）：
• 触发【心跳过缓昏迷】
• 例外：当前处于心跳过速昏迷时，镇静剂反而解除昏迷

对话触发：
• 正常服用 → cmd_sedative 系列
• 过量 → overdose_bradycardia 系列（共4条）

痛觉修正公式：
  totalPain = max(0, 平均疼痛 + painModifier)
  HP = 100 − totalPain × 0.7 − 断裂 × 5`,
  },
  {
    id: 'overdose',
    title: '药物过量与昏迷',
    category: '药剂与指令',
    content: `【药物昏迷系统】过量用药引发危及生命的昏迷状态。

触发条件：
• 20秒内服用兴奋剂超过10次 → 心跳过速昏迷
• 20秒内服用镇静剂超过10次 → 心跳过缓昏迷

昏迷期间：
• 心率被强制锁定（过速：175–195bpm / 过缓：25–35bpm）
• 心电图显示对应危急波形（红色快速 / 蓝色缓慢）
• 角色无法正常说话（12%概率发出昏迷呻吟）
• 正常对话触发被屏蔽

解除方式（任一）：
  1. 服用相反药物
     - 昏迷中服用镇静剂解除心跳过速昏迷
     - 昏迷中服用兴奋剂解除心跳过缓昏迷
  2. 急救手术
     - 手术面板 > 急救（立即解除昏迷）
  3. 强烈刺激
     - 平均疼痛值 > 65
     - 电击电压 > 55V 且电极活跃
     （每8秒检测一次，触发强制复苏）

状态指示：
  命令面板底部出现红/蓝警告横幅
  操作界面右下角状态徽章变色`,
  },

  // ─── 手术操作 ───
  {
    id: 'surg_firstaid',
    title: '急救',
    category: '手术操作',
    content: `【急救】在生命垂危时提供紧急救治。

触发条件：
• HP < 5 时急救有效（提供+25 HP加成）
• HP ≥ 5 时急救不提供HP恢复，但仍解除昏迷

效果：
• 增加25点 hpBonus（叠加到HP计算中）
• 立即解除任何药物昏迷状态（心跳过速/过缓）
• 触发 surg_firstaid 对话

HP公式中的 hpBonus：
  HP = min(100, 100 − pain×0.7 − breaks×5 + hpBonus)

注意事项：
• hpBonus 不会随时间消失
• 多次急救可叠加 hpBonus（无上限但受HP 100封顶）
• 建议在输血的同时使用急救以最大化恢复`,
  },
  {
    id: 'surg_transfusion',
    title: '输血',
    category: '手术操作',
    content: `【输血】缓慢恢复生命值的医疗操作。

效果：
• 激活 600 帧（约20秒）的持续输血状态
• 在此期间逐帧向 hpBonus 增加（共计约+30点）
• 缓慢而持续，适合非紧急恢复

与急救的区别：
• 急救：立即+25，要求HP<5，解除昏迷
• 输血：慢速+30，无HP限制，不解除昏迷

使用建议：
• 在工具伤害持续进行时输血可维持HP不归零
• 搭配急救使用（先急救后输血）效果最佳
• 输血期间减少施加新伤害效果更好`,
  },
  {
    id: 'surg_repair',
    title: '肠道修补手术',
    category: '手术操作',
    content: `【肠道修补手术】清除所有肠段穿孔伤害。

效果：
• 清除全部 perforated（穿孔）标记
• 被修补节段的健康值提升至 max(当前值, 30)
• 被修补节段的疼痛值降低至 min(当前值, 40)
• 留下修补痕迹（视觉标记，不影响物理）

修补痕迹：
• 小肠修补痕迹：repairMarks[]
• 大肠修补痕迹：largeRepairMarks[]
• 痕迹会在画布上显示不同颜色着色

注意：
• 断裂（broken）不是穿孔，需用缝合手术处理
• 修补后节段仍可被再次伤害
• 不清除疼痛值，只降低至40以下`,
  },
  {
    id: 'surg_suture',
    title: '断肠缝合手术',
    category: '手术操作',
    content: `【断肠缝合手术】清除所有肠道断裂并恢复连接。

效果：
• 清除全部 broken（断裂）标记
• 缝合后节段健康值提升至 max(当前值, 35)
• 缝合后节段疼痛值降低至 min(当前值, 20)
• 清零该节段压力值
• 物理上强制将断裂节点拉近（距离 > 28/30mm 时重置）
• 留下缝合痕迹（视觉标记）

物理修正：
• 小肠节点间距超过 28mm 时强制收回
• 大肠节点间距超过 30mm 时强制收回
• 防止缝合后节点位置仍然分离

注意：
• 断裂处对HP有 −5/处的固定惩罚，缝合后立即解除
• 缝合痕迹（sutureMarks）在移植手术后会被清除`,
  },
  {
    id: 'surg_navel',
    title: '肚脐贯通手术',
    category: '手术操作',
    content: `【肚脐贯通手术】永久开放肚脐通道。

效果：
• 设置 navelPierced = true（永久，不可撤销）
• 工具可直接通过肚脐插入腹腔
• 插入后工具被锚定在 CAVITY_CX, CAVITY_CY 位置

锚定插入机制：
• 未穿孔时：工具从画布边缘移动控制
• 穿孔后：点击"经脐插入"按钮后工具固定在腹腔中心
• 锚定状态下工具不可手动移动（固定于脐孔）

使用场景：
• 金属棒、注射器等可经脐插入并锁定深度
• 需要精准固定工具位置时使用

注意：此操作不可逆，整局持续有效。`,
  },
  {
    id: 'surg_transplant',
    title: '移植手术',
    category: '手术操作',
    content: `【移植手术】更换受损肠道的终极恢复方案。

三种类型：
• 小肠移植：重置小肠 37段（初始健康值 85%）
• 大肠移植：重置大肠 29段（初始健康值 85%）
• 全肠移植：同时重置所有肠道

移植后效果：
• 所有节段健康值归 85（非100，有轻微磨损感）
• 清除该肠道所有穿孔、断裂、修补/缝合痕迹
• 随机生成新的肠道颜色（色调在正常范围内随机偏移）
• 清除该段所有肠系膜切断记录
• 移植计数+1（显示在操作界面右上角）

颜色随机范围：
  小肠：R 180–255, G 80–200, B 70–180
  大肠：R 155–255, G 60–170, B 50–150

注意：移植后节点位置不变（需手动复位来重置节点位置）`,
  },
  {
    id: 'surg_mesentery',
    title: '肠系膜切断手术',
    category: '手术操作',
    content: `【肠系膜切断手术】精细操作，切断选定节点的肠系膜约束。

操作流程：
1. 点击"肠系膜切断手术"进入选区模式
2. 在操作界面画布上触碰/点击大肠或小肠节点进行选择
3. 选中的节点会高亮显示
4. 点击"执行切断"确认操作
5. 点击"取消选区"放弃操作

效果：
• 选中节点的肠系膜约束被永久禁用
• 该节点不再受到腔壁弹性约束（可以"飘出"边界）
• 肠道在该节点处可以大幅移位

物理影响：
• mesenteryDisabled[] 记录大肠被切除节点
• smallMesenteryDisabled[] 记录小肠被切除节点
• 移植手术后被切除的系膜恢复正常

使用注意：
• 选区模式下正常操作暂停，专注选节点
• 切断后节点可能漂移到腹腔边界外`,
  },

  // ─── 心率与昏迷 ───
  {
    id: 'coma_tachy',
    title: '心跳过速昏迷',
    category: '心率与昏迷',
    content: `【心跳过速昏迷 (Tachycardia Coma)】
因兴奋剂过量导致的危急状态。

触发：20秒内服用兴奋剂超过10次

症状：
• 心率强制锁定在 175–195 bpm
• 心电图变为红色，显示快速不规则波形
• 角色无法正常交流（昏迷状态）

昏迷期间命令限制：
• "服用兴奋剂"按钮禁用（灰色）
• "服用镇静剂"按钮高亮（解除入口）
• 命令面板显示红色警告横幅

解除方式：
  ① 服用镇静剂（不触发镇静剂过量检测）
  ② 手术面板点击"急救"
  ③ avgPain > 65 或电击 > 55V（强制复苏，8秒冷却）

解除后：
• 心率恢复正常计算模式
• 药物修正值（heartRateModifier等）保留
• 对话触发恢复正常`,
  },
  {
    id: 'coma_brady',
    title: '心跳过缓昏迷',
    category: '心率与昏迷',
    content: `【心跳过缓昏迷 (Bradycardia Coma)】
因镇静剂过量导致的危急状态。

触发：20秒内服用镇静剂超过10次

症状：
• 心率强制锁定在 25–35 bpm
• 心电图变为蓝色，显示极慢稀疏波形
• 角色无法正常交流（昏迷状态）

昏迷期间命令限制：
• "服用镇静剂"按钮禁用（灰色）
• "服用兴奋剂"按钮高亮（解除入口）
• 命令面板显示蓝色警告横幅

解除方式：
  ① 服用兴奋剂（不触发兴奋剂过量检测）
  ② 手术面板点击"急救"
  ③ avgPain > 65 或电击 > 55V（强制复苏，8秒冷却）

注意：
• 心跳过缓对HP没有直接影响（HP仍由疼痛驱动）
• 但失去意识状态持续会导致角色无法配合操作`,
  },

  // ─── 物理引擎 ───
  {
    id: 'phys_pressure',
    title: '压力与扩散系统',
    category: '物理引擎',
    content: `【压力系统】肠道内容物压力的物理模拟。

压力来源：
• 注射器注液：直接向目标节段加压
• 灌肠器：向当前管头位置加压
• 蠕动收缩：波形收缩产生局部峰值压力
• 工具挤压：物理接触导致局部压力上升

压力扩散：
• 每帧按 pressureDiffusionRate 速率向相邻节段传播
• 默认扩散速率：0.004（可在设置中调节）
• 调节范围：0.001–0.02
• 高扩散率 = 压力更快均匀分布，不易形成局部峰值
• 低扩散率 = 压力集中，更易穿孔

压力衰减：
• 压力自然衰减速率 PRESSURE_DECAY_RATE = 0.002/帧
• 穿孔节段压力持续泄漏

破裂阈值：
• 小肠：pressure > 100 → ruptured (perforated)
• 大肠：pressure > 180 → ruptured (perforated)

提示：高扩散 + 快速注液 = 全段均匀膨胀。低扩散 + 集中注射 = 定点爆裂。`,
  },
  {
    id: 'phys_peristalsis',
    title: '蠕动波系统',
    category: '物理引擎',
    content: `【蠕动系统】模拟肠道自主收缩运动。

核心参数：
• 蠕动速度 (peristalsisSpeed)：默认1.5×
  - 控制蠕动基础强度
  - 范围 0.3–6.0
• 蠕动波幅 (peristalsisWaveAmplitude)：默认0.65
  - 控制每个节段收缩的幅度
  - 范围 0.0–1.5（值越大节段膨胀收缩越剧烈）
• 蠕动传导速度 (peristalsisWaveSpeed)：默认1.5×
  - 控制收缩波沿肠道传播的速度
  - 范围 0.2–4.0

实时修正：
• 泻药：临时大幅提升 peristalsisBase
• 兴奋剂：叠加 peristalsisModifier（持续至药效结束）

物理引擎中的应用：
  periScaleSmall[i] 和 periScaleLarge[i]
  代表每个节段当前的蠕动缩放系数
  由正弦波驱动，随时间周期性变化

调试建议：蠕动波幅=0 可完全关闭蠕动运动`,
  },
  {
    id: 'phys_constraint',
    title: '物理约束引擎',
    category: '物理引擎',
    content: `【物理约束系统】基于位置约束（PBD）的肠道动力学引擎。

核心参数：
• 小肠节段数：37段（N_SMALL=56节点）
• 大肠节段数：29段（N_LARGE=32节点）
• 小肠节段长：20 单位
• 大肠节段长：22 单位
• 物理刷新率：30 fps
• 约束迭代次数：8次/帧（PHYSICS_ITERATIONS）
• 阻尼系数：0.975（DAMPING）

约束类型：
1. 长度约束 (Segment Stiffness=0.85)：维持节段长度
2. 肠系膜约束 (Mesentery Stiffness=0.022)：将节点拉向腔壁参考点
3. 腔壁边界约束：防止节点超出椭圆腹腔范围
4. 工具碰撞约束：工具与肠节点的接触推力

腹腔椭圆：
  中心 (170, 248)，半径 X=148, Y=175

腔壁约束使节点保持在椭圆内，是系膜切断手术后
节点漂移现象的根本原因（失去系膜约束后只剩腔壁边界）

提示：约束迭代次数越多，模拟越精确但性能越低。`,
  },
];

const CATEGORIES = [...new Set(HELP_DATA.map(e => e.category))];

export function HelpScreen({ onMenuPress }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [selectedId, setSelectedId] = useState<string>(HELP_DATA[0].id);
  const topPad = Platform.OS === 'web' ? 16 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom;

  const selectedEntry = HELP_DATA.find(e => e.id === selectedId) ?? HELP_DATA[0];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad, backgroundColor: colors.headerBg, borderBottomColor: colors.border }]}>
        <TouchableOpacity style={styles.menuBtn} onPress={onMenuPress}>
          <Feather name="menu" size={20} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.foreground }]}>帮助</Text>
        <View style={styles.headerTag}>
          <Feather name="book-open" size={12} color={colors.mutedForeground} />
          <Text style={[styles.headerTagText, { color: colors.mutedForeground }]}>游戏手册</Text>
        </View>
      </View>

      <View style={styles.body}>
        {/* Left: entry list */}
        <View style={[styles.leftPanel, { borderRightColor: colors.border }]}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: bottomPad + 8 }}>
            {CATEGORIES.map(cat => (
              <View key={cat}>
                <Text style={[styles.catLabel, { color: colors.primary }]}>{cat}</Text>
                {HELP_DATA.filter(e => e.category === cat).map(entry => {
                  const active = selectedId === entry.id;
                  return (
                    <TouchableOpacity
                      key={entry.id}
                      style={[
                        styles.entryRow,
                        active && { backgroundColor: `${colors.primary}22` },
                      ]}
                      onPress={() => setSelectedId(entry.id)}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.entryIndicator, { backgroundColor: active ? colors.primary : 'transparent' }]} />
                      <Text
                        style={[
                          styles.entryTitle,
                          { color: active ? colors.primary : colors.foreground },
                        ]}
                        numberOfLines={2}
                      >
                        {entry.title}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
          </ScrollView>
        </View>

        {/* Right: detail view */}
        <View style={styles.rightPanel}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: bottomPad + 20 }}>
            <View style={[styles.detailHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.detailCat, { color: colors.mutedForeground }]}>{selectedEntry.category}</Text>
              <Text style={[styles.detailTitle, { color: colors.primary }]}>{selectedEntry.title}</Text>
            </View>
            <Text style={[styles.detailContent, { color: colors.foreground }]}>
              {selectedEntry.content}
            </Text>
          </ScrollView>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
  },
  menuBtn: { padding: 6, marginRight: 8 },
  title: { flex: 1, fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  headerTag: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  headerTagText: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  body: { flex: 1, flexDirection: 'row' },
  leftPanel: {
    width: 120,
    borderRightWidth: 1,
  },
  catLabel: {
    fontSize: 9,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    paddingHorizontal: 10,
    paddingTop: 12,
    paddingBottom: 4,
  },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 6,
    borderRadius: 6,
    marginHorizontal: 4,
    marginBottom: 1,
  },
  entryIndicator: {
    width: 2,
    height: '100%' as any,
    minHeight: 12,
    borderRadius: 1,
    marginRight: 6,
  },
  entryTitle: {
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
    flex: 1,
    lineHeight: 15,
  },
  rightPanel: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  detailHeader: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    marginBottom: 14,
  },
  detailCat: {
    fontSize: 9,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  detailTitle: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
    lineHeight: 24,
  },
  detailContent: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    lineHeight: 22,
  },
});
