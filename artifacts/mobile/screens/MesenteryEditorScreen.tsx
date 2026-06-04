import React, { useState, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Platform, PanResponder, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Line, Ellipse, Rect, Text as SvgText, Polyline } from 'react-native-svg';
import { useGame } from '@/contexts/GameContext';
import {
  CANVAS_W, CANVAS_H, CAVITY_CX, CAVITY_CY, CAVITY_RX, CAVITY_RY,
  N_SMALL, N_LARGE,
} from '../constants/gameConfig';
import { largeNodeMesentery } from '../engine/physics';
import { saveMesenteryConfig, getDefaultMesenteryConfig } from '../engine/mesenteryConfig';

const SMALL_MESENTERY_DEAD_ZONE = 5.0;
const HIT_THRESHOLD_PX = 28; // in physics coords

interface NodePos { rx: number; ry: number }
interface SelectedNode { type: 'large' | 'small'; idx: number; preRx: number; preRy: number }

interface Props { onMenuPress: () => void }

export function MesenteryEditorScreen({ onMenuPress }: Props) {
  const insets = useSafeAreaInsets();
  const { physicsRef, setScreen } = useGame();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom;

  // ── Layout ──────────────────────────────────────────────────────────────────
  const [canvasSize, setCanvasSize] = useState({ w: 1, h: 1 });
  const scale = Math.min(canvasSize.w / CANVAS_W, canvasSize.h / CANVAS_H);
  const svgOffX = (canvasSize.w - CANVAS_W * scale) / 2;
  const svgOffY = (canvasSize.h - CANVAS_H * scale) / 2;

  // Keep layout values in a ref so PanResponder (created once) always sees latest
  const layoutRef = useRef({ scale: 1, svgOffX: 0, svgOffY: 0 });
  layoutRef.current = { scale, svgOffX, svgOffY };

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

  // ── Selection & drag ─────────────────────────────────────────────────────────
  const [selected, setSelected] = useState<SelectedNode | null>(null);
  const [draft, setDraft] = useState<NodePos | null>(null);
  const selectedRef = useRef<SelectedNode | null>(null);
  selectedRef.current = selected;

  // Touch origin in physics space – used to track drag delta
  const touchOriginRef = useRef<{ physX: number; physY: number } | null>(null);

  // ── Status ───────────────────────────────────────────────────────────────────
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [resetStatus, setResetStatus] = useState<'idle' | 'done'>('idle');

  // ── PanResponder (created once; reads layoutRef each call) ───────────────────
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,

      onPanResponderGrant: (evt) => {
        // locationX/Y is relative to the responding View — no page-offset needed
        const lx = evt.nativeEvent.locationX;
        const ly = evt.nativeEvent.locationY;
        const { scale: sc, svgOffX: ox, svgOffY: oy } = layoutRef.current;
        const physX = (lx - ox) / sc;
        const physY = (ly - oy) / sc;

        let bestDist = HIT_THRESHOLD_PX;
        let best: SelectedNode | null = null;

        largeNodesRef.current.forEach((n, idx) => {
          const d = Math.hypot(n.rx - physX, n.ry - physY);
          if (d < bestDist) { bestDist = d; best = { type: 'large', idx, preRx: n.rx, preRy: n.ry }; }
        });
        smallNodesRef.current.forEach((n, idx) => {
          const d = Math.hypot(n.rx - physX, n.ry - physY);
          if (d < bestDist) { bestDist = d; best = { type: 'small', idx, preRx: n.rx, preRy: n.ry }; }
        });

        if (best) {
          // snap drag origin to the node's current rest position
          const cur = (best as SelectedNode).type === 'large'
            ? largeNodesRef.current[(best as SelectedNode).idx]
            : smallNodesRef.current[(best as SelectedNode).idx];
          touchOriginRef.current = { physX, physY };
          setSelected(best);
          setDraft({ rx: cur.rx, ry: cur.ry });
        } else {
          touchOriginRef.current = null;
        }
      },

      onPanResponderMove: (_, gestureState) => {
        if (!selectedRef.current || !touchOriginRef.current) return;
        const { scale: sc } = layoutRef.current;
        const origin = touchOriginRef.current;
        const sel = selectedRef.current;
        // Base position is the node's original rest position
        const base = sel.type === 'large'
          ? largeNodesRef.current[sel.idx]
          : smallNodesRef.current[sel.idx];
        setDraft({
          rx: base.rx + gestureState.dx / sc,
          ry: base.ry + gestureState.dy / sc,
        });
      },

      onPanResponderRelease: () => { touchOriginRef.current = null; },
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
    // Commit any active draft before saving
    const sel = selectedRef.current;
    const finalLarge = [...largeNodesRef.current];
    const finalSmall = [...smallNodesRef.current];

    setSaveStatus('saving');
    const p = physicsRef.current;
    finalLarge.forEach((n, i) => { p.largeNodes[i].rx = n.rx; p.largeNodes[i].ry = n.ry; });
    finalSmall.forEach((n, i) => { p.smallNodes[i].rx = n.rx; p.smallNodes[i].ry = n.ry; });
    try {
      await saveMesenteryConfig({ largeNodes: finalLarge, smallNodes: finalSmall });
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2500);
    } catch {
      setSaveStatus('idle');
    }
  }, [physicsRef]);

  const handleReset = useCallback(() => {
    Alert.alert(
      '复位到预设值',
      '将所有肠系膜坐标恢复为默认预设值。此操作不会自动保存，确认后需点击"保存"才会写入配置文件。',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '复位',
          style: 'destructive',
          onPress: () => {
            const defaults = getDefaultMesenteryConfig();
            setLargeNodes(defaults.largeNodes.map(n => ({ rx: n.rx, ry: n.ry })));
            setSmallNodes(defaults.smallNodes.map(n => ({ rx: n.rx, ry: n.ry })));
            setSelected(null);
            setDraft(null);
            setResetStatus('done');
            setTimeout(() => setResetStatus('idle'), 2500);
          },
        },
      ]
    );
  }, []);

  // ── SVG helpers ───────────────────────────────────────────────────────────────
  const svgW = CANVAS_W * scale;
  const svgH = CANVAS_H * scale;

  // Build polyline points string for guide path (physics coords → SVG coords)
  const buildPolylinePoints = (nodes: NodePos[], selType: 'large' | 'small', selIdx: number | null) => {
    return nodes.map((n, idx) => {
      const isSel = selIdx !== null && idx === selIdx;
      const rx = isSel && draft ? draft.rx : n.rx;
      const ry = isSel && draft ? draft.ry : n.ry;
      return `${(rx * scale).toFixed(1)},${(ry * scale).toFixed(1)}`;
    }).join(' ');
  };

  const largeSelIdx = selected?.type === 'large' ? selected.idx : null;
  const smallSelIdx = selected?.type === 'small' ? selected.idx : null;

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
    const dz = deadZoneFn(idx);
    const deadR = Math.max(dz * scale, 3);
    const baseColor = type === 'large' ? '#ffaa33' : '#33ccff';
    const color = isSel ? '#ffffff' : baseColor;
    const arm = isSel ? 10 : 6;
    const dotR = isSel ? 4.5 : 2.5;
    const sw = isSel ? 1.8 : 0.8;
    const op = isSel ? 1 : 0.75;

    return (
      <React.Fragment key={`${type}-${idx}`}>
        {dz > 0.5 && (
          <Circle
            cx={sx} cy={sy} r={deadR}
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
          <SvgText x={sx + 6} y={sy - 6} fontSize={8} fill="#ffffff" fontFamily="Inter_400Regular">
            [{idx}]
          </SvgText>
        )}
      </React.Fragment>
    );
  });

  // ── Info label for selected node ──────────────────────────────────────────────
  const selNode = selected
    ? (selected.type === 'large' ? largeNodes[selected.idx] : smallNodes[selected.idx])
    : null;
  const dispRx = draft ? draft.rx : selNode?.rx ?? 0;
  const dispRy = draft ? draft.ry : selNode?.ry ?? 0;
  const selLabel = selected
    ? `${selected.type === 'large' ? '大肠' : '小肠'}[${selected.idx}]  x:${dispRx.toFixed(1)} y:${dispRy.toFixed(1)}`
    : null;

  return (
    <View style={[styles.container]}>
      {/* ── Header ── */}
      <View style={[styles.header, { paddingTop: topPad }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => setScreen('settings')}>
          <Text style={styles.backBtnText}>← 返回</Text>
        </TouchableOpacity>
        <Text style={styles.title}>肠系膜编辑</Text>
        <View style={styles.headerRight}>
          {resetStatus === 'done'
            ? <Text style={styles.statusChip}>已复位</Text>
            : saveStatus === 'saved'
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
        onLayout={e => setCanvasSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
        {...panResponder.panHandlers}
      >
        <Svg
          width={svgW}
          height={svgH}
          style={{ position: 'absolute', left: svgOffX, top: svgOffY }}
          viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
        >
          <Rect x={0} y={0} width={CANVAS_W} height={CANVAS_H} fill="#0a0404" />

          {/* Cavity reference ellipse */}
          <Ellipse
            cx={CAVITY_CX} cy={CAVITY_CY} rx={CAVITY_RX} ry={CAVITY_RY}
            fill="none" stroke="#3a1818" strokeWidth={1.5} strokeDasharray="6,5"
          />

          {/* ── Guide polylines — segment order ── */}
          <Polyline
            points={buildPolylinePoints(smallNodes, 'small', smallSelIdx)}
            fill="none"
            stroke="#33ccff"
            strokeWidth={1.0}
            strokeOpacity={0.30}
            strokeDasharray="4,4"
          />
          <Polyline
            points={buildPolylinePoints(largeNodes, 'large', largeSelIdx)}
            fill="none"
            stroke="#ffaa33"
            strokeWidth={1.0}
            strokeOpacity={0.30}
            strokeDasharray="4,4"
          />

          {/* ── Nodes ── */}
          {renderNodes(smallNodes, 'small', () => SMALL_MESENTERY_DEAD_ZONE)}
          {renderNodes(largeNodes, 'large', idx => largeNodeMesentery(idx).deadZone)}

          {/* Legend */}
          <Rect x={0} y={0} width={88} height={38} fill="rgba(10,4,4,0.72)" rx={4} />
          <Circle cx={8} cy={10} r={3} fill="#ffaa33" />
          <SvgText x={15} y={13} fill="#ffaa33" fontSize={8} opacity={0.8}>大肠 ({N_LARGE}节点)</SvgText>
          <Circle cx={8} cy={22} r={3} fill="#33ccff" />
          <SvgText x={15} y={25} fill="#33ccff" fontSize={8} opacity={0.8}>小肠 ({N_SMALL}节点)</SvgText>
          <SvgText x={4} y={36} fill="#666666" fontSize={7} opacity={0.7}>虚线圈=自由范围  虚线=走向</SvgText>
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
            style={[styles.btn, styles.btnReset]}
            onPress={handleReset}
          >
            <Text style={styles.btnText}>复位</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.btn, styles.btnSave,
              saveStatus === 'saved' && { backgroundColor: '#1a4a2a' },
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
  container: { flex: 1, backgroundColor: '#0a0404' },
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
  backBtn: { padding: 4 },
  backBtnText: { color: '#ffaa33', fontSize: 13, fontFamily: 'Inter_400Regular' },
  title: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: '#ffffff' },
  headerRight: { flex: 1, alignItems: 'flex-end', gap: 2 },
  statusChip: {
    fontSize: 10, fontFamily: 'Inter_600SemiBold',
    color: '#44cc88', backgroundColor: 'rgba(20,60,30,0.7)',
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4,
  },
  selInfo: {
    fontSize: 11, fontFamily: 'Inter_400Regular', color: '#cccccc', textAlign: 'right',
  },
  hintLabel: {
    fontSize: 10, fontFamily: 'Inter_400Regular', color: '#555555',
  },
  canvasArea: { flex: 1, position: 'relative', overflow: 'hidden' },
  bottomBar: {
    borderTopWidth: 1,
    borderTopColor: '#2a1515',
    backgroundColor: '#140808',
    paddingTop: 8,
    paddingHorizontal: 10,
  },
  btnRow: { flexDirection: 'row', gap: 8 },
  btn: {
    flex: 1, paddingVertical: 13,
    borderRadius: 8, alignItems: 'center', justifyContent: 'center',
  },
  btnCancel:  { backgroundColor: '#3a1a1a' },
  btnConfirm: { backgroundColor: '#1a3a1a' },
  btnReset:   { backgroundColor: '#2a1a3a' },
  btnSave:    { backgroundColor: '#1a2a4a' },
  btnDisabled: { opacity: 0.30 },
  btnText: { color: '#ffffff', fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  btnTextDim: { color: '#555555' },
});
