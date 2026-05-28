import React from 'react';
import { View, Text, StyleSheet, ScrollView, useWindowDimensions } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { useGame } from '@/contexts/GameContext';
import { HeartRateMonitor } from './HeartRateMonitor';
import { CharacterStatusBadges } from './CharacterStatusBadges';

interface StatRowProps {
  label: string;
  value: string | number;
  color?: string;
  highlight?: boolean;
}

function StatRow({ label, value, color, highlight }: StatRowProps) {
  const colors = useColors();
  return (
    <View style={[styles.row, highlight && { backgroundColor: `${colors.secondary}` }]}>
      <Text style={[styles.label, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[styles.value, { color: color ?? colors.foreground }]}>{value}</Text>
    </View>
  );
}

interface BarRowProps {
  label: string;
  value: number;
  color: string;
  bgColor: string;
}

function BarRow({ label, value, color, bgColor }: BarRowProps) {
  const colors = useColors();
  return (
    <View style={styles.barRow}>
      <Text style={[styles.barLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <View style={[styles.barBg, { backgroundColor: bgColor }]}>
        <View style={[styles.barFill, { width: `${Math.round(value)}%` as any, backgroundColor: color }]} />
      </View>
      <Text style={[styles.barNum, { color }]}>{Math.round(value)}</Text>
    </View>
  );
}

export function AttributePanel() {
  const colors = useColors();
  const { state } = useGame();
  const { width } = useWindowDimensions();

  const ruptures = state.intestinalRuptures;
  const breaks = state.intestinalBreaks;
  const avgPressure = state.renderSmallSegs.length > 0
    ? state.renderSmallSegs.reduce((a, s) => a + s.pressure, 0) / state.renderSmallSegs.length : 0;
  const avgSensitivity = state.renderSmallSegs.length > 0
    ? state.renderSmallSegs.reduce((a, s) => a + s.sensitivity, 0) / state.renderSmallSegs.length : 0;
  const avgPain = state.renderSmallSegs.length > 0
    ? state.renderSmallSegs.reduce((a, s) => a + s.pain, 0) / state.renderSmallSegs.length : 0;

  const panelWidth = Math.max(140, width * 0.54 - 32);
  const ecgWidth = Math.min(panelWidth, 220);

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <Text style={[styles.sectionTitle, { color: colors.primary }]}>生命体征</Text>
      <BarRow label="生命值" value={state.hp} color={colors.hp} bgColor={colors.hpBg} />
      <BarRow label="快感值" value={state.pleasure} color={colors.pleasure} bgColor={colors.pleasureBg} />

      {/* ECG Heart Rate Monitor */}
      <View style={styles.ecgContainer}>
        <HeartRateMonitor
          heartRate={state.heartRate}
          comaState={state.comaState}
          width={ecgWidth}
          height={54}
          transparent={false}
          showLabel
        />
      </View>

      <View style={[styles.divider, { backgroundColor: colors.border }]} />

      {/* Character Status */}
      <CharacterStatusBadges
        comaState={state.comaState}
        heartRate={state.heartRate}
        hp={state.hp}
        ruptures={ruptures}
        breaks={breaks}
        heartRateModifier={state.heartRateModifier}
        avgPain={avgPain}
      />

      <View style={[styles.divider, { backgroundColor: colors.border }]} />
      <Text style={[styles.sectionTitle, { color: colors.primary }]}>身体状态</Text>

      <StatRow label="心率" value={`${state.heartRate} bpm`}
        color={state.heartRate > 130 ? colors.hp : state.heartRate < 50 ? '#4488ff' : colors.foreground} />
      <StatRow label="肚脐状态"
        value={state.navelPierced ? '已穿孔' : '正常'}
        color={state.navelPierced ? colors.primary : colors.mutedForeground} />
      <StatRow label="肠穿孔数" value={`${ruptures} 处`}
        color={ruptures > 0 ? colors.hp : colors.mutedForeground}
        highlight={ruptures > 0} />
      <StatRow label="肠管断裂" value={`${breaks} 处`}
        color={breaks > 0 ? colors.hp : colors.mutedForeground}
        highlight={breaks > 0} />

      <View style={[styles.divider, { backgroundColor: colors.border }]} />
      <Text style={[styles.sectionTitle, { color: colors.primary }]}>肠道平均状态</Text>

      <BarRow label="敏感度" value={avgSensitivity} color={colors.pleasure} bgColor={`${colors.pleasure}22`} />
      <BarRow label="疼痛值" value={avgPain} color={colors.hp} bgColor={colors.hpBg} />
      <BarRow label="压力值" value={avgPressure} color="#4488ff" bgColor="#000022" />

      <View style={[styles.divider, { backgroundColor: colors.border }]} />
      <Text style={[styles.sectionTitle, { color: colors.primary }]}>肠道健康</Text>

      {state.renderSmallSegs.slice(0, 8).map((seg, i) => (
        <View key={i} style={styles.segRow}>
          <Text style={[styles.segLabel, { color: colors.mutedForeground }]}>小肠段 {i + 1}</Text>
          <View style={styles.segBars}>
            <View style={[styles.miniBar, { width: seg.health * 0.5, backgroundColor: '#00cc44' }]} />
            <View style={[styles.miniBar, { width: seg.pain * 0.5, backgroundColor: '#cc2020', marginTop: 2 }]} />
          </View>
          {seg.broken && <Text style={[styles.brokenTag, { color: colors.hp }]}>断裂</Text>}
          {seg.ruptured && !seg.broken && <Text style={[styles.brokenTag, { color: colors.pleasure }]}>穿孔</Text>}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 16 },
  sectionTitle: {
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 8,
    marginTop: 4,
  },
  divider: { height: 1, marginVertical: 12 },
  ecgContainer: {
    marginTop: 8,
    marginBottom: 4,
    borderRadius: 4,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 4,
    marginBottom: 2,
  },
  label: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  value: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: 8,
  },
  barLabel: { fontSize: 11, fontFamily: 'Inter_400Regular', width: 52 },
  barBg: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 3, minWidth: 2 },
  barNum: { fontSize: 10, fontFamily: 'Inter_600SemiBold', width: 24, textAlign: 'right' },
  segRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 3,
    gap: 8,
  },
  segLabel: { fontSize: 10, fontFamily: 'Inter_400Regular', width: 52 },
  segBars: { flex: 1, gap: 2 },
  miniBar: { height: 3, borderRadius: 2, minWidth: 2 },
  brokenTag: {
    fontSize: 9,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.5,
  },
});
