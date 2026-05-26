import React, { useEffect, useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useGame } from '@/contexts/GameContext';
import { SimulationCanvas } from '@/components/SimulationCanvas';
import { ToolBar } from '@/components/ToolBar';
import { ToolControls } from '@/components/ToolControls';
import { StatusBars } from '@/components/StatusBars';
import { DialogueBox } from '@/components/DialogueBox';
import { stepPhysics } from '@/engine/physics';
import { PHYSICS_FPS } from '@/constants/gameConfig';

interface Props {
  onMenuPress: () => void;
}

export function SimulationScreen({ onMenuPress }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { state, physicsRef, syncFromPhysics, setViewMode, triggerDialogue } = useGame();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const frameCount = useRef(0);
  const canvasLayout = useRef<{ x: number; y: number; width: number; height: number } | null>(null);
  const lastDialogueTrigger = useRef<Record<string, number>>({});

  const checkDialogueTriggers = useCallback(() => {
    const p = physicsRef.current;
    const segs = p.smallSegs;
    const now = Date.now();
    const cooldown = 5000;

    const avgPressure = segs.reduce((a, s) => a + s.pressure, 0) / segs.length;
    const avgPain = segs.reduce((a, s) => a + s.pain, 0) / segs.length;
    const avgSens = segs.reduce((a, s) => a + s.sensitivity, 0) / segs.length;

    const tryTrigger = (key: string, fn: () => void, cd = cooldown) => {
      const last = lastDialogueTrigger.current[key] ?? 0;
      if (now - last > cd) {
        lastDialogueTrigger.current[key] = now;
        fn();
      }
    };

    if (avgPressure > 80) tryTrigger('crit_pressure', () => triggerDialogue('critical_pressure'), 4000);
    else if (avgPressure > 55) tryTrigger('high_pressure', () => triggerDialogue('high_pressure'), 5000);
    else if (avgPressure > 30) tryTrigger('med_pressure', () => triggerDialogue('medium_pressure'), 7000);
    else if (avgPressure > 10) tryTrigger('low_pressure', () => triggerDialogue('low_pressure'), 9000);

    if (avgPain > 60) tryTrigger('high_pain', () => triggerDialogue('pain_high'), 4500);
    else if (avgPain > 25) tryTrigger('low_pain', () => triggerDialogue('pain_low'), 6000);

    if (avgSens > 70) tryTrigger('high_sens', () => triggerDialogue('pleasure_high'), 4000);
    else if (avgSens > 40) tryTrigger('med_sens', () => triggerDialogue('pleasure_medium'), 6000);
    else if (avgSens > 15) tryTrigger('low_sens', () => triggerDialogue('pleasure_low'), 8000);

    const explosions = segs.filter(s => s.ruptured).length;
    if (explosions > 0) tryTrigger('explosion', () => triggerDialogue('explosion'), 3000);
    const breaks = segs.filter(s => s.broken).length;
    if (breaks > 0) tryTrigger('break', () => triggerDialogue('intestine_break'), 3000);
  }, [triggerDialogue]);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      const p = physicsRef.current;
      p.peristalsisBase = state.peristalsisSpeed;
      stepPhysics(p);
      frameCount.current++;
      if (frameCount.current % 2 === 0) {
        syncFromPhysics();
      }
      if (frameCount.current % 30 === 0) {
        checkDialogueTriggers();
      }
    }, 1000 / PHYSICS_FPS);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [state.peristalsisSpeed]);

  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad, backgroundColor: colors.headerBg, borderBottomColor: colors.border }]}>
        <TouchableOpacity style={styles.menuBtn} onPress={onMenuPress}>
          <Feather name="menu" size={20} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.foreground }]}>腹部交互</Text>
        <TouchableOpacity
          style={[styles.viewToggle, {
            backgroundColor: state.viewMode === 'internal' ? colors.primary : colors.secondary,
            borderColor: colors.border,
          }]}
          onPress={() => setViewMode(state.viewMode === 'internal' ? 'external' : 'internal')}
        >
          <Text style={[styles.viewToggleText, {
            color: state.viewMode === 'internal' ? colors.primaryForeground : colors.mutedForeground,
          }]}>
            {state.viewMode === 'internal' ? '腹腔内' : '外部'}
          </Text>
          <Feather
            name={state.viewMode === 'internal' ? 'eye' : 'layers'}
            size={11}
            color={state.viewMode === 'internal' ? colors.primaryForeground : colors.mutedForeground}
          />
        </TouchableOpacity>
      </View>

      {/* Main simulation canvas */}
      <View style={styles.canvasArea}>
        <SimulationCanvas
          canvasLayout={canvasLayout.current}
          onLayout={layout => { canvasLayout.current = layout; }}
        />
        {/* Status bars overlay */}
        <StatusBars hp={state.hp} pleasure={state.pleasure} />
        {/* Tool bar overlay */}
        <ToolBar />
      </View>

      {/* Dialogue + tool controls */}
      <View style={[styles.bottomArea, { backgroundColor: colors.background }]}>
        <DialogueBox dialogue={state.currentDialogue} />
        <ToolControls />
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
  menuBtn: {
    padding: 6,
    marginRight: 8,
  },
  title: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
  },
  viewToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    gap: 4,
  },
  viewToggleText: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
  },
  canvasArea: {
    flex: 1,
    position: 'relative',
  },
  bottomArea: {
    maxHeight: 200,
  },
});
