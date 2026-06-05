import React, { useState, useRef, useCallback, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Platform, PanResponder,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Line, Ellipse, Rect, Text as SvgText, Polyline } from 'react-native-svg';
import { useGame } from '@/contexts/GameContext';
import {
  CANVAS_W, CANVAS_H, CAVITY_CX, CAVITY_CY, CAVITY_RX, CAVITY_RY,
  N_SMALL, N_LARGE,
} from '../constants/gameConfig';
import { largeNodeMesentery } from '../engine/physics';
import { saveMesenteryConfig, applyMesenteryConfig } from '../engine/mesenteryConfig';

const SMALL_DEAD_ZONE = 5.0;
const HIT_THRESHOLD   = 20;   // physics units

interface NodePos      { rx: number; ry: number }
interface SelectedNode { type: 'large' | 'small'; idx: number }
interface Props        { onMenuPress: () => void }

export function MesenteryEditorScreen({ onMenuPress }: Props) {
  const insets = useSafeAreaInsets();
  const { physicsRef, setScreen } = useGame();
  const topPad    = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom;

  // ── Canvas layout ─────────────────────────────────────────────────────────────
  const [canvasSize, setCanvasSize] = useState({ w: 1, h: 1 });
  const scale   = Math.min(canvasSize.w / CANVAS_W, canvasSize.h / CANVAS_H);
  const svgW    = CANVAS_W * scale;
  const svgH    = CANVAS_H * scale;
  const svgOffX = (canvasSize.w - svgW) / 2;
  const svgOffY = (canvasSize.h - svgH) / 2;

  const layoutRef = useRef({ scale: 1 });
  layoutRef.current.scale = scale;

  // ── Working node state ────────────────────────────────────────────────────────
  // workingLarge/Small = live edit positions (what's shown on screen).
  // snapLarge/Small    = last confirmed snapshot (cancel reverts here).
  const initLarge = () => physicsRef.current.largeNodes.map(n => ({ rx: n.rx, ry: n.ry }));
  const initSmall = () => physicsRef.current.smallNodes.map(n => ({ rx: n.rx, ry: n.ry }));

  const [workingLarge, setWorkingLarge] = useState<NodePos[]>(initLarge);
  const [workingSmall, setWorkingSmall] = useState<NodePos[]>(initSmall);
  const workingLargeRef = useRef(workingLarge);
  const workingSmallRef = useRef(workingSmall);
  workingLargeRef.current = workingLarge;
  workingSmallRef.current = workingSmall;

  // Snapshot for cancel
  const snapLargeRef = useRef<NodePos[]>(initLarge());
  const snapSmallRef = useRef<NodePos[]>(initSmall());

  // ── Selection / drag ──────────────────────────────────────────────────────────
  // draft overrides the selected node's display position during (and after) a drag
  const [selected, setSelected] = useState<SelectedNode | null>(null);
  const [draft,    setDraft]    = useState<NodePos | null>(null);
  const selectedRef = useRef<SelectedNode | null>(null);
  selectedRef.current = selected;
  const draftRef = useRef<NodePos | null>(null);
  draftRef.current = draft;

  // ── Status ────────────────────────────────────────────────────────────────────
  const [confirmFlash, setConfirmFlash] = useState(false);
  const [saveStatus, setSaveStatus]     = useState<'idle' | 'saving' | 'saved'>('idle');

  // ── Drag tracking ─────────────────────────────────────────────────────────────
  const dragStartRef = useRef<{
    pageX: number; pageY: number; nodeRx: number; nodeRy: number;
  } | null>(null);

  // ── Helper: commit draft → working (ref + state) ──────────────────────────────
  // Called via a ref so PanResponder always sees the latest version.
  const commitDraftFnRef = useRef<(sel: SelectedNode, d: NodePos) => void>(() => {});
  commitDraftFnRef.current = (sel: SelectedNode, d: NodePos) => {
    if (sel.type === 'large') {
      const next = workingLargeRef.current.map((n, i) =>
        i === sel.idx ? { rx: d.rx, ry: d.ry } : n
      );
      workingLargeRef.current = next;
      setWorkingLarge(next);
    } else {
      const next = workingSmallRef.current.map((n, i) =>
        i === sel.idx ? { rx: d.rx, ry: d.ry } : n
      );
      workingSmallRef.current = next;
      setWorkingSmall(next);
    }
  };

  // ── PanResponder ──────────────────────────────────────────────────────────────
  // Placed on an overlay View positioned exactly over the SVG area,
  // so locationX/Y are already in SVG-pixel space → physX = lx / scale.
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder:  () => true,

      onPanResponderGrant: (evt) => {
        const sc    = layoutRef.current.scale;
        const physX = evt.nativeEvent.locationX / sc;
        const physY = evt.nativeEvent.locationY / sc;

        // Finalize any in-progress drag onto working nodes
        const curSel   = selectedRef.current;
        const curDraft = draftRef.current;
        if (curSel && curDraft) {
          commitDraftFnRef.current(curSel, curDraft);
        }

        // Hit-test against updated working nodes
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
            pageX:  evt.nativeEvent.pageX,
            pageY:  evt.nativeEvent.pageY,
            nodeRx: node.rx,
            nodeRy: node.ry,
          };
          setSelected(best);
          setDraft({ rx: node.rx, ry: node.ry });
        }
        // Tap on empty space: keep current selection
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
        // Commit released position to working so the node stays put
        const curSel   = selectedRef.current;
        const curDraft = draftRef.current;
        if (curSel && curDraft) {
          commitDraftFnRef.current(curSel, curDraft);
          // Keep draft at current position (shows coordinates in header)
        }
        dragStartRef.current = null;
      },
    })
  ).current;

  // ── Confirm ───────────────────────────────────────────────────────────────────
  // Snapshot current working state as the cancel recovery point.
  const handleConfirm = useCallback(() => {
    // Commit any live draft first
    const curSel   = selectedRef.current;
    const curDraft = draftRef.current;
    if (curSel && curDraft) {
      commitDraftFnRef.current(curSel, curDraft);
    }
    snapLargeRef.current = workingLargeRef.current.map(n => ({ ...n }));
    snapSmallRef.current = workingSmallRef.current.map(n => ({ ...n }));
    setConfirmFlash(true);
    setTimeout(() => setConfirmFlash(false), 900);
  }, []);

  // ── Cancel ────────────────────────────────────────────────────────────────────
  // Revert working state to last snapshot.
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

  // ── Save ──────────────────────────────────────────────────────────────────────
  // Write current working state (draft applied) to file + physics.
  const handleSave = useCallback(async () => {
    // Commit live draft
    const curSel   = selectedRef.current;
    const curDraft = draftRef.current;
    if (curSel && curDraft) {
      commitDraftFnRef.current(curSel, curDraft);
    }
    // Also update snapshot so cancel now starts from saved state
    snapLargeRef.current = workingLargeRef.current.map(n => ({ ...n }));
    snapSmallRef.current = workingSmallRef.current.map(n => ({ ...n }));

    setSaveStatus('saving');
    const config = {
      largeNodes: workingLargeRef.current,
      smallNodes: workingSmallRef.current,
    };
    applyMesenteryConfig(physicsRef.current, config);
    try {
      await saveMesenteryConfig(config);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2500);
    } catch {
      setSaveStatus('idle');
    }
  }, [physicsRef]);

  // ── Display helpers ───────────────────────────────────────────────────────────
  // The displayed position for a node: draft if it's the currently selected node, else working.
  const dispLarge = useMemo<NodePos[]>(() =>
    workingLarge.map((n, i) =>
      selected?.type === 'large' && selected.idx === i && draft
        ? { rx: draft.rx, ry: draft.ry }
        : n
    ),
    [workingLarge, selected, draft]
  );
  const dispSmall = useMemo<NodePos[]>(() =>
    workingSmall.map((n, i) =>
      selected?.type === 'small' && selected.idx === i && draft
        ? { rx: draft.rx, ry: draft.ry }
        : n
    ),
    [workingSmall, selected, draft]
  );

  const buildPolyPoints = (nodes: NodePos[]) =>
    nodes.map(n => `${n.rx.toFixed(1)},${n.ry.toFixed(1)}`).join(' ');

  const renderNodes = (
    nodes: NodePos[],
    type: 'large' | 'small',
    deadZoneFn: (i: number) => number
  ) =>
    nodes.map((n, idx) => {
      const isSel = selected?.type === type && selected.idx === idx;
      const color = isSel ? '#ffffff' : (type === 'large' ? '#ffaa33' : '#33ccff');
      const arm   = isSel ? 10 : 6;
      const dotR  = isSel ? 4.5 : 2.5;
      const sw    = isSel ? 1.8 : 0.8;
      const op    = isSel ? 1 : 0.75;
      const dz    = deadZoneFn(idx);

      return (
        <React.Fragment key={`${type}-${idx}`}>
          {dz > 0.5 && (
            <Circle cx={n.rx} cy={n.ry} r={dz}
              fill="none" stroke={color}
              strokeWidth={isSel ? 1.2 / scale : 0.5 / scale}
              strokeOpacity={isSel ? 0.65 : 0.28}
              strokeDasharray={isSel ? undefined : `${3 / scale},${3 / scale}`}
            />
          )}
          <Line x1={n.rx - arm / scale} y1={n.ry} x2={n.rx + arm / scale} y2={n.ry}
            stroke={color} strokeWidth={sw / scale} strokeOpacity={op} />
          <Line x1={n.rx} y1={n.ry - arm / scale} x2={n.rx} y2={n.ry + arm / scale}
            stroke={color} strokeWidth={sw / scale} strokeOpacity={op} />
          <Circle cx={n.rx} cy={n.ry} r={dotR / scale} fill={color} fillOpacity={op} />
          {isSel && (
            <SvgText x={n.rx + 6 / scale} y={n.ry - 6 / scale}
              fontSize={8 / scale} fill="#ffffff">
              [{idx}]
            </SvgText>
          )}
        </React.Fragment>
      );
    });

  // ── Header info ───────────────────────────────────────────────────────────────
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
          {saveStatus === 'saved' && (
            <Text style={styles.statusChip}>已保存 ✓</Text>
          )}
          {confirmFlash && (
            <Text style={[styles.statusChip, { backgroundColor: 'rgba(30,80,30,0.8)', color: '#88ddaa' }]}>
              已记录 ✓
            </Text>
          )}
          {selLabel
            ? <Text style={styles.selInfo} numberOfLines={1}>{selLabel}</Text>
            : <Text style={styles.hintLabel}>点击节点选择并拖动</Text>
          }
        </View>
      </View>

      {/* ── Canvas area ── */}
      <View
        style={styles.canvasArea}
        onLayout={e => setCanvasSize({
          w: e.nativeEvent.layout.width,
          h: e.nativeEvent.layout.height,
        })}
      >
        {/* SVG — rendered in physics viewBox coordinate space */}
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
          {/* Calibration cross at cavity center */}
          <Line x1={CAVITY_CX - 8 / scale} y1={CAVITY_CY} x2={CAVITY_CX + 8 / scale} y2={CAVITY_CY}
            stroke="#442222" strokeWidth={0.8 / scale} />
          <Line x1={CAVITY_CX} y1={CAVITY_CY - 8 / scale} x2={CAVITY_CX} y2={CAVITY_CY + 8 / scale}
            stroke="#442222" strokeWidth={0.8 / scale} />

          {/* Guide polylines */}
          <Polyline points={buildPolyPoints(dispSmall)}
            fill="none" stroke="#33ccff" strokeWidth={1 / scale}
            strokeOpacity={0.25} strokeDasharray={`${4 / scale},${4 / scale}`} />
          <Polyline points={buildPolyPoints(dispLarge)}
            fill="none" stroke="#ffaa33" strokeWidth={1 / scale}
            strokeOpacity={0.25} strokeDasharray={`${4 / scale},${4 / scale}`} />

          {/* Nodes */}
          {renderNodes(dispSmall, 'small', () => SMALL_DEAD_ZONE)}
          {renderNodes(dispLarge, 'large', i => largeNodeMesentery(i).deadZone)}

          {/* Legend */}
          <Rect x={0} y={0} width={90 / scale} height={40 / scale}
            fill="rgba(10,4,4,0.78)" rx={4 / scale} />
          <Circle cx={8 / scale}  cy={10 / scale} r={3 / scale} fill="#ffaa33" />
          <SvgText x={15 / scale} y={14 / scale} fill="#ffaa33"
            fontSize={8 / scale} opacity={0.85}>大肠 ({N_LARGE}节点)</SvgText>
          <Circle cx={8 / scale}  cy={23 / scale} r={3 / scale} fill="#33ccff" />
          <SvgText x={15 / scale} y={27 / scale} fill="#33ccff"
            fontSize={8 / scale} opacity={0.85}>小肠 ({N_SMALL}节点)</SvgText>
          <SvgText x={4 / scale}  y={37 / scale} fill="#666666"
            fontSize={7 / scale} opacity={0.7}>虚圈=自由范围  虚线=走向</SvgText>
        </Svg>

        {/*
          Touch-capture overlay — positioned exactly over the SVG.
          locationX/Y from events on this View are in SVG-pixel space:
            physX = locationX / scale  (no svgOffX subtraction needed)
        */}
        <View
          style={{
            position: 'absolute',
            left: svgOffX,
            top: svgOffY,
            width: svgW,
            height: svgH,
          }}
          {...panResponder.panHandlers}
        />
      </View>

      {/* ── Bottom bar ── */}
      <View style={[styles.bottomBar, { paddingBottom: bottomPad + 4 }]}>
        {/* State legend */}
        <View style={styles.legendRow}>
          <View style={styles.legendDot} />
          <Text style={styles.legendText}>拖拽节点后点击其他节点可直接切换</Text>
        </View>
        <View style={styles.btnRow}>
          {/* Confirm: snapshot current state as cancel target */}
          <TouchableOpacity style={[styles.btn, styles.btnConfirm]} onPress={handleConfirm}>
            <Text style={styles.btnText}>记录</Text>
          </TouchableOpacity>

          {/* Cancel: revert to last snapshot */}
          <TouchableOpacity style={[styles.btn, styles.btnCancel]} onPress={handleCancel}>
            <Text style={styles.btnText}>还原</Text>
          </TouchableOpacity>

          {/* Save: write to file + apply to physics */}
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
  headerRight: { flex: 1, alignItems: 'flex-end', gap: 2 },
  statusChip: {
    fontSize: 10, fontFamily: 'Inter_600SemiBold', color: '#44cc88',
    backgroundColor: 'rgba(20,60,30,0.7)',
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4,
  },
  selInfo:    { fontSize: 11, fontFamily: 'Inter_400Regular', color: '#cccccc', textAlign: 'right' },
  hintLabel:  { fontSize: 10, fontFamily: 'Inter_400Regular', color: '#555555' },
  canvasArea: { flex: 1, position: 'relative', overflow: 'hidden' },
  bottomBar: {
    borderTopWidth: 1, borderTopColor: '#2a1515',
    backgroundColor: '#140808', paddingTop: 8, paddingHorizontal: 10,
  },
  legendRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6,
  },
  legendDot: {
    width: 5, height: 5, borderRadius: 3, backgroundColor: '#444444',
  },
  legendText: { fontSize: 10, fontFamily: 'Inter_400Regular', color: '#555555' },
  btnRow:     { flexDirection: 'row', gap: 8 },
  btn: {
    flex: 1, paddingVertical: 13,
    borderRadius: 8, alignItems: 'center', justifyContent: 'center',
  },
  btnConfirm: { backgroundColor: '#1a3a2a' },
  btnCancel:  { backgroundColor: '#3a2a1a' },
  btnSave:    { backgroundColor: '#1a2a4a' },
  btnText:    { color: '#ffffff', fontSize: 13, fontFamily: 'Inter_600SemiBold' },
});
