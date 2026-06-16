import React, { useEffect, useRef, useCallback, useState } from 'react';
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
import { HeartRateMonitor } from '@/components/HeartRateMonitor';
import { CharacterStatusBadges } from '@/components/CharacterStatusBadges';
import { HookActionBar } from '@/components/HookActionBar';
import { stepPhysics } from '@/engine/physics';

interface Props {
  onMenuPress: () => void;
}

export function SimulationScreen({ onMenuPress }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const {
    state, physicsRef, syncFromPhysics, setViewMode,
    triggerDialogue, resetPhysics, clearComaByShock, renderSnapshotRef,
  } = useGame();
  const rafRef = useRef<number | null>(null);
  const frameCount = useRef(0);
  const fpsCountRef = useRef(0);
  const fpsLastMsRef = useRef(performance.now());
  const peristalsisSpeedRef = useRef(state.peristalsisSpeed);
  const peristalsisModifierRef = useRef(state.peristalsisModifier);
  const [actualFps, setActualFps] = useState(0);
  const [canvasLayout, setCanvasLayout] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const lastDialogueTrigger = useRef<Record<string, number>>({});

  const avgPain = renderSnapshotRef.current.avgPain;

  const checkDialogueTriggers = useCallback(() => {
    const p = physicsRef.current;
    const segs = p.smallSegs;
    const now = Date.now();
    const cooldown = 5000;

    const avgPressure = segs.reduce((a, s) => a + s.pressure, 0) / segs.length;
    const avgPainVal = segs.reduce((a, s) => a + s.pain, 0) / segs.length;
    const avgSens = segs.reduce((a, s) => a + s.sensitivity, 0) / segs.length;

    const tryTrigger = (key: string, fn: () => void, cd = cooldown) => {
      const last = lastDialogueTrigger.current[key] ?? 0;
      if (now - last > cd) {
        lastDialogueTrigger.current[key] = now;
        fn();
      }
    };

    const elecActive = (p.toolType === '电击器' && p.toolActive && p.electrodes.length > 0)
      || (p.toolStates['电击器']?.active && p.electrodes.length > 0);
    const voltage = p.toolType === '电击器' && p.toolActive ? p.toolParam1 : (p.toolStates['电击器']?.param1 ?? 0);
    if (state.comaState !== 'none') {
      if (avgPainVal > 65 || (elecActive && voltage > 55)) {
        tryTrigger('coma_shock_clear', () => clearComaByShock(), 8000);
      }
      return;
    }

    if (avgPressure > 80) tryTrigger('crit_pressure', () => triggerDialogue('critical_pressure'), 4000);
    else if (avgPressure > 55) tryTrigger('high_pressure', () => triggerDialogue('high_pressure'), 5000);
    else if (avgPressure > 30) tryTrigger('med_pressure', () => triggerDialogue('medium_pressure'), 7000);
    else if (avgPressure > 10) tryTrigger('low_pressure', () => triggerDialogue('low_pressure'), 9000);

    if (avgPainVal > 60) tryTrigger('high_pain', () => triggerDialogue('pain_high'), 4500);
    else if (avgPainVal > 25) tryTrigger('low_pain', () => triggerDialogue('pain_low'), 6000);

    if (avgSens > 70) tryTrigger('high_sens', () => triggerDialogue('pleasure_high'), 4000);
    else if (avgSens > 40) tryTrigger('med_sens', () => triggerDialogue('pleasure_medium'), 6000);
    else if (avgSens > 15) tryTrigger('low_sens', () => triggerDialogue('pleasure_low'), 8000);

    const explosions = segs.filter(s => s.ruptured).length;
    if (explosions > 0) tryTrigger('explosion', () => triggerDialogue('explosion'), 3000);
    const breaks = segs.filter(s => s.broken).length;
    if (breaks > 0) tryTrigger('break', () => triggerDialogue('intestine_break'), 3000);

    if (elecActive) {
      const ts = p.toolStates['电击器'];
      const vol = (p.toolType === '电击器' && p.toolActive) ? p.toolParam1 : (ts?.param1 ?? 50);
      const radius = 30 + (p.toolParam2 ?? 50) * 0.3;
      let smallHits = 0, largeHits = 0;
      for (const el of p.electrodes) {
        for (const n of p.smallNodes) {
          if (Math.hypot(n.x - el.x, n.y - el.y) < radius) smallHits++;
        }
        for (const n of p.largeNodes) {
          if (Math.hypot(n.x - el.x, n.y - el.y) < radius) largeHits++;
        }
      }
      const prefix: 'electric_small' | 'electric_large' | 'electric' = smallHits >= largeHits
        ? (smallHits > 0 ? 'electric_small' : 'electric')
        : (largeHits > 0 ? 'electric_large' : 'electric');
      if (vol > 75) {
        const key = prefix === 'electric' ? 'electric_critical' : `${prefix}_critical` as const;
        tryTrigger('elec_crit', () => triggerDialogue(key), 2000);
      } else if (vol > 50) {
        const key = prefix === 'electric' ? 'electric_high' : `${prefix}_high` as const;
        tryTrigger('elec_high', () => triggerDialogue(key), 2500);
      } else if (vol > 25) {
        const key = prefix === 'electric' ? 'electric_medium' : `${prefix}_medium` as const;
        tryTrigger('elec_med', () => triggerDialogue(key), 3000);
      } else {
        const key = prefix === 'electric' ? 'electric_low' : `${prefix}_low` as const;
        tryTrigger('elec_low', () => triggerDialogue(key), 4000);
      }
    }
  }, [triggerDialogue, state.comaState, clearComaByShock]);

  useEffect(() => { peristalsisSpeedRef.current = state.peristalsisSpeed; }, [state.peristalsisSpeed]);
  useEffect(() => { peristalsisModifierRef.current = state.peristalsisModifier; }, [state.peristalsisModifier]);

  useEffect(() => {
    const fps = state.physicsFps;
    const targetMs = 1000 / fps;
    let lastTime = -1;

    const loop = (now: number) => {
      if (lastTime < 0) lastTime = now;
      if (now - lastTime >= targetMs) {
        lastTime += targetMs;
        if (now - lastTime > targetMs) lastTime = now;

        const p = physicsRef.current;
        p.peristalsisBase = peristalsisSpeedRef.current + peristalsisModifierRef.current;
        stepPhysics(p);
        frameCount.current++;
        fpsCountRef.current++;

        const elapsed = now - fpsLastMsRef.current;
        if (elapsed >= 1000) {
          setActualFps(Math.round(fpsCountRef.current / elapsed * 1000));
          fpsCountRef.current = 0;
          fpsLastMsRef.current = now;
        }

        // On mobile (Hermes, no JIT): sync every 3 physics steps to reduce React
        // reconciliation overhead. On web (V8): keep every 2 steps for smoother visuals.
        const syncEvery = Platform.OS === 'web' ? 2 : 3;
        if (frameCount.current % syncEvery === 0) {
          syncFromPhysics();
        }
        if (frameCount.current % Math.max(1, fps) === 0) {
          checkDialogueTriggers();
        }
      }
      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [state.physicsFps]);

  const topPad = Platform.OS === 'web' ? 16 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 0 : insets.bottom;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad, backgroundColor: colors.headerBg, borderBottomColor: colors.border }]}>
        <TouchableOpacity style={styles.menuBtn} onPress={onMenuPress}>
          <Feather name="menu" size={20} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.foreground }]}>腹部交互</Text>
        <TouchableOpacity
          style={[styles.resetBtn, { borderColor: colors.border }]}
          onPress={resetPhysics}
        >
          <Feather name="refresh-cw" size={14} color={colors.mutedForeground} />
        </TouchableOpacity>
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

      <View style={styles.canvasArea}>
        <SimulationCanvas
          canvasLayout={canvasLayout}
          onLayout={layout => { setCanvasLayout(layout); }}
        />

        {/* FPS badge — debug mode only */}
        {state.debugMode && (
          <View style={styles.fpsBadge} pointerEvents="none">
            <Text style={styles.fpsText}>{actualFps} fps</Text>
            <Text style={styles.fpsSubText}>目标 {state.physicsFps}</Text>
          </View>
        )}

        {/* Status bars + ECG + status badges — transparent absolute overlay at top of canvas */}
        <View style={[styles.statusArea, { pointerEvents: 'none' }]}>
          <StatusBars hp={state.hp} pleasure={state.pleasure} embedded />
          <View style={styles.ecgRow}>
            <HeartRateMonitor
              heartRate={state.heartRate}
              comaState={state.comaState}
              isDead={state.isDead}
              width={190}
              height={38}
              transparent
              showLabel
            />
            <CharacterStatusBadges
              comaState={state.comaState}
              heartRate={state.heartRate}
              hp={state.hp}
              isDead={state.isDead}
              ruptures={state.intestinalRuptures}
              breaks={state.intestinalBreaks}
              heartRateModifier={state.heartRateModifier}
              avgPain={avgPain}
              exposedCount={state.exposedSmallIndices?.length ?? 0}
              compact
            />
          </View>
        </View>

        <ToolBar />

        <View style={[styles.bottomOverlay, { pointerEvents: 'box-none', paddingBottom: bottomPad }]}>
          <DialogueBox dialogue={state.currentDialogue} />
          <HookActionBar />
          <ToolControls />
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
  resetBtn: {
    padding: 6,
    marginRight: 6,
    borderRadius: 6,
    borderWidth: 1,
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
  viewToggleText: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  statusArea: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 10,
    paddingTop: 6,
    paddingBottom: 4,
    backgroundColor: 'transparent',
    zIndex: 3,
    gap: 2,
  },
  ecgRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    gap: 6,
  },
  canvasArea: {
    flex: 1,
    position: 'relative',
  },
  statusOverlay: {
    position: 'absolute',
    bottom: 120,
    right: 8,
    zIndex: 4,
  },
  bottomOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  fpsBadge: {
    position: 'absolute',
    top: 6,
    right: 8,
    zIndex: 5,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
    alignItems: 'center',
  },
  fpsText: {
    color: '#00ff99',
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    lineHeight: 16,
  },
  fpsSubText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 9,
    fontFamily: 'Inter_400Regular',
    lineHeight: 12,
  },
});
