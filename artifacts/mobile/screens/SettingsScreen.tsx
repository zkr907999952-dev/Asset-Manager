import React, { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, Switch, StyleSheet, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useGame } from '@/contexts/GameContext';
import { GameSlider } from '@/components/GameSlider';
import { N_SMALL, N_LARGE } from '@/constants/gameConfig';
import { APP_VERSION } from '@/constants/version';
import {
  getDefaultMesenteryConfig,
  saveMesenteryConfig,
  applyMesenteryConfig,
  savePreset,
  PRESET_COUNT,
} from '../engine/mesenteryConfig';

interface Props {
  onMenuPress: () => void;
}

interface ToggleRowProps {
  label: string;
  description: string;
  value: boolean;
  onToggle: (v: boolean) => void;
  color?: string;
}

function ToggleRow({ label, description, value, onToggle, color }: ToggleRowProps) {
  const colors = useColors();
  return (
    <View style={styles.toggleRow}>
      <View style={styles.toggleText}>
        <Text style={[styles.toggleLabel, { color: colors.foreground }]}>{label}</Text>
        <Text style={[styles.toggleDesc, { color: colors.mutedForeground }]}>{description}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: colors.secondary, true: color ?? colors.primary }}
        thumbColor={value ? '#ffffff' : colors.mutedForeground}
      />
    </View>
  );
}

interface SliderRowProps {
  label: string;
  value: number;
  displayValue: string;
  min: number;
  max: number;
  step: number;
  onValueChange: (v: number) => void;
  trackColor?: string;
}

function SliderRow({ label, value, displayValue, min, max, step, onValueChange, trackColor }: SliderRowProps) {
  const colors = useColors();
  return (
    <View style={styles.sliderBlock}>
      <View style={styles.sliderHeader}>
        <Text style={[styles.sliderLabel, { color: colors.foreground }]}>{label}</Text>
        <Text style={[styles.sliderValue, { color: trackColor ?? colors.primary }]}>{displayValue}</Text>
      </View>
      <GameSlider
        value={value}
        minimumValue={min}
        maximumValue={max}
        step={step}
        onValueChange={onValueChange}
        minimumTrackTintColor={trackColor ?? colors.primary}
        maximumTrackTintColor={colors.secondary}
        thumbTintColor={trackColor ?? colors.primary}
      />
    </View>
  );
}

