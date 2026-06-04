import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Platform, PanResponder,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Line, Ellipse, Rect, Text as SvgText } from 'react-native-svg';
import { useColors } from '@/hooks/useColors';
import { useGame } from '@/contexts/GameContext';
import {
  CANVAS_W, CANVAS_H, CAVITY_CX, CAVITY_CY, CAVITY_RX, CAVITY_RY,
  N_SMALL, N_LARGE,
} from '../constants/gameConfig';
import { largeNodeMesentery } from '../engine/physics';
import { saveMesenteryConfig } from '../engine/mesenteryConfig';

const SMALL_MESENTERY_DEAD_ZONE = 5.0;
const HIT_THRESHOLD = 28;

interface NodePos { rx: number; ry: number }
interface SelectedNode {
  type: 'large' | 'small';
  idx: number;
  preRx: number;
  preRy: number;
}

interface Props {
  onMenuPress: () => void;
}

export function MesenteryEditorScreen({ onMenuPress }: Props) {
  const insets = useSafeAreaInsets();
  const { physicsRef, setScreen } = useGame();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom;

  const [canvasSize, setCanvasSize] = useState({ w: 1, h: 1 });
  const layoutRef = useRef({ scale: 1, offsetX: 0, offsetY: 0 });

  const scale = Math.min(canvasSize.w / CANVAS_W, canvasSize.h / CANVAS_H);
  const offsetX = (canvasSize.w - CANVAS_W * scale) / 2;
  const offsetY = (canvasSize.h - CANVAS_H * scale) / 2;
  layoutRef.current = { scale, offsetX, offsetY };

  const [largeNodes, setLargeNodes] = useState<NodePos[]>(() =>
    physicsRef.current.largeNodes.map(n => ({ rx: n.rx, ry: n.ry }))
  );
  const [smallNodes, setSmallNodes] = useState<NodePos[]>(() =>
    physicsRef.current.smallNodes.map(n => ({ rx: n.rx, ry: n.ry }))
  );

  const [selected, setSelected] = useState<SelectedNode | null>(null);
  const [draft, setDraft] = useState<NodePos | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  const largeNodesRef = useRef(largeNodes);
  const smallNodesRef = useRef(smallNodes);
  const selectedRef = useRef<SelectedNode | null>(null);
  largeNodesRef.current = largeNodes;
  smallNodesRef.current = smallNodes;
  selectedRef.current = selected;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,

      onPanResponderGrant: (evt) => {
        const { pageX, pageY } = evt.nativeEvent;
        const { scale: sc, offsetX: ox, offsetY: oy } = layoutRef.current;
        const physX = (pageX - ox) / sc;
        const physY = (pageY - oy) / sc;

        let bestDist = HIT_THRESHOLD;
        let best: SelectedNode | null = null;

        largeNodesRef.current.forEach((n, idx) => {
          const d = Math.hypot(n.rx - physX, n.ry - physY);
          if (d < bestDist) {
            bestDist = d;
            best = { type: 'large', idx, preRx: n.rx, preRy: n.ry };
          }
        });
        smallNodesRef.current.forEach((n, idx) => {
          const d = Math.hypot(n.rx - physX, n.ry - physY);
          if (d < bestDist) {
            bestDist = d;
            best = { type: 'small', idx, preRx: n.rx, preRy: n.ry };
          }
        });

        if (best) {
          setSelected(best);
          setDraft({ rx: physX, ry: physY });
        }
      },

      onPanResponderMove: (evt) => {
        if (!selectedRef.current) return;
        const { pageX, pageY } = evt.nativeEvent;
        const { scale: sc, offsetX: ox, offsetY: oy } = layoutRef.current;
        setDraft({
          rx: (pageX - ox) / sc,
          ry: (pageY - oy) / sc,
        });
      },

      onPanResponderRelease: () => {},
    })
  ).current;

  const handleConfirm = useCallback(() => {
    const sel = selectedRef.current;
    if (!sel) { setSelected(null); setDraft(null); return; }
    setDraft(prev => {
      if (!prev) return prev;
      if (sel.type === 'large') {
        setLargeNodes(ns => {
          const next = [...ns];
          next[sel.idx] = { rx: prev.rx, ry: prev.ry };
          return next;
        });
      } else {
        setSmallNodes(ns => {
          const next = [...ns];
          next[sel.idx] = { rx: prev.rx, ry: prev.ry };
          return next;
        });
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
    const sel = selectedRef.current;
    const finalLarge = [...largeNodesRef.current];
    const finalSmall = [...smallNodesRef.current];

    setSaveStatus('saving');
    const p = physicsRef.current;
    for (let i = 0; i < p.largeNodes.length && i < finalLarge.length; i++) {
      p.largeNodes[i].rx = finalLarge[i].rx;
      p.largeNodes[i].ry = finalLarge[i].ry;
    }
    for (let i = 0; i < p.smallNodes.length && i < finalSmall.length; i++) {
      p.smallNodes[i].rx = finalSmall[i].rx;
      p.smallNodes[i].ry = finalSmall[i].ry;
    }
    try {
      await saveMesenteryConfig({ largeNodes: finalLarge, smallNodes: finalSmall });
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2200);
    } catch {
      setSaveStatus('idle');
    }
  }, [physicsRef]);

  const svgW = CANVAS_W * scale;
  const svgH = CANVAS_H * scale;

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
    const color = isSel ? '#ffffff' : (type === 'large' ? '#ffaa33' : '#33ccff');
    const arm = isSel ? 10 : 6;
    const dotR = isSel ? 4 : 2.5;
    const sw = isSel ? 1.5 : 0.8;

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
          stroke={color} strokeWidth={sw} strokeOpacity={isSel ? 1 : 0.72} />
        <Line x1={sx} y1={sy - arm} x2={sx} y2={sy + arm}
          stroke={color} strokeWidth={sw} strokeOpacity={isSel ? 1 : 0.72} />
        <Circle cx={sx} cy={sy} r={dotR}
          fill={color} fillOpacity={isSel ? 1 : 0.8} />
      </React.Fragment>
    );
  });

  const selLabel = selected
    ? `${selected.type === 'large' ? '大肠' : '小肠'}[${selected.idx}]  (${(draft?.rx ?? (selected.type === 'large' ? largeNodes[selected.idx].rx : smallNodes[selected.idx].rx)).toFixed(1)}, ${(draft?.ry ?? (selected.type === 'large' ? largeNodes[selected.idx].ry : smallNodes[selected.idx].ry)).toFixed(1)})`
    : null;

  return (
    <View style={[styles.container, { backgroundColor: '#0a0404' }]}>
      <View style={[styles.header, { paddingTop: topPad }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => setScreen('settings')}>
          <Text style={styles.backBtnText}>← 返回设置</Text>
        </TouchableOpacity>
        <Text style={styles.title}>肠系膜编辑模式</Text>
        {selLabel && <Text style={styles.selInfo}>{selLabel}</Text>}
      </View>

      <View
        style={styles.canvasArea}
        onLayout={e => setCanvasSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
        {...panResponder.panHandlers}
      >
        <Svg
          width={svgW}
          height={svgH}
          style={{ position: 'absolute', left: offsetX, top: offsetY }}
          viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
        >
          <Rect x={0} y={0} width={CANVAS_W} height={CANVAS_H} fill="#0a0404" />
          <Ellipse
            cx={CAVITY_CX} cy={CAVITY_CY} rx={CAVITY_RX} ry={CAVITY_RY}
            fill="none" stroke="#442222" strokeWidth={1.5} strokeDasharray="6,4"
          />
          <SvgText x={6} y={12} fill="#ffaa33" fontSize={8} opacity={0.6}>▪ 大肠节点</SvgText>
          <SvgText x={6} y={22} fill="#33ccff" fontSize={8} opacity={0.6}>▪ 小肠节点</SvgText>
          <SvgText x={6} y={32} fill="#888888" fontSize={7} opacity={0.5}>虚圈=自由范围</SvgText>

          {renderNodes(smallNodes, 'small', () => SMALL_MESENTERY_DEAD_ZONE)}
          {renderNodes(largeNodes, 'large', (idx) => largeNodeMesentery(idx).deadZone)}
        </Svg>

        {!selected && (
          <View style={styles.hintBox} pointerEvents="none">
            <Text style={styles.hintText}>点击节点选择，拖动修改坐标</Text>
          </View>
        )}
      </View>

      <View style={[styles.bottomBar, { paddingBottom: bottomPad + 6 }]}>
        <View style={styles.btnRow}>
          <TouchableOpacity
            style={[styles.btn, styles.btnCancel, !selected && styles.btnDisabled]}
            onPress={handleCancel}
            disabled={!selected}
          >
            <Text style={[styles.btnText, !selected && { color: '#555' }]}>取消</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.btn, styles.btnConfirm, !selected && styles.btnDisabled]}
            onPress={handleConfirm}
            disabled={!selected}
          >
            <Text style={[styles.btnText, !selected && { color: '#555' }]}>确认</Text>
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
              {saveStatus === 'saving' ? '保存中…' : saveStatus === 'saved' ? '已保存 ✓' : '保存'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#ffaa33' }]} />
            <Text style={styles.legendText}>大肠肠系膜 ({N_LARGE}节点)</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#33ccff' }]} />
            <Text style={styles.legendText}>小肠肠系膜 ({N_SMALL}节点)</Text>
          </View>
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
    paddingHorizontal: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#2a1515',
    backgroundColor: '#140808',
    gap: 8,
  },
  backBtn: { padding: 4 },
  backBtnText: { color: '#ffaa33', fontSize: 13, fontFamily: 'Inter_400Regular' },
  title: { flex: 1, fontSize: 14, fontFamily: 'Inter_600SemiBold', color: '#ffffff' },
  selInfo: { fontSize: 10, fontFamily: 'Inter_400Regular', color: '#aaaaaa' },
  canvasArea: { flex: 1, position: 'relative', overflow: 'hidden' },
  hintBox: {
    position: 'absolute',
    bottom: 14,
    left: 0, right: 0,
    alignItems: 'center',
  },
  hintText: {
    color: 'rgba(255,255,255,0.30)',
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },
  bottomBar: {
    borderTopWidth: 1,
    borderTopColor: '#2a1515',
    backgroundColor: '#140808',
    paddingTop: 10,
    paddingHorizontal: 14,
    gap: 8,
  },
  btnRow: { flexDirection: 'row', gap: 10 },
  btn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnCancel: { backgroundColor: '#3a1a1a' },
  btnConfirm: { backgroundColor: '#1a3a1a' },
  btnSave: { backgroundColor: '#1a2a4a' },
  btnDisabled: { opacity: 0.35 },
  btnText: { color: '#ffffff', fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  legendRow: {
    flexDirection: 'row', gap: 16, alignItems: 'center', justifyContent: 'center',
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { color: '#666', fontSize: 10, fontFamily: 'Inter_400Regular' },
});
