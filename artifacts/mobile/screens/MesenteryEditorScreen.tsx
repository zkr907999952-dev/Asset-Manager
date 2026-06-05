import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Platform, PanResponder,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Line, Ellipse, Rect, Text as SvgText, Polyline } from 'react-native-svg';
import { useGame } from '@/contexts/GameContext';
import {
  CANVAS_W, CANVAS_H, CAVITY_CX, CAVITY_CY, CAVITY_RX, CAVITY_RY,
  N_SMALL, N_LARGE, SMALL_RADIUS, LARGE_RADIUS,
} from '../constants/gameConfig';
import { largeNodeMesentery } from '../engine/physics';
import {
  saveMesenteryConfig, applyMesenteryConfig, getDefaultMesenteryConfig,
  loadPreset, savePreset, loadActivePresetIdx, saveActivePresetIdx,
  PRESET_COUNT,
} from '../engine/mesenteryConfig';

const HIT_THRESHOLD = 20;

interface NodePos      { rx: number; ry: number }
interface SelectedNode { type: 'large' | 'small'; idx: number }
interface Props        { onMenuPress: () => void }

export function MesenteryEditorScreen({ onMenuPress }: Props) {
  const insets = useSafeAreaInsets();
  const { physicsRef, setScreen, state, setShowBackground } = useGame();
  const topPad    = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom;

  // ── Canvas layout ──────────────────────────────────────────────────────────
  const [canvasSize, setCanvasSize] = useState({ w: 1, h: 1 });
  const scale   = Math.min(canvasSize.w / CANVAS_W, canvasSize.h / CANVAS_H);
  const svgW    = CANVAS_W * scale;
  const svgH    = CANVAS_H * scale;
  const svgOffX = (canvasSize.w - svgW) / 2;
  const svgOffY = (canvasSize.h - svgH) / 2;
  const layoutRef = useRef({ scale: 1 });
  layoutRef.current.scale = scale;

  // ── Preset state ───────────────────────────────────────────────────────────
  const [activePreset, setActivePreset] = useState(0);
  const [switching,    setSwitching]    = useState(false);

  useEffect(() => {
    loadActivePresetIdx().then(setActivePreset);
  }, []);

  // ── Working node state ─────────────────────────────────────────────────────
  const initLarge = () => physicsRef.current.largeNodes.map(n => ({ rx: n.rx, ry: n.ry }));
  const initSmall = () => physicsRef.current.smallNodes.map(n => ({ rx: n.rx, ry: n.ry }));

  const [workingLarge, setWorkingLarge] = useState<NodePos[]>(initLarge);
  const [workingSmall, setWorkingSmall] = useState<NodePos[]>(initSmall);
  const workingLargeRef = useRef(workingLarge);
  const workingSmallRef = useRef(workingSmall);
  workingLargeRef.current = workingLarge;
  workingSmallRef.current = workingSmall;

  const snapLargeRef = useRef<NodePos[]>(initLarge());
  const snapSmallRef = useRef<NodePos[]>(initSmall());

  // ── Selection / drag ───────────────────────────────────────────────────────
  const [selected, setSelected] = useState<SelectedNode | null>(null);
  const [draft,    setDraft]    = useState<NodePos | null>(null);
  const selectedRef = useRef<SelectedNode | null>(null);
  selectedRef.current = selected;
  const draftRef = useRef<NodePos | null>(null);
  draftRef.current = draft;

  // ── Status ─────────────────────────────────────────────────────────────────
  const [confirmFlash, setConfirmFlash] = useState(false);
  const [saveStatus,   setSaveStatus]   = useState<'idle' | 'saving' | 'saved'>('idle');

  const dragStartRef = useRef<{
    pageX: number; pageY: number; nodeRx: number; nodeRy: number;
  } | null>(null);

  // ── Commit draft → working (called via ref to avoid stale closures) ────────
  const commitDraftFnRef = useRef<(sel: SelectedNode, d: NodePos) => void>(() => {});
  commitDraftFnRef.current = (sel: SelectedNode, d: NodePos) => {
    if (sel.type === 'large') {
      const next = workingLargeRef.current.map((n, i) =>
        i === sel.idx ? { rx: d.rx, ry: d.ry } : n);
      workingLargeRef.current = next;
      setWorkingLarge(next);
    } else {
      const next = workingSmallRef.current.map((n, i) =>
        i === sel.idx ? { rx: d.rx, ry: d.ry } : n);
      workingSmallRef.current = next;
      setWorkingSmall(next);
    }
  };

  // ── PanResponder (on overlay View = SVG-pixel coords) ─────────────────────
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder:  () => true,

      onPanResponderGrant: (evt) => {
        const sc    = layoutRef.current.scale;
        const physX = evt.nativeEvent.locationX / sc;
        const physY = evt.nativeEvent.locationY / sc;

        // Commit current draft to working before switching
        const curSel   = selectedRef.current;
        const curDraft = draftRef.current;
        if (curSel && curDraft) commitDraftFnRef.current(curSel, curDraft);

        // Hit-test
        let bestDist = HIT_THRESHOLD;
        let best: SelectedNode | null = null;
        workingLargeRef.current.forEach((n, idx) => {
          const d = Math.hypot(n.rx - physX, n.ry - physY);
          if (d < bestDist) { bestDist = d; best = { type: 'large', idx }; }
        });
        workingSmallRef.current.forEach((n, idx) => {
          const d = Math.hypot(n.rx - physX, n.ry - physY);
          if (d < bestDist) { bestDist = d; best = { type: 'small', idx }; }
        });

        if (best) {
          const b    = best as SelectedNode;
          const node = b.type === 'large'
            ? workingLargeRef.current[b.idx]
            : workingSmallRef.current[b.idx];
          dragStartRef.current = {
            pageX: evt.nativeEvent.pageX, pageY: evt.nativeEvent.pageY,
            nodeRx: node.rx, nodeRy: node.ry,
          };
          setSelected(best);
          setDraft({ rx: node.rx, ry: node.ry });
        }
      },

      onPanResponderMove: (evt) => {
        if (!selectedRef.current || !dragStartRef.current) return;
        const sc = layoutRef.current.scale;
        const { pageX: px0, pageY: py0, nodeRx, nodeRy } = dragStartRef.current;
        setDraft({
          rx: nodeRx + (evt.nativeEvent.pageX - px0) / sc,
          ry: nodeRy + (evt.nativeEvent.pageY - py0) / sc,
        });
      },

      onPanResponderRelease: () => {
        const curSel   = selectedRef.current;
        const curDraft = draftRef.current;
        if (curSel && curDraft) commitDraftFnRef.current(curSel, curDraft);
        dragStartRef.current = null;
      },
    })
  ).current;

  // ── Confirm (snapshot) ─────────────────────────────────────────────────────
  const handleConfirm = useCallback(() => {
    const curSel = selectedRef.current;
    const curDraft = draftRef.current;
    if (curSel && curDraft) commitDraftFnRef.current(curSel, curDraft);
    snapLargeRef.current = workingLargeRef.current.map(n => ({ ...n }));
    snapSmallRef.current = workingSmallRef.current.map(n => ({ ...n }));
    setConfirmFlash(true);
    setTimeout(() => setConfirmFlash(false), 900);
  }, []);

  // ── Cancel (revert to snapshot) ────────────────────────────────────────────
  const handleCancel = useCallback(() => {
    const revL = snapLargeRef.current.map(n => ({ ...n }));
    const revS = snapSmallRef.current.map(n => ({ ...n }));
    workingLargeRef.current = revL;
    workingSmallRef.current = revS;
    setWorkingLarge(revL);
    setWorkingSmall(revS);
    setSelected(null);
    setDraft(null);
    dragStartRef.current = null;
  }, []);

  // ── Reset current preset to defaults ──────────────────────────────────────
  const handleResetCurrentPreset = useCallback(async () => {
    const defaults = getDefaultMesenteryConfig();
    const newL = defaults.largeNodes.map(n => ({ rx: n.rx, ry: n.ry }));
    const newS = defaults.smallNodes.map(n => ({ rx: n.rx, ry: n.ry }));
    workingLargeRef.current = newL;
    workingSmallRef.current = newS;
    setWorkingLarge(newL);
    setWorkingSmall(newS);
    snapLargeRef.current = newL.map(n => ({ ...n }));
    snapSmallRef.current = newS.map(n => ({ ...n }));
    setSelected(null);
    setDraft(null);
    dragStartRef.current = null;
    applyMesenteryConfig(physicsRef.current, defaults);
    await savePreset(activePreset, defaults);
  }, [activePreset, physicsRef]);

  // ── Save (write to preset file + apply physics) ────────────────────────────
  const handleSave = useCallback(async () => {
    const curSel = selectedRef.current;
    const curDraft = draftRef.current;
    if (curSel && curDraft) commitDraftFnRef.current(curSel, curDraft);
    snapLargeRef.current = workingLargeRef.current.map(n => ({ ...n }));
    snapSmallRef.current = workingSmallRef.current.map(n => ({ ...n }));

    setSaveStatus('saving');
    const config = {
      largeNodes: workingLargeRef.current,
      smallNodes: workingSmallRef.current,
    };
    applyMesenteryConfig(physicsRef.current, config);
    try {
      await savePreset(activePreset, config);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2500);
    } catch {
      setSaveStatus('idle');
    }
  }, [activePreset, physicsRef]);

  // ── Switch preset ──────────────────────────────────────────────────────────
  const handleSwitchPreset = useCallback(async (newIdx: number) => {
    if (newIdx === activePreset || switching) return;
    setSwitching(true);
    try {
      // Auto-save current working state to old preset
      const curSel = selectedRef.current;
      const curDraft = draftRef.current;
      if (curSel && curDraft) commitDraftFnRef.current(curSel, curDraft);
      await savePreset(activePreset, {
        largeNodes: workingLargeRef.current,
        smallNodes: workingSmallRef.current,
      });

      // Load new preset
      const loaded = await loadPreset(newIdx);
      const cfg    = loaded ?? getDefaultMesenteryConfig();
      const newL   = cfg.largeNodes.map(n => ({ rx: n.rx, ry: n.ry }));
      const newS   = cfg.smallNodes.map(n => ({ rx: n.rx, ry: n.ry }));

      workingLargeRef.current = newL;
      workingSmallRef.current = newS;
      setWorkingLarge(newL);
      setWorkingSmall(newS);
      snapLargeRef.current = newL.map(n => ({ ...n }));
      snapSmallRef.current = newS.map(n => ({ ...n }));
      setSelected(null);
      setDraft(null);
      dragStartRef.current = null;

      // Apply to physics so exiting editor reflects new preset
      applyMesenteryConfig(physicsRef.current, cfg);

      setActivePreset(newIdx);
      await saveActivePresetIdx(newIdx);
    } finally {
      setSwitching(false);
    }
  }, [activePreset, switching, physicsRef]);

  // ── Display node positions (draft overrides selected node) ─────────────────
  const dispLarge = useMemo<NodePos[]>(() =>
    workingLarge.map((n, i) =>
      selected?.type === 'large' && selected.idx === i && draft
        ? { rx: draft.rx, ry: draft.ry } : n),
    [workingLarge, selected, draft]
  );
  const dispSmall = useMemo<NodePos[]>(() =>
    workingSmall.map((n, i) =>
      selected?.type === 'small' && selected.idx === i && draft
        ? { rx: draft.rx, ry: draft.ry } : n),
    [workingSmall, selected, draft]
  );

  // ── SVG rendering ──────────────────────────────────────────────────────────
  const buildPolyPoints = (nodes: NodePos[]) =>
    nodes.map(n => `${n.rx.toFixed(1)},${n.ry.toFixed(1)}`).join(' ');

  const renderNodes = (
    nodes: NodePos[],
    type: 'large' | 'small',
    physRadius: number,
    deadZoneFn: (i: number) => number
  ) =>
    nodes.map((n, idx) => {
      const isSel  = selected?.type === type && selected.idx === idx;
      const color  = isSel ? '#ffffff' : (type === 'large' ? '#ffaa33' : '#33ccff');
      const arm    = isSel ? 10 : 6;
      const dotR   = isSel ? 4.5 : 2.5;
      const sw     = isSel ? 1.8 : 0.8;
      const op     = isSel ? 1   : 0.75;
      const dz     = deadZoneFn(idx);

      return (
        <React.Fragment key={`${type}-${idx}`}>
          {/* Collision volume wireframe */}
          <Circle
            cx={n.rx} cy={n.ry} r={physRadius}
            fill="none"
            stroke={isSel ? color : (type === 'large' ? '#ffaa33' : '#33ccff')}
            strokeWidth={0.6 / scale}
            strokeOpacity={isSel ? 0.55 : 0.22}
          />
          {/* Free-zone dead-zone circle (dashed) */}
          {dz > physRadius + 0.5 && (
            <Circle cx={n.rx} cy={n.ry} r={dz}
              fill="none" stroke={color}
              strokeWidth={isSel ? 1.0 / scale : 0.5 / scale}
              strokeOpacity={isSel ? 0.50 : 0.20}
              strokeDasharray={`${3 / scale},${3 / scale}`}
            />
          )}
          {/* Crosshair */}
          <Line x1={n.rx - arm / scale} y1={n.ry} x2={n.rx + arm / scale} y2={n.ry}
            stroke={color} strokeWidth={sw / scale} strokeOpacity={op} />
          <Line x1={n.rx} y1={n.ry - arm / scale} x2={n.rx} y2={n.ry + arm / scale}
            stroke={color} strokeWidth={sw / scale} strokeOpacity={op} />
          {/* Centre dot */}
          <Circle cx={n.rx} cy={n.ry} r={dotR / scale} fill={color} fillOpacity={op} />
          {/* Index label when selected */}
          {isSel && (
            <SvgText x={n.rx + (physRadius + 3) / scale} y={n.ry - 3 / scale}
              fontSize={8 / scale} fill="#ffffff">
              [{idx}]
            </SvgText>
          )}
        </React.Fragment>
      );
    });

  // Header info
  const selNode  = selected
    ? (selected.type === 'large' ? dispLarge[selected.idx] : dispSmall[selected.idx])
    : null;
  const selLabel = selNode
    ? `${selected!.type === 'large' ? '大肠' : '小肠'}[${selected!.idx}]  x:${selNode.rx.toFixed(1)} y:${selNode.ry.toFixed(1)}`
    : null;

  return (
    <View style={styles.container}>
      {/* ── Header ── */}
      <View style={[styles.header, { paddingTop: topPad }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => setScreen('settings')}>
          <Text style={styles.backBtnText}>← 返回</Text>
        </TouchableOpacity>
        <Text style={styles.title}>肠系膜编辑</Text>
        <View style={styles.headerRight}>
          {/* Static label — never moves */}
          {selLabel
            ? <Text style={styles.selInfo} numberOfLines={1}>{selLabel}</Text>
            : <Text style={styles.hintLabel}>点击节点选择并拖动</Text>
          }
          {/* Chips float absolutely over header so they never affect layout */}
          {saveStatus === 'saved' && (
            <View style={styles.chipOverlay}>
              <Text style={styles.statusChip}>已保存 ✓</Text>
            </View>
          )}
          {confirmFlash && (
            <View style={styles.chipOverlay}>
              <Text style={[styles.statusChip, { backgroundColor: 'rgba(30,80,30,0.8)', color: '#88ddaa' }]}>
                已记录 ✓
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* ── Preset bar ── */}
      <View style={styles.presetBar}>
        <Text style={styles.presetBarLabel}>预设：</Text>
        {Array.from({ length: PRESET_COUNT }, (_, i) => {
          const isActive = activePreset === i;
          return (
            <TouchableOpacity
              key={i}
              style={[styles.presetBtn, isActive && styles.presetBtnActive]}
              onPress={() => handleSwitchPreset(i)}
              disabled={switching}
            >
              {isActive && <View style={styles.presetActiveDot} />}
              <Text style={[styles.presetBtnText, isActive && styles.presetBtnTextActive]}>
                预设{i + 1}
              </Text>
            </TouchableOpacity>
          );
        })}
        {switching && (
          <Text style={styles.switchingText}>切换中…</Text>
        )}
        {/* Spacer pushes bg toggle to right */}
        <View style={{ flex: 1 }} />
        {/* Background toggle */}
        <TouchableOpacity
          style={[styles.bgToggleBtn, state.showBackground && styles.bgToggleBtnOn]}
          onPress={() => setShowBackground(!state.showBackground)}
        >
          <Text style={[styles.bgToggleText, state.showBackground && styles.bgToggleTextOn]}>
            {state.showBackground ? '背景 ●' : '背景 ○'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── Canvas area ── */}
      <View
        style={styles.canvasArea}
        onLayout={e => setCanvasSize({
          w: e.nativeEvent.layout.width,
          h: e.nativeEvent.layout.height,
        })}
      >
        {/* SVG — physics viewBox coordinate space */}
        <Svg
          width={svgW} height={svgH}
          style={{ position: 'absolute', left: svgOffX, top: svgOffY }}
          viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
        >
          <Rect x={0} y={0} width={CANVAS_W} height={CANVAS_H} fill="#0a0404" />

          {/* Cavity reference ellipse */}
          <Ellipse
            cx={CAVITY_CX} cy={CAVITY_CY} rx={CAVITY_RX} ry={CAVITY_RY}
            fill="none" stroke="#3a1818" strokeWidth={1.5 / scale}
            strokeDasharray={`${6 / scale},${5 / scale}`}
          />
          {/* Calibration cross at cavity centre */}
          <Line x1={CAVITY_CX - 8 / scale} y1={CAVITY_CY} x2={CAVITY_CX + 8 / scale} y2={CAVITY_CY}
            stroke="#442222" strokeWidth={0.8 / scale} />
          <Line x1={CAVITY_CX} y1={CAVITY_CY - 8 / scale} x2={CAVITY_CX} y2={CAVITY_CY + 8 / scale}
            stroke="#442222" strokeWidth={0.8 / scale} />

          {/* Connection lines — SOLID */}
          <Polyline
            points={buildPolyPoints(dispSmall)}
            fill="none" stroke="#33ccff" strokeWidth={0.8 / scale}
            strokeOpacity={0.35}
          />
          <Polyline
            points={buildPolyPoints(dispLarge)}
            fill="none" stroke="#ffaa33" strokeWidth={0.8 / scale}
            strokeOpacity={0.35}
          />

          {/* Nodes with collision wireframe circles */}
          {renderNodes(dispSmall, 'small', SMALL_RADIUS, () => 0)}
          {renderNodes(dispLarge, 'large', LARGE_RADIUS, i => largeNodeMesentery(i).deadZone)}

          {/* Legend */}
          <Rect x={0} y={0} width={96 / scale} height={46 / scale}
            fill="rgba(10,4,4,0.82)" rx={4 / scale} />
          <Circle cx={8 / scale}  cy={10 / scale} r={3 / scale} fill="#ffaa33" />
          <SvgText x={15 / scale} y={14 / scale} fill="#ffaa33"
            fontSize={8 / scale} opacity={0.85}>大肠 r={LARGE_RADIUS}</SvgText>
          <Circle cx={8 / scale}  cy={23 / scale} r={3 / scale} fill="#33ccff" />
          <SvgText x={15 / scale} y={27 / scale} fill="#33ccff"
            fontSize={8 / scale} opacity={0.85}>小肠 r={SMALL_RADIUS}</SvgText>
          <SvgText x={4 / scale}  y={38 / scale} fill="#665555"
            fontSize={7 / scale} opacity={0.8}>实圆=碰撞体积</SvgText>
          <SvgText x={4 / scale}  y={45 / scale} fill="#665555"
            fontSize={7 / scale} opacity={0.8}>虚圆=自由范围</SvgText>
        </Svg>

        {/* Touch overlay — exactly covers the SVG area, locationX/Y = SVG-pixel space */}
        <View
          style={{
            position: 'absolute',
            left: svgOffX, top: svgOffY,
            width: svgW,   height: svgH,
          }}
          {...panResponder.panHandlers}
        />
      </View>

      {/* ── Bottom bar ── */}
      <View style={[styles.bottomBar, { paddingBottom: bottomPad + 4 }]}>
        <View style={styles.legendRow}>
          <View style={styles.legendDot} />
          <Text style={styles.legendText}>拖拽节点；点击其他节点直接切换</Text>
        </View>
        <View style={styles.btnRow}>
          <TouchableOpacity style={[styles.btn, styles.btnConfirm]} onPress={handleConfirm}>
            <Text style={styles.btnText}>记录</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btn, styles.btnCancel]} onPress={handleCancel}>
            <Text style={styles.btnText}>还原</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btn, styles.btnReset]} onPress={handleResetCurrentPreset}>
            <Text style={styles.btnText}>重置</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.btn, styles.btnSave,
              saveStatus === 'saved'  && { backgroundColor: '#1a4a2a' },
              saveStatus === 'saving' && { backgroundColor: '#2a2a3a' },
            ]}
            onPress={handleSave}
            disabled={saveStatus === 'saving'}
          >
            <Text style={styles.btnText}>
              {saveStatus === 'saving' ? '…' : saveStatus === 'saved' ? '已保存' : '保存'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: '#0a0404' },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 10, paddingBottom: 8,
    borderBottomWidth: 1, borderBottomColor: '#2a1515',
    backgroundColor: '#140808', gap: 6,
  },
  backBtn:     { padding: 4 },
  backBtnText: { color: '#ffaa33', fontSize: 13, fontFamily: 'Inter_400Regular' },
  title:       { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: '#ffffff' },
  headerRight: { flex: 1, alignItems: 'flex-end', justifyContent: 'center' },
  selInfo:    { fontSize: 11, fontFamily: 'Inter_400Regular', color: '#cccccc', textAlign: 'right' },
  hintLabel:  { fontSize: 10, fontFamily: 'Inter_400Regular', color: '#555555' },
  chipOverlay: {
    position: 'absolute', top: 0, right: 0, bottom: 0,
    justifyContent: 'center', pointerEvents: 'none',
  } as any,
  statusChip: {
    fontSize: 10, fontFamily: 'Inter_600SemiBold', color: '#44cc88',
    backgroundColor: 'rgba(20,60,30,0.85)',
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4,
  },

  // ── Preset bar ──
  presetBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 10, paddingVertical: 7,
    backgroundColor: '#110606',
    borderBottomWidth: 1, borderBottomColor: '#2a1515',
    gap: 6,
  },
  presetBarLabel: {
    fontSize: 11, fontFamily: 'Inter_400Regular', color: '#554444',
  },
  presetBtn: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: 20, backgroundColor: '#1e0c0c',
    borderWidth: 1, borderColor: '#3a1515',
    gap: 4,
  },
  presetBtnActive: {
    backgroundColor: '#3a1a08',
    borderColor: '#cc7733',
    shadowColor: '#cc7733',
    shadowOpacity: 0.4,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  presetActiveDot: {
    width: 6, height: 6, borderRadius: 3, backgroundColor: '#cc7733',
  },
  presetBtnText: {
    fontSize: 12, fontFamily: 'Inter_500Medium', color: '#665544',
  },
  presetBtnTextActive: {
    color: '#ffaa44', fontFamily: 'Inter_600SemiBold',
  },
  switchingText: {
    fontSize: 11, fontFamily: 'Inter_400Regular', color: '#554444', marginLeft: 4,
  },
  bgToggleBtn: {
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 14, backgroundColor: '#1e0c0c',
    borderWidth: 1, borderColor: '#3a1515',
  },
  bgToggleBtnOn: {
    backgroundColor: '#1a2a3a', borderColor: '#4488aa',
  },
  bgToggleText: {
    fontSize: 11, fontFamily: 'Inter_500Medium', color: '#554444',
  },
  bgToggleTextOn: {
    color: '#66bbdd',
  },

  canvasArea: { flex: 1, position: 'relative', overflow: 'hidden' },

  bottomBar: {
    borderTopWidth: 1, borderTopColor: '#2a1515',
    backgroundColor: '#140808', paddingTop: 8, paddingHorizontal: 10,
  },
  legendRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6,
  },
  legendDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#444444' },
  legendText: { fontSize: 10, fontFamily: 'Inter_400Regular', color: '#555555' },
  btnRow:     { flexDirection: 'row', gap: 8 },
  btn: {
    flex: 1, paddingVertical: 13,
    borderRadius: 8, alignItems: 'center', justifyContent: 'center',
  },
  btnConfirm: { backgroundColor: '#1a3a2a' },
  btnCancel:  { backgroundColor: '#3a2a1a' },
  btnReset:   { backgroundColor: '#2a1a1a' },
  btnSave:    { backgroundColor: '#1a2a4a' },
  btnText:    { color: '#ffffff', fontSize: 13, fontFamily: 'Inter_600SemiBold' },
});
