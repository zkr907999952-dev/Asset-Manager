import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Slider from '@react-native-community/slider';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useGame } from '@/contexts/GameContext';
import { createInitialPhysicsState } from '@/engine/intestineInit';

interface Props {
  onMenuPress: () => void;
}

interface SliderItemProps {
  label: string;
  value: number;
  min: number;
  max: number;
  unit?: string;
  color?: string;
  onChange: (v: number) => void;
}

function SliderItem({ label, value, min, max, unit = '', color, onChange }: SliderItemProps) {
  const colors = useColors();
  const c = color ?? colors.primary;
  return (
    <View style={styles.sliderItem}>
      <View style={styles.sliderHeader}>
        <Text style={[styles.sliderLabel, { color: colors.foreground }]}>{label}</Text>
        <Text style={[styles.sliderValue, { color: c }]}>
          {Number.isInteger(value) ? value : value.toFixed(1)}{unit}
        </Text>
      </View>
      <Slider
        style={styles.slider}
        minimumValue={min}
        maximumValue={max}
        value={value}
        step={max > 10 ? 1 : 0.1}
        onValueChange={onChange}
        minimumTrackTintColor={c}
        maximumTrackTintColor={colors.secondary}
        thumbTintColor={c}
      />
      <View style={[styles.sliderTrackLabel, {}]}>
        <Text style={[styles.trackEnd, { color: colors.mutedForeground }]}>{min}</Text>
        <Text style={[styles.trackEnd, { color: colors.mutedForeground }]}>{max}</Text>
      </View>
    </View>
  );
}

export function ConsoleScreen({ onMenuPress }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { state, setPeriSpeed, physicsRef, syncFromPhysics } = useGame();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom;

  const resetPhysics = () => {
    const fresh = createInitialPhysicsState();
    const p = physicsRef.current;
    p.smallNodes = fresh.smallNodes;
    p.largeNodes = fresh.largeNodes;
    p.smallSegs = fresh.smallSegs;
    p.largeSegs = fresh.largeSegs;
    p.electrodes = [];
    syncFromPhysics();
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad, backgroundColor: colors.headerBg, borderBottomColor: colors.border }]}>
        <TouchableOpacity style={styles.menuBtn} onPress={onMenuPress}>
          <Feather name="menu" size={20} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.foreground }]}>控制台</Text>
        <TouchableOpacity
          style={[styles.resetBtn, { borderColor: colors.border }]}
          onPress={resetPhysics}
        >
          <Feather name="refresh-ccw" size={13} color={colors.mutedForeground} />
          <Text style={[styles.resetText, { color: colors.mutedForeground }]}>重置</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: bottomPad + 20 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.sectionTitle, { color: colors.primary }]}>肠道参数</Text>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <SliderItem
            label="蠕动速度"
            value={state.peristalsisSpeed}
            min={0}
            max={3}
            color={colors.primary}
            onChange={setPeriSpeed}
          />
        </View>

        <Text style={[styles.sectionTitle, { color: colors.primary }]}>工具默认参数</Text>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <SliderItem
            label="金属棒长度"
            value={state.toolParam1}
            min={0}
            max={100}
            unit=" mm"
            color={colors.toolColor}
            onChange={() => {}}
          />
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <SliderItem
            label="振动器强度"
            value={state.toolParam1}
            min={0}
            max={100}
            unit="%"
            color={colors.pleasure ?? '#b060c0'}
            onChange={() => {}}
          />
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <SliderItem
            label="长针刺入深度"
            value={state.toolParam2}
            min={0}
            max={100}
            unit=" mm"
            color={colors.needleColor ?? '#aaaaaa'}
            onChange={() => {}}
          />
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <SliderItem
            label="药剂注射剂量"
            value={state.toolParam1}
            min={0}
            max={100}
            unit=" mL"
            color={colors.syringeColor ?? '#60c0c0'}
            onChange={() => {}}
          />
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <SliderItem
            label="灌肠流速"
            value={state.toolParam1}
            min={0}
            max={100}
            unit=" mL/s"
            color={colors.enemaColor ?? '#4080ff'}
            onChange={() => {}}
          />
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <SliderItem
            label="电击电压"
            value={state.toolParam1}
            min={0}
            max={100}
            unit=" V"
            color={colors.electricColor ?? '#ffff60'}
            onChange={() => {}}
          />
        </View>

        <Text style={[styles.sectionTitle, { color: colors.primary }]}>快速状态操作</Text>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: `${colors.hp}22`, borderColor: colors.hp }]}
              onPress={() => {
                physicsRef.current.smallSegs.forEach(s => {
                  s.health = Math.min(100, s.health + 30);
                  s.pain = Math.max(0, s.pain - 20);
                  s.pressure = Math.max(0, s.pressure - 30);
                });
                physicsRef.current.largeSegs.forEach(s => {
                  s.health = Math.min(100, s.health + 30);
                });
              }}
            >
              <Text style={[styles.actionText, { color: colors.hp }]}>恢复肠道</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: `${colors.pleasure}22`, borderColor: colors.pleasure }]}
              onPress={() => {
                physicsRef.current.smallSegs.forEach(s => {
                  s.pain = 0; s.sensitivity = 0; s.pressure = 0;
                });
              }}
            >
              <Text style={[styles.actionText, { color: colors.pleasure }]}>清除状态</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: `${colors.primary}22`, borderColor: colors.primary }]}
              onPress={resetPhysics}
            >
              <Text style={[styles.actionText, { color: colors.primary }]}>完全重置</Text>
            </TouchableOpacity>
          </View>
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
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
  },
  resetText: { fontSize: 11, fontFamily: 'Inter_400Regular' },
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
    paddingVertical: 8,
    marginBottom: 14,
  },
  sliderItem: { paddingVertical: 6 },
  sliderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sliderLabel: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  sliderValue: { fontSize: 13, fontFamily: 'Inter_700Bold' },
  slider: { height: 30, marginHorizontal: -4 },
  sliderTrackLabel: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: -4,
  },
  trackEnd: { fontSize: 9, fontFamily: 'Inter_400Regular' },
  divider: { height: 1, marginVertical: 4 },
  actionRow: { flexDirection: 'row', gap: 8, paddingVertical: 8 },
  actionBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  actionText: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
});
