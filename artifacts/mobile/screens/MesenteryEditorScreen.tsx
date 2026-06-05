import React, { useState, useRef, useCallback } from 'react';
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

const SMALL_MESENTERY_DEAD_ZONE = 5.0;
const HIT_THRESHOLD = 28; // physics coords

interface NodePos { rx: number; ry: number }
interface SelectedNode { type: 'large' | 'small'; idx: number }

interface Props { onMenuPress: () => void }

export function MesenteryEditorScreen({ onMenuPress }: Props) {
  const insets = useSafeAreaInsets();
  const { physicsRef, setScreen } = useGame();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom;

  // ── Layout ───────────────────────────────────────────────────────────────────
  const [canvasSize, setCanvasSize] = useState({ w: 1, h: 1 });

  const scale   = Math.min(canvasSize.w / CANVAS_W, canvasSize.h / CANVAS_H);
  const svgOffX = (canvasSize.w - CANVAS_W * scale) / 2;
  const svgOffY = (canvasSize.h - CANVAS_H * scale) / 2;

  // All layout values read by PanResponder via this ref (avoids stale closures)
  const layoutRef = useRef({ scale: 1, svgOffX: 0, svgOffY: 0 });
  layoutRef.current = { scale, svgOffX, svgOffY };

  const handleLayout = useCallback((e: any) => {
    const { width, height } = e.nativeEvent.layout;
    setCanvasSize({ w: width, h: height });
  }, []);

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
  const [draft, setDraft]       = useState<NodePos | null>(null);
  const selectedRef = useRef<SelectedNode | null>(null);
  selectedRef.current = selected;

  // ── Status ───────────────────────────────────────────────────────────────────
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  // ── Drag-delta tracking ───────────────────────────────────────────────────────
  // Store the node's physics position at touch-start alongside the page coords.
  // On each move we compute the delta in page-pixels and convert to physics units.
  // This never requires the View's absolute screen position, so it works correctly
  // inside Replit's iframe proxy without measureInWindow.
  const dragStartRef = useRef<{
    pageX: number; pageY: number; nodeRx: number; nodeRy: number;
  } | null>(null);

  // ── PanResponder (created once) ──────────────────────────────────────────────
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder:  () => true,

      onPanResponderGrant: (evt) => {
        // locationX/Y is relative to the canvas View — good for hit-testing
        const lx = evt.nativeEvent.locationX;
        const ly = evt.nativeEvent.locationY;
        const { scale: sc, svgOffX: ox, svgOffY: oy } = layoutRef.current;
        const physX = (lx - ox) / sc;
        const physY = (ly - oy) / sc;

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
          // Record touch origin and node's original rest position for delta math
          dragStartRef.current = {
            pageX: evt.nativeEvent.pageX,
            pageY: evt.nativeEvent.pageY,
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
        const { scale: sc } = layoutRef.current;
        const dx = (evt.nativeEvent.pageX - dragStartRef.current.pageX) / sc;
        const dy = (evt.nativeEvent.pageY - dragStartRef.current.pageY) / sc;
        setDraft({
          rx: dragStartRef.current.nodeRx + dx,
          ry: dragStartRef.current.nodeRy + dy,
        });
      },

      onPanResponderRelease: () => { dragStartRef.current = null; },
    })
  ).current;

  // ── Actions ──────────────────────────────────────────────────────────────────
  const handleConfirm = useCallback(() => {
    setDraft(currentDraft => {
      const sel = selectedRef.current;
      if (sel && currentDraft) {
        if (sel.type === 'large') {
          setLargeNodes(ns => {
            const next = [...ns];
            next[sel.idx] = { rx: currentDraft.rx, ry: currentDraft.ry };
            return next;
          });
        } else {
          setSmallNodes(ns => {
            const next = [...ns];
            next[sel.idx] = { rx: currentDraft.rx, ry: currentDraft.ry };
            return next;
          });
        }
      }
      return null;
    });
    setSelected(null);
  }, []);

  const handleCancel = useCallback(() => {
    setDraft(null);
    setSelected(null);
  }, []);

  const handleSave = useCallback(async () => {
    const finalLarge = [...largeNodesRef.current];
    const finalSmall = [...smallNodesRef.current];
    setSaveStatus('saving');
    const config = { largeNodes: finalLarge, smallNodes: finalSmall };
    // applyMesenteryConfig snaps x/y to rx/ry and clears velocity
    // so the simulation immediately reflects the new rest positions
    applyMesenteryConfig(physicsRef.current, config);
    try {
      await saveMesenteryConfig(config);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2500);
    } catch {
      setSaveStatus('idle');
    }
  }, [physicsRef]);

  // ── SVG rendering ────────────────────────────────────────────────────────────
  const svgW = CANVAS_W * scale;
  const svgH = CANVAS_H * scale;

  const buildPolyPoints = (nodes: NodePos[], selType: 'large' | 'small') =>
    nodes.map((n, idx) => {
      const isSel = selected?.type === selType && selected.idx === idx;
      const rx = isSel && draft ? draft.rx : n.rx;
      const ry = isSel && draft ? draft.ry : n.ry;
      return `${(rx * scale).toFixed(1)},${(ry * scale).toFixed(1)}`;
    }).join(' ');

  const renderNodes = (
    nodes: NodePos[],
    type: 'large' | 'small',
    deadZoneFn: (idx: number) => number
  ) => nodes.map((n, idx) => {
    const isSel = selected?.type === type && selected.idx === idx;
    const rx = isSel && draft ? draft.rx : n.rx;
    const ry = isSel && draft ? draft.ry : n.ry;
    const sx = rx * scale;
    const sy = ry * scale;
    const dz   = deadZoneFn(idx);
    const deadR = Math.max(dz * scale, 3);
    const color = isSel ? '#ffffff' : (type === 'large' ? '#ffaa33' : '#33ccff');
    const arm   = isSel ? 10 : 6;
    const dotR  = isSel ? 4.5 : 2.5;
    const sw    = isSel ? 1.8 : 0.8;
    const op    = isSel ? 1 : 0.75;

    return (
      <React.Fragment key={`${type}-${idx}`}>
        {dz > 0.5 && (
          <Circle cx={sx} cy={sy} r={deadR}
            fill="none" stroke={color}
            strokeWidth={isSel ? 1.2 : 0.5}
            strokeOpacity={isSel ? 0.65 : 0.28}
            strokeDasharray={isSel ? undefined : '3,3'}
          />
        )}
        <Line x1={sx - arm} y1={sy} x2={sx + arm} y2={sy}
          stroke={color} strokeWidth={sw} strokeOpacity={op} />
        <Line x1={sx} y1={sy - arm} x2={sx} y2={sy + arm}
          stroke={color} strokeWidth={sw} strokeOpacity={op} />
        <Circle cx={sx} cy={sy} r={dotR} fill={color} fillOpacity={op} />
        {isSel && (
          <SvgText x={sx + 6} y={sy - 6} fontSize={8} fill="#ffffff">
            [{idx}]
          </SvgText>
        )}
      </React.Fragment>
    );
  });

  const selNode = selected
    ? (selected.type === 'large' ? largeNodes[selected.idx] : smallNodes[selected.idx])
    : null;
  const dispRx = draft ? draft.rx : (selNode?.rx ?? 0);
  const dispRy = draft ? draft.ry : (selNode?.ry ?? 0);
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
          {saveStatus === 'saved'
            ? <Text style={styles.statusChip}>已保存 ✓</Text>
            : null}
          {selLabel
            ? <Text style={styles.selInfo} numberOfLines={1}>{selLabel}</Text>
            : <Text style={styles.hintLabel}>点击节点选择并拖动</Text>}
        </View>
      </View>

      {/* ── Canvas ── */}
      <View
        style={styles.canvasArea}
        onLayout={handleLayout}
        {...panResponder.panHandlers}
      >
        <Svg
          width={svgW} height={svgH}
          style={{ position: 'absolute', left: svgOffX, top: svgOffY }}
          viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
        >
          <Rect x={0} y={0} width={CANVAS_W} height={CANVAS_H} fill="#0a0404" />

          {/* Cavity ellipse reference */}
          <Ellipse
            cx={CAVITY_CX} cy={CAVITY_CY} rx={CAVITY_RX} ry={CAVITY_RY}
            fill="none" stroke="#3a1818" strokeWidth={1.5} strokeDasharray="6,5"
          />

          {/* Guide lines — connect nodes in segment order */}
          <Polyline
            points={buildPolyPoints(smallNodes, 'small')}
            fill="none" stroke="#33ccff" strokeWidth={1.0}
            strokeOpacity={0.28} strokeDasharray="4,4"
          />
          <Polyline
            points={buildPolyPoints(largeNodes, 'large')}
            fill="none" stroke="#ffaa33" strokeWidth={1.0}
            strokeOpacity={0.28} strokeDasharray="4,4"
          />

          {/* Nodes */}
          {renderNodes(smallNodes, 'small', () => SMALL_MESENTERY_DEAD_ZONE)}
          {renderNodes(largeNodes, 'large', idx => largeNodeMesentery(idx).deadZone)}

          {/* Legend box */}
          <Rect x={0} y={0} width={90} height={38} fill="rgba(10,4,4,0.75)" rx={4} />
          <Circle cx={8}  cy={10} r={3} fill="#ffaa33" />
          <SvgText x={15} y={13} fill="#ffaa33" fontSize={8} opacity={0.85}>大肠 ({N_LARGE}节点)</SvgText>
          <Circle cx={8}  cy={22} r={3} fill="#33ccff" />
          <SvgText x={15} y={25} fill="#33ccff" fontSize={8} opacity={0.85}>小肠 ({N_SMALL}节点)</SvgText>
          <SvgText x={4}  y={36} fill="#666666" fontSize={7} opacity={0.7}>虚圈=自由范围  虚线=走向</SvgText>
        </Svg>
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
            <Text style={styles.btnText}>
              {saveStatus === 'saving' ? '…' : '保存'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: '#0a0404' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#2a1515',
    backgroundColor: '#140808',
    gap: 6,
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
  selInfo:   { fontSize: 11, fontFamily: 'Inter_400Regular', color: '#cccccc', textAlign: 'right' },
  hintLabel: { fontSize: 10, fontFamily: 'Inter_400Regular', color: '#555555' },
  canvasArea: { flex: 1, position: 'relative', overflow: 'hidden' },
  bottomBar: {
    borderTopWidth: 1,
    borderTopColor: '#2a1515',
    backgroundColor: '#140808',
    paddingTop: 8,
    paddingHorizontal: 10,
  },
  btnRow:     { flexDirection: 'row', gap: 8 },
  btn: {
    flex: 1, paddingVertical: 13,
    borderRadius: 8, alignItems: 'center', justifyContent: 'center',
  },
  btnCancel:  { backgroundColor: '#3a1a1a' },
  btnConfirm: { backgroundColor: '#1a3a1a' },
  btnSave:    { backgroundColor: '#1a2a4a' },
  btnDisabled:  { opacity: 0.30 },
  btnText:    { color: '#ffffff', fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  btnTextDim: { color: '#555555' },
});
