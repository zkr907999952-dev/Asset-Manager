import React from 'react';
import { View, Text, StyleSheet, ScrollView, useWindowDimensions } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { useGame } from '@/contexts/GameContext';
import { HeartRateMonitor } from './HeartRateMonitor';
import { CharacterStatusBadges } from './CharacterStatusBadges';
import type { RenderSegment } from '@/contexts/GameContext';

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

function healthColor(h: number): string {
  if (h >= 80) return '#22cc55';
  if (h >= 50) return '#ccaa22';
  if (h >= 20) return '#cc5522';
  return '#cc2222';
}

function segBgColor(seg: RenderSegment): string {
  if (seg.broken) return '#cc2244';
  if (seg.ruptured) return '#cc6622';
  if (seg.perforated) return '#cc9922';
  return healthColor(seg.health);
}

interface SegmentMapProps {
  segs: RenderSegment[];
  label: string;
  accentColor: string;
}

function SegmentMap({ segs, label, accentColor }: SegmentMapProps) {
  const colors = useColors();
  const COLS = 16;
  const rows: RenderSegment[][] = [];
  for (let i = 0; i < segs.length; i += COLS) {
    rows.push(segs.slice(i, i + COLS));
  }

  const avgHealth = segs.length > 0
    ? Math.round(segs.reduce((a, s) => a + s.health, 0) / segs.length)
    : 100;
  const broken = segs.filter(s => s.broken).length;
  const ruptured = segs.filter(s => s.ruptured && !s.broken).length;
  const perforated = segs.filter(s => s.perforated && !s.ruptured && !s.broken).length;

  return (
    <View style={styles.segMapContainer}>
      <View style={styles.segMapHeader}>
        <Text style={[styles.segMapTitle, { color: accentColor }]}>{label}</Text>
        <View style={styles.segMapMeta}>
          <Text style={[styles.segMapAvg, { color: healthColor(avgHealth) }]}>均值 {avgHealth}</Text>
          {broken > 0 && (
            <Text style={[styles.segMapTag, { color: '#cc2244', borderColor: '#cc224455' }]}>断裂×{broken}</Text>
          )}
          {ruptured > 0 && (
            <Text style={[styles.segMapTag, { color: '#cc6622', borderColor: '#cc662255' }]}>穿孔×{ruptured}</Text>
          )}
          {perforated > 0 && (
            <Text style={[styles.segMapTag, { color: '#cc9922', borderColor: '#cc992255' }]}>针孔×{perforated}</Text>
          )}
        </View>
      </View>

      {rows.map((rowSegs, rowIdx) => (
        <View key={rowIdx} style={styles.segMapRow}>
          {rowSegs.map((seg, colIdx) => {
            const globalIdx = rowIdx * COLS + colIdx;
            const bg = segBgColor(seg);
            const painAlpha = Math.round(seg.pain * 0.6).toString(16).padStart(2, '0');
            return (
              <View key={globalIdx} style={[styles.segCell, { backgroundColor: bg }]}>
                <View style={[styles.segPainOverlay, { backgroundColor: `#cc0000${painAlpha}` }]} />
                <View style={[styles.segHealthBar, {
                  height: Math.round(seg.health / 100 * 10),
                  backgroundColor: '#ffffff44',
                }]} />
              </View>
            );
          })}
          <Text style={[styles.segRowNum, { color: colors.mutedForeground }]}>
            {rowIdx * COLS + 1}–{Math.min((rowIdx + 1) * COLS, segs.length)}
          </Text>
        </View>
      ))}
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
      <StatRow label="小肠移植次数" value={`${state.smallTransplantCount} 次`}
        color={state.smallTransplantCount > 0 ? colors.pleasure : colors.mutedForeground} />
      <StatRow label="大肠移植次数" value={`${state.largeTransplantCount} 次`}
        color={state.largeTransplantCount > 0 ? colors.pleasure : colors.mutedForeground} />

      <View style={[styles.divider, { backgroundColor: colors.border }]} />
      <Text style={[styles.sectionTitle, { color: colors.primary }]}>肠道平均状态</Text>

      <BarRow label="敏感度" value={avgSensitivity} color={colors.pleasure} bgColor={`${colors.pleasure}22`} />
      <BarRow label="疼痛值" value={avgPain} color={colors.hp} bgColor={colors.hpBg} />
      <BarRow label="压力值" value={avgPressure} color="#4488ff" bgColor="#000022" />

      <View style={[styles.divider, { backgroundColor: colors.border }]} />
      <Text style={[styles.sectionTitle, { color: colors.primary }]}>肠道健康</Text>

      <View style={[styles.legendRow]}>
        {([
          ['#22cc55', '健康'],
          ['#ccaa22', '受损'],
          ['#cc5522', '危险'],
          ['#cc2244', '断裂'],
          ['#cc6622', '穿孔'],
        ] as [string, string][]).map(([c, l]) => (
          <View key={l} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: c }]} />
            <Text style={[styles.legendText, { color: colors.mutedForeground }]}>{l}</Text>
          </View>
        ))}
      </View>

      <SegmentMap
        segs={state.renderSmallSegs}
        label={`小肠  ${state.renderSmallSegs.length} 段`}
        accentColor="#88ddaa"
      />

      <View style={{ height: 10 }} />

      <SegmentMap
        segs={state.renderLargeSegs}
        label={`大肠  ${state.renderLargeSegs.length} 段`}
        accentColor="#ddaa55"
      />

      <View style={{ height: 16 }} />
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
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  legendDot: {
    width: 7,
    height: 7,
    borderRadius: 2,
  },
  legendText: {
    fontSize: 9,
    fontFamily: 'Inter_400Regular',
  },
  segMapContainer: {
    marginBottom: 4,
  },
  segMapHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  segMapTitle: {
    fontSize: 10,
    fontFamily: 'Inter_600SemiBold',
  },
  segMapMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  segMapAvg: {
    fontSize: 9,
    fontFamily: 'Inter_600SemiBold',
  },
  segMapTag: {
    fontSize: 8,
    fontFamily: 'Inter_700Bold',
    borderWidth: 1,
    borderRadius: 3,
    paddingHorizontal: 3,
    paddingVertical: 1,
  },
  segMapRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 2,
    gap: 2,
  },
  segCell: {
    width: 14,
    height: 14,
    borderRadius: 2,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  segPainOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  segHealthBar: {
    width: '100%',
    borderRadius: 1,
  },
  segRowNum: {
    fontSize: 8,
    fontFamily: 'Inter_400Regular',
    marginLeft: 3,
    opacity: 0.6,
  },
});
