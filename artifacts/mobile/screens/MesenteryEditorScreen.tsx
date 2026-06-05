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
// Hit threshold in physics units — how close a tap must be to select a node
const HIT_THRESHOLD = 20;

interface NodePos { rx: number; ry: number }
interface SelectedNode { type: 'large' | 'small'; idx: number }
interface Props { onMenuPress: () => void }

export function MesenteryEditorScreen({ onMenuPress }: Props) {
  const insets = useSafeAreaInsets();
  const { physicsRef, setScreen } = useGame();
  const topPad    = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom;

  // ── Canvas layout ────────────────────────────────────────────────────────────
  const [canvasSize, setCanvasSize] = useState({ w: 1, h: 1 });

  // Scale so the full 340×460 physics space fits inside the canvas area
  const scale   = Math.min(canvasSize.w / CANVAS_W, canvasSize.h / CANVAS_H);
  const svgW    = CANVAS_W * scale;
  const svgH    = CANVAS_H * scale;
  // Centering offsets so the SVG is centered inside the canvas area
  const svgOffX = (canvasSize.w - svgW) / 2;
  const svgOffY = (canvasSize.h - svgH) / 2;

  // PanResponder reads this ref — always sees latest values without re-creation
  const layoutRef = useRef({ scale: 1 });
  layoutRef.current.scale = scale;

  // ── Node state ───────────────────────────────────────────────────────────────
  const [largeNodes, setLargeNodes] = useState<NodePos[]>(() =>
    physicsRef.current.largeNodes.map(n => ({ rx: n.rx, ry: n.ry }))
  );
  const [smallNodes, setSmallNodes] = useState<NodePos[]>(() =>
    physicsRef.current.smallNodes.map(n => ({ rx: n.rx, ry: n.ry }))
  );
  const largeNodesRef = useRef(largeNodes);
  const smallNodesRef = useRef(smallNodes);
  largeNodesRef.current = largeNodes;
  smallNodesRef.current = smallNodes;

  // ── Selection / draft ────────────────────────────────────────────────────────
  const [selected, setSelected] = useState<SelectedNode | null>(null);
  const [draft,    setDraft]    = useState<NodePos | null>(null);
  const selectedRef = useRef<SelectedNode | null>(null);
  selectedRef.current = selected;

  // ── Save status ──────────────────────────────────────────────────────────────
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  // ── Drag tracking ────────────────────────────────────────────────────────────
  // We record the pageX/pageY at touch-start plus the node's rest position.
  // On each move we compute Δpage and convert to physics units (÷ scale).
  // This never needs the View's absolute screen position.
  const dragStartRef = useRef<{
    pageX: number; pageY: number; nodeRx: number; nodeRy: number;
  } | null>(null);

  // ── PanResponder ─────────────────────────────────────────────────────────────
  // IMPORTANT: This responder is placed on the SVG overlay View, which is
  // positioned exactly at (svgOffX, svgOffY) with size (svgW × svgH).
  // Therefore locationX/Y from touch events are already in SVG-pixel space:
  //   physX = locationX / scale   ← NO svgOffX subtraction needed
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder:  () => true,

      onPanResponderGrant: (evt) => {
        const sc  = layoutRef.current.scale;
        // Convert SVG-pixel tap position → physics coordinates
        const physX = evt.nativeEvent.locationX / sc;
        const physY = evt.nativeEvent.locationY / sc;

        // Find closest node within hit threshold
        let bestDist = HIT_THRESHOLD;
        let best: SelectedNode | null = null;

        largeNodesRef.current.forEach((n, idx) => {
          const d = Math.hypot(n.rx - physX, n.ry - physY);
          if (d < bestDist) { bestDist = d; best = { type: 'large', idx }; }
        });
        smallNodesRef.current.forEach((n, idx) => {
          const d = Math.hypot(n.rx - physX, n.ry - physY);
          if (d < bestDist) { bestDist = d; best = { type: 'small', idx }; }
        });

        if (best) {
          const node = (best as SelectedNode).type === 'large'
            ? largeNodesRef.current[(best as SelectedNode).idx]
            : smallNodesRef.current[(best as SelectedNode).idx];
          dragStartRef.current = {
            pageX:  evt.nativeEvent.pageX,
            pageY:  evt.nativeEvent.pageY,
            nodeRx: node.rx,
            nodeRy: node.ry,
          };
          setSelected(best);
          setDraft({ rx: node.rx, ry: node.ry });
        } else {
          dragStartRef.current = null;
        }
      },

      onPanResponderMove: (evt) => {
        if (!selectedRef.current || !dragStartRef.current) return;
        const sc = layoutRef.current.scale;
        const { pageX: px0, pageY: py0, nodeRx, nodeRy } = dragStartRef.current;
        // Delta in page-pixels → convert to physics units
        setDraft({
          rx: nodeRx + (evt.nativeEvent.pageX - px0) / sc,
          ry: nodeRy + (evt.nativeEvent.pageY - py0) / sc,
        });
      },

      onPanResponderRelease: () => { dragStartRef.current = null; },
    })
  ).current;

  // ── Actions ──────────────────────────────────────────────────────────────────
  const handleConfirm = useCallback(() => {
    setDraft(cur => {
      const sel = selectedRef.current;
      if (sel && cur) {
        if (sel.type === 'large') {
          setLargeNodes(ns => { const a = [...ns]; a[sel.idx] = { rx: cur.rx, ry: cur.ry }; return a; });
        } else {
          setSmallNodes(ns => { const a = [...ns]; a[sel.idx] = { rx: cur.rx, ry: cur.ry }; return a; });
        }
      }
      return null;
    });
    setSelected(null);
  }, []);

  const handleCancel = useCallback(() => { setDraft(null); setSelected(null); }, []);

  const handleSave = useCallback(async () => {
    const finalLarge = [...largeNodesRef.current];
    const finalSmall = [...smallNodesRef.current];
    setSaveStatus('saving');
    const config = { largeNodes: finalLarge, smallNodes: finalSmall };
    applyMesenteryConfig(physicsRef.current, config); // snaps x/y and clears velocity
    try {
      await saveMesenteryConfig(config);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2500);
    } catch {
      setSaveStatus('idle');
    }
  }, [physicsRef]);

  // ── SVG helpers ───────────────────────────────────────────────────────────────
  const buildPolyPoints = (nodes: NodePos[], selType: 'large' | 'small') =>
    nodes.map((n, idx) => {
      const isSel = selected?.type === selType && selected.idx === idx;
      const rx = isSel && draft ? draft.rx : n.rx;
      const ry = isSel && draft ? draft.ry : n.ry;
      return `${rx.toFixed(1)},${ry.toFixed(1)}`;
    }).join(' ');

  // Nodes are rendered in physics/viewBox coords — no extra scaling needed inside the SVG
  const renderNodes = (nodes: NodePos[], type: 'large' | 'small', deadZoneFn: (i: number) => number) =>
    nodes.map((n, idx) => {
      const isSel = selected?.type === type && selected.idx === idx;
      const rx = isSel && draft ? draft.rx : n.rx;
      const ry = isSel && draft ? draft.ry : n.ry;
      const dz   = deadZoneFn(idx);
      const color = isSel ? '#ffffff' : (type === 'large' ? '#ffaa33' : '#33ccff');
      const arm   = isSel ? 10 : 6;
      const dotR  = isSel ? 4.5 : 2.5;
      const sw    = isSel ? 1.8 : 0.8;
      const op    = isSel ? 1 : 0.75;

      return (
        <React.Fragment key={`${type}-${idx}`}>
          {dz > 0.5 && (
            <Circle cx={rx} cy={ry} r={dz}
              fill="none" stroke={color}
              strokeWidth={isSel ? 1.2 / scale : 0.5 / scale}
              strokeOpacity={isSel ? 0.65 : 0.28}
              strokeDasharray={isSel ? undefined : `${3 / scale},${3 / scale}`}
            />
          )}
          <Line x1={rx - arm / scale} y1={ry} x2={rx + arm / scale} y2={ry}
            stroke={color} strokeWidth={sw / scale} strokeOpacity={op} />
          <Line x1={rx} y1={ry - arm / scale} x2={rx} y2={ry + arm / scale}
            stroke={color} strokeWidth={sw / scale} strokeOpacity={op} />
          <Circle cx={rx} cy={ry} r={dotR / scale} fill={color} fillOpacity={op} />
          {isSel && (
            <SvgText x={rx + 6 / scale} y={ry - 6 / scale}
              fontSize={8 / scale} fill="#ffffff">
              [{idx}]
            </SvgText>
          )}
        </React.Fragment>
      );
    });

  const selNode = selected
    ? (selected.type === 'large' ? largeNodes[selected.idx] : smallNodes[selected.idx])
    : null;
  const dispRx  = draft ? draft.rx : (selNode?.rx ?? 0);
  const dispRy  = draft ? draft.ry : (selNode?.ry ?? 0);
  const selLabel = selected
    ? `${selected.type === 'large' ? '大肠' : '小肠'}[${selected.idx}]  x:${dispRx.toFixed(1)} y:${dispRy.toFixed(1)}`
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
          {selLabel
            ? <Text style={styles.selInfo} numberOfLines={1}>{selLabel}</Text>
            : <Text style={styles.hintLabel}>点击节点选择并拖动</Text>}
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
        {/* SVG — rendered in physics coordinate space (viewBox = CANVAS_W × CANVAS_H) */}
        <Svg
          width={svgW} height={svgH}
          style={{ position: 'absolute', left: svgOffX, top: svgOffY }}
          viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
        >
          <Rect x={0} y={0} width={CANVAS_W} height={CANVAS_H} fill="#0a0404" />

          {/* Cavity reference ellipse — drawn at exact physics coords */}
          <Ellipse
            cx={CAVITY_CX} cy={CAVITY_CY} rx={CAVITY_RX} ry={CAVITY_RY}
            fill="none" stroke="#3a1818" strokeWidth={1.5 / scale} strokeDasharray={`${6/scale},${5/scale}`}
          />

          {/* Calibration cross at cavity center */}
          <Line x1={CAVITY_CX - 8 / scale} y1={CAVITY_CY} x2={CAVITY_CX + 8 / scale} y2={CAVITY_CY}
            stroke="#442222" strokeWidth={0.8 / scale} />
          <Line x1={CAVITY_CX} y1={CAVITY_CY - 8 / scale} x2={CAVITY_CX} y2={CAVITY_CY + 8 / scale}
            stroke="#442222" strokeWidth={0.8 / scale} />

          {/* Guide lines — segment-order polylines */}
          <Polyline
            points={buildPolyPoints(smallNodes, 'small')}
            fill="none" stroke="#33ccff" strokeWidth={1 / scale}
            strokeOpacity={0.25} strokeDasharray={`${4/scale},${4/scale}`}
          />
          <Polyline
            points={buildPolyPoints(largeNodes, 'large')}
            fill="none" stroke="#ffaa33" strokeWidth={1 / scale}
            strokeOpacity={0.25} strokeDasharray={`${4/scale},${4/scale}`}
          />

          {/* Nodes */}
          {renderNodes(smallNodes, 'small', () => SMALL_DEAD_ZONE)}
          {renderNodes(largeNodes, 'large', i  => largeNodeMesentery(i).deadZone)}

          {/* Legend */}
          <Rect x={0} y={0} width={90 / scale} height={40 / scale}
            fill="rgba(10,4,4,0.75)" rx={4 / scale} />
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
          locationX/Y from events on THIS View are in SVG-pixel space:
            physX = locationX / scale  (no svgOffX subtraction)
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
        <View style={styles.btnRow}>
          <TouchableOpacity
            style={[styles.btn, styles.btnCancel, !selected && styles.btnDisabled]}
            onPress={handleCancel} disabled={!selected}
          >
            <Text style={[styles.btnText, !selected && styles.btnTextDim]}>取消</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.btn, styles.btnConfirm, !selected && styles.btnDisabled]}
            onPress={handleConfirm} disabled={!selected}
          >
            <Text style={[styles.btnText, !selected && styles.btnTextDim]}>确认</Text>
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
            <Text style={styles.btnText}>{saveStatus === 'saving' ? '…' : '保存'}</Text>
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
  btnRow:     { flexDirection: 'row', gap: 8 },
  btn: {
    flex: 1, paddingVertical: 13,
    borderRadius: 8, alignItems: 'center', justifyContent: 'center',
  },
  btnCancel:   { backgroundColor: '#3a1a1a' },
  btnConfirm:  { backgroundColor: '#1a3a1a' },
  btnSave:     { backgroundColor: '#1a2a4a' },
  btnDisabled: { opacity: 0.30 },
  btnText:     { color: '#ffffff', fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  btnTextDim:  { color: '#555555' },
});