export function SettingsScreen({ onMenuPress }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const {
    state, setScreen,
    setDebugMode, setShowCollisionBoxes, setPhysicsFps,
    setPeriSpeed, setPeriWaveAmplitude, setPeriWaveSpeed,
    setBreathAmplitude, setExpansionScale, setPressureDiffusionRate,
    setDrugDuration, setHatchDuration, setParasiteDamageInterval, setParasitePerforationChance,
    setMaxResectionSegments,
    setBellyStrikeImpulseScale, setBellyStrikeToolPower,
    setTouchOffsetY,
    physicsRef,
  } = useGame();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom;
  const [resetStatus, setResetStatus] = useState<'idle' | 'confirm' | 'saving' | 'done'>('idle');

  const handleResetMesentery = useCallback(() => {
    setResetStatus('confirm');
  }, []);

  const handleResetConfirm = useCallback(async () => {
    setResetStatus('saving');
    const defaults = getDefaultMesenteryConfig();
    applyMesenteryConfig(physicsRef.current, defaults);
    try {
      await Promise.all(
        Array.from({ length: PRESET_COUNT }, (_, i) => savePreset(i, defaults))
      );
      setResetStatus('done');
      setTimeout(() => setResetStatus('idle'), 2500);
    } catch {
      setResetStatus('idle');
    }
  }, [physicsRef]);

  const handleResetCancel = useCallback(() => {
    setResetStatus('idle');
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad, backgroundColor: colors.headerBg, borderBottomColor: colors.border }]}>
        <TouchableOpacity style={styles.menuBtn} onPress={onMenuPress}>
          <Feather name="menu" size={20} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.foreground }]}>设置</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: bottomPad + 20 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Touch control settings */}
        <Text style={[styles.sectionTitle, { color: colors.primary }]}>操控设置</Text>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <SliderRow
            label="触摸点垂直偏移"
            value={state.touchOffsetY}
            displayValue={`${state.touchOffsetY > 0 ? '+' : ''}${state.touchOffsetY} px`}
            min={-150} max={150} step={5}
            onValueChange={setTouchOffsetY}
            trackColor={colors.toolActive}
          />
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>说明</Text>
            <Text style={[{ fontSize: 11, fontFamily: 'Inter_400Regular', flex: 1, textAlign: 'right' }, { color: colors.mutedForeground }]}>
              正值使实际操作点在手指上方，负值在下方
            </Text>
          </View>
        </View>

        {/* Simulation parameters */}
        <Text style={[styles.sectionTitle, { color: colors.primary }]}>模拟参数</Text>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <SliderRow
            label="蠕动速度"
            value={state.peristalsisSpeed}
            displayValue={`${state.peristalsisSpeed.toFixed(1)}×`}
            min={0.3} max={6.0} step={0.1}
            onValueChange={setPeriSpeed}
            trackColor={colors.primary}
          />
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <SliderRow
            label="蠕动波幅"
            value={state.peristalsisWaveAmplitude}
            displayValue={state.peristalsisWaveAmplitude.toFixed(2)}
            min={0.0} max={1.5} step={0.01}
            onValueChange={setPeriWaveAmplitude}
            trackColor={colors.primary}
          />
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <SliderRow
            label="蠕动传导速度"
            value={state.peristalsisWaveSpeed}
            displayValue={`${state.peristalsisWaveSpeed.toFixed(1)}×`}
            min={0.2} max={4.0} step={0.1}
            onValueChange={setPeriWaveSpeed}
            trackColor={colors.primary}
          />
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <SliderRow
            label="呼吸幅度"
            value={state.breathAmplitude}
            displayValue={state.breathAmplitude.toFixed(1)}
            min={0.2} max={3.0} step={0.1}
            onValueChange={setBreathAmplitude}
            trackColor={colors.pleasure}
          />
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <SliderRow
            label="膨胀系数"
            value={state.expansionScale}
            displayValue={state.expansionScale.toFixed(1)}
            min={0.0} max={4.0} step={0.1}
            onValueChange={setExpansionScale}
            trackColor={colors.hp}
          />
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <SliderRow
            label="压力扩散速度"
            value={state.pressureDiffusionRate}
            displayValue={state.pressureDiffusionRate.toFixed(3)}
            min={0.001} max={0.02} step={0.001}
            onValueChange={setPressureDiffusionRate}
            trackColor={colors.syringeColor ?? '#60c0c0'}
          />
        </View>

        {/* Drug system */}
        <Text style={[styles.sectionTitle, { color: colors.primary }]}>药剂系统</Text>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <SliderRow
            label="药效持续时间"
            value={state.drugDurationSec}
            displayValue={`${Math.round(state.drugDurationSec)}秒`}
            min={30} max={300} step={10}
            onValueChange={setDrugDuration}
            trackColor="#ffaa00"
          />
        </View>

        {/* Parasite system */}
        <Text style={[styles.sectionTitle, { color: colors.primary }]}>寄生虫系统</Text>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <SliderRow
            label="虫卵孵化时间"
            value={state.hatchDurationSec}
            displayValue={`${Math.round(state.hatchDurationSec)}秒`}
            min={3} max={60} step={1}
            onValueChange={setHatchDuration}
            trackColor="#88cc66"
          />
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <SliderRow
            label="寄生虫造伤间隔"
            value={state.parasiteDamageIntervalSec}
            displayValue={`${Math.round(state.parasiteDamageIntervalSec)}秒`}
            min={4} max={60} step={1}
            onValueChange={setParasiteDamageInterval}
            trackColor="#cc6644"
          />
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <SliderRow
            label="肠穿孔概率"
            value={state.parasitePerforationChance}
            displayValue={`${Math.round(state.parasitePerforationChance * 100)}%`}
            min={0} max={1} step={0.01}
            onValueChange={setParasitePerforationChance}
            trackColor="#cc4444"
          />
        </View>

        {/* Belly strike power */}
        <Text style={[styles.sectionTitle, { color: colors.primary }]}>腹击威力</Text>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <SliderRow
            label="物理推力"
            value={state.bellyStrikeImpulseScale ?? 100}
            displayValue={`${state.bellyStrikeImpulseScale ?? 100}%`}
            min={20} max={600} step={5}
            onValueChange={setBellyStrikeImpulseScale}
            trackColor="#e07030"
          />
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <View style={styles.subLabel}>
            <Text style={[styles.subLabelText, { color: colors.mutedForeground }]}>工具威力倍数</Text>
          </View>
          {(['拳头', '棒球棒', '撞钟锤'] as const).map((toolId, idx) => {
            const pwr = (state.bellyStrikeToolPowers ?? {})[toolId] ?? 100;
            return (
              <View key={toolId}>
                {idx > 0 && <View style={[styles.divider, { backgroundColor: colors.border }]} />}
                <SliderRow
                  label={toolId}
                  value={pwr}
                  displayValue={`${pwr}%`}
                  min={10} max={400} step={10}
                  onValueChange={v => setBellyStrikeToolPower(toolId, v)}
                  trackColor="#e07030"
                />
              </View>
            );
          })}
        </View>

        {/* Resection system */}
        <Text style={[styles.sectionTitle, { color: colors.primary }]}>肠段切除</Text>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <SliderRow
            label="最大切除段数"
            value={state.maxResectionSegments}
            displayValue={`${state.maxResectionSegments} 段`}
            min={1} max={12} step={1}
            onValueChange={setMaxResectionSegments}
            trackColor="#cc3333"
          />
        </View>

        {/* Debug section */}
        <Text style={[styles.sectionTitle, { color: colors.primary }]}>调试模式</Text>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <ToggleRow
            label="调试模式"
            description="显示每个肠段的四项属性数值色条及实时 FPS"
            value={state.debugMode}
            onToggle={setDebugMode}
            color={colors.pleasure}
          />
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <ToggleRow
            label="碰撞箱显示"
            description="显示所有物理模块的碰撞体积线框"
            value={state.showCollisionBoxes}
            onToggle={setShowCollisionBoxes}
            color={colors.toolActive}
          />
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <SliderRow
            label="物理模拟帧率"
            value={state.physicsFps}
            displayValue={`${state.physicsFps} fps`}
            min={10} max={60} step={5}
            onValueChange={setPhysicsFps}
            trackColor={colors.pleasure}
          />
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <TouchableOpacity
            style={styles.editorBtn}
            onPress={() => setScreen('mesenteryEditor')}
          >
            <View style={styles.editorBtnContent}>
              <View style={{ flex: 1, flexShrink: 1, marginRight: 8 }}>
                <Text style={[styles.editorBtnLabel, { color: colors.foreground }]}>肠系膜编辑模式</Text>
                <Text style={[styles.editorBtnDesc, { color: colors.mutedForeground }]} numberOfLines={2}>
                  编辑大/小肠各节点的肠系膜初始坐标（{N_LARGE + N_SMALL} 节点），可保存至配置文件
                </Text>
              </View>
              <Feather name="edit-3" size={16} color={colors.primary} />
            </View>
          </TouchableOpacity>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          {resetStatus === 'confirm' ? (
            <View style={styles.editorBtn}>
              <Text style={[styles.editorBtnLabel, { color: '#cc4444', marginBottom: 4 }]}>
                确认要重置肠系膜数据？
              </Text>
              <Text style={[styles.editorBtnDesc, { color: colors.mutedForeground, marginBottom: 8 }]}>
                将用内置预设覆盖已保存配置，并立即更新物理引擎，此操作不可撤销。
              </Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity
                  style={[styles.confirmBtn, { backgroundColor: '#3a1a1a', flex: 1 }]}
                  onPress={handleResetCancel}
                >
                  <Text style={styles.confirmBtnText}>取消</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.confirmBtn, { backgroundColor: '#cc4444', flex: 1 }]}
                  onPress={handleResetConfirm}
                >
                  <Text style={styles.confirmBtnText}>确认重置</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.editorBtn}
              onPress={handleResetMesentery}
              disabled={resetStatus === 'saving'}
            >
              <View style={styles.editorBtnContent}>
                <View style={{ flex: 1, flexShrink: 1, marginRight: 8 }}>
                  <Text style={[styles.editorBtnLabel, { color: resetStatus === 'done' ? '#44cc88' : '#cc4444' }]}>
                    {resetStatus === 'done' ? '重置完成 ✓' : resetStatus === 'saving' ? '重置中…' : '重置肠系膜数据'}
                  </Text>
                  <Text style={[styles.editorBtnDesc, { color: colors.mutedForeground }]} numberOfLines={2}>
                    用内置原始预设覆盖已保存的配置文件，并立即更新物理引擎
                  </Text>
                </View>
                <Feather name="rotate-ccw" size={16} color="#cc4444" />
              </View>
            </TouchableOpacity>
          )}
        </View>

        {state.debugMode && (
          <View style={[styles.legendCard, { backgroundColor: `${colors.card}cc`, borderColor: colors.border }]}>
            <Text style={[styles.legendTitle, { color: colors.mutedForeground }]}>调试色条说明</Text>
            {[
              { color: '#00cc44', label: '健康值' },
              { color: '#cc00cc', label: '敏感度' },
              { color: '#cc0000', label: '疼痛值' },
              { color: '#0088ff', label: '压力值' },
            ].map(({ color, label }) => (
              <View key={label} style={styles.legendRow}>
                <View style={[styles.legendDot, { backgroundColor: color }]} />
                <Text style={[styles.legendText, { color: colors.foreground }]}>{label}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Physics info */}
        <Text style={[styles.sectionTitle, { color: colors.primary }]}>物理参数</Text>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {[
            { label: '小肠节段数', value: '37 段' },
            { label: '大肠节段数', value: '29 段' },
            { label: '小肠爆破压力', value: '100' },
            { label: '大肠爆破压力', value: '180' },
            { label: '物理刷新率', value: `${state.physicsFps} fps (目标)` },
            { label: '约束迭代次数', value: '8 次/帧' },
            { label: '当前蠕动速度', value: `${state.peristalsisSpeed.toFixed(1)}×` },
          ].map(({ label, value }) => (
            <View key={label} style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>{label}</Text>
              <Text style={[styles.infoValue, { color: colors.foreground }]}>{value}</Text>
            </View>
          ))}
        </View>

        {/* Game info */}
        <Text style={[styles.sectionTitle, { color: colors.primary }]}>当前状态</Text>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {[
            { label: '生命值', value: `${Math.round(state.hp)} / 100` },
            { label: '快感值', value: `${Math.round(state.pleasure)} / 100` },
            { label: '心率', value: `${state.heartRate} bpm` },
            { label: '肠穿孔数', value: `${state.intestinalRuptures} 处` },
            { label: '肠管断裂', value: `${state.intestinalBreaks} 处` },
            { label: '肚脐状态', value: state.navelPierced ? '已穿孔' : '正常' },
          ].map(({ label, value }) => (
            <View key={label} style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>{label}</Text>
              <Text style={[styles.infoValue, { color: colors.foreground }]}>{value}</Text>
            </View>
          ))}
        </View>

        {/* About */}
        <View style={[styles.aboutCard, { borderColor: colors.border }]}>
          <Text style={[styles.aboutTitle, { color: colors.primary }]}>玉腹模拟器</Text>
          <Text style={[styles.aboutText, { color: colors.mutedForeground }]}>
            {APP_VERSION} · 腹腔物理仿真引擎
          </Text>
        </View>
      </ScrollView>
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
  scroll: { flex: 1 },
  content: { padding: 16, gap: 8 },
  sectionTitle: {
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 6,
    marginTop: 4,
  },
  card: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 4,
    marginBottom: 14,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  toggleText: { flex: 1 },
  toggleLabel: { fontSize: 14, fontFamily: 'Inter_500Medium' },
  toggleDesc: { fontSize: 11, fontFamily: 'Inter_400Regular', marginTop: 2 },
  divider: { height: 1 },
  sliderBlock: {
    paddingVertical: 10,
  },
  sliderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  sliderLabel: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  sliderValue: { fontSize: 13, fontFamily: 'Inter_700Bold' },
  legendCard: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 12,
    marginBottom: 14,
    gap: 6,
  },
  legendTitle: { fontSize: 10, fontFamily: 'Inter_600SemiBold', marginBottom: 4 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  legendDot: { width: 12, height: 6, borderRadius: 3 },
  legendText: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  infoLabel: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  infoValue: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  subLabel: { paddingVertical: 6 },
  subLabelText: { fontSize: 10, fontFamily: 'Inter_600SemiBold', letterSpacing: 0.6, textTransform: 'uppercase' },
  aboutCard: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  aboutTitle: { fontSize: 16, fontFamily: 'Inter_700Bold', marginBottom: 8 },
  aboutText: { fontSize: 12, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 20 },
  editorBtn: {
    paddingVertical: 12,
  },
  editorBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  editorBtnLabel: { fontSize: 14, fontFamily: 'Inter_500Medium', marginBottom: 2 },
  editorBtnDesc: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  confirmBtn: {
    paddingVertical: 10, borderRadius: 6,
    alignItems: 'center', justifyContent: 'center',
  },
  confirmBtnText: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: '#ffffff' },
});
