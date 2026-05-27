import React from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, Switch, StyleSheet, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useGame } from '@/contexts/GameContext';
import { GameSlider } from '@/components/GameSlider';

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
    state,
    setDebugMode, setShowCollisionBoxes,
    setPeriSpeed, setBreathAmplitude, setExpansionScale, setPressureDiffusionRate,
  } = useGame();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom;

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
        {/* Simulation parameters */}
        <Text style={[styles.sectionTitle, { color: colors.primary }]}>模拟参数</Text>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <SliderRow
            label="蠕动速度"
            value={state.peristalsisSpeed}
            displayValue={`${state.peristalsisSpeed.toFixed(1)}×`}
            min={0.3} max={3.0} step={0.1}
            onValueChange={setPeriSpeed}
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

        {/* Debug section */}
        <Text style={[styles.sectionTitle, { color: colors.primary }]}>调试模式</Text>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <ToggleRow
            label="调试模式"
            description="显示每个肠段的四项属性数值色条"
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
            { label: '物理刷新率', value: '30 fps' },
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
            v1.1 · 腹腔物理仿真引擎{'\n'}
            基于位置约束的肠道动力学模拟{'\n'}
            大肠容积180·小肠容积100·差异化破裂阈值
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
  aboutCard: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  aboutTitle: { fontSize: 16, fontFamily: 'Inter_700Bold', marginBottom: 8 },
  aboutText: { fontSize: 12, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 20 },
});
