import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { GameSlider } from './GameSlider';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useGame } from '@/contexts/GameContext';
import { TOOLS } from '../constants/gameConfig';


const TOOL_PARAMS: Record<string, {
  p1Label: string; p1Max: number; p1Step: number;
  p2Label: string; p2Max: number; p2Step: number;
}> = {
  [TOOLS.METAL_ROD]:     { p1Label: '杆长',    p1Max: 100, p1Step: 1, p2Label: '搅动强度', p2Max: 100, p2Step: 1 },
  [TOOLS.GRAB]:          { p1Label: '抓取范围', p1Max: 100, p1Step: 1, p2Label: '抓取力度', p2Max: 100, p2Step: 1 },
  [TOOLS.VIBRATOR]:      { p1Label: '震动强度', p1Max: 100, p1Step: 1, p2Label: '震动范围', p2Max: 100, p2Step: 1 },
  [TOOLS.NEEDLE]:        { p1Label: '针长',     p1Max: 100, p1Step: 1, p2Label: '穿刺强度', p2Max: 100, p2Step: 1 },
  [TOOLS.ELECTRIC]:      { p1Label: '电压',     p1Max: 100, p1Step: 1, p2Label: '电击范围', p2Max: 100, p2Step: 1 },
  [TOOLS.SYRINGE]:       { p1Label: '注射速度', p1Max: 100, p1Step: 1, p2Label: '泻药浓度', p2Max: 100, p2Step: 1 },
  [TOOLS.ENEMA]:         { p1Label: '灌肠流量', p1Max: 200, p1Step: 1, p2Label: '刺激程度', p2Max: 100, p2Step: 1 },
  [TOOLS.BAYONET]:       { p1Label: '刺刀长度', p1Max: 100, p1Step: 1, p2Label: '刺刀宽度', p2Max: 100, p2Step: 1 },
  [TOOLS.SILICONE_ROD]:  { p1Label: '直径',     p1Max: 100, p1Step: 1, p2Label: '速度',     p2Max: 100, p2Step: 1 },
  [TOOLS.ANAL_BEADS]:    { p1Label: '插入深度', p1Max: 100, p1Step: 1, p2Label: '拉出速度', p2Max: 100, p2Step: 1 },
  [TOOLS.VIBRATING_EGG]: { p1Label: '震动强度', p1Max: 100, p1Step: 1, p2Label: '移动速度', p2Max: 100, p2Step: 1 },
};

function ToolSection({ toolId, isActive }: { toolId: string; isActive: boolean }) {
  const colors = useColors();
  const { state, setToolState, setActiveTool, clearElectrodes, setForcePierceMode, setViewMode, addClampPoint, clearClampPoints } = useGame();

  const focusTool = () => {
    if (!isActive) setActiveTool(toolId as any);
  };
  const ts = state.toolStates[toolId];
  const params = TOOL_PARAMS[toolId];
  if (!ts || !params) return null;

  const active = ts.active;
  const p1 = ts.param1;
  const p2 = ts.param2;

  const startStopLabel = () => {
    if (toolId === TOOLS.SILICONE_ROD || toolId === TOOLS.ANAL_BEADS) {
      return active ? '停振' : '震动';
    }
    return active ? '停止' : '启动';
  };

  return (
    <View
      style={[
        styles.toolSection,
        { borderColor: isActive ? `${colors.primary}55` : `${colors.border}33` },
        isActive && { backgroundColor: `${colors.primary}0a` },
      ]}
      onStartShouldSetResponder={() => { focusTool(); return false; }}
    >
      <View style={styles.sectionHeader}>
        <View style={styles.sectionHeaderLeft}>
          <View style={[
            styles.statusDot,
            { backgroundColor: active ? colors.primary : `${colors.mutedForeground}55` },
          ]} />
          <Text style={[styles.sectionTitle, {
            color: isActive ? colors.primary : colors.foreground,
          }]}>
            {toolId}
          </Text>
          {isActive && (
            <Text style={[styles.activeTag, { color: `${colors.primary}99`, borderColor: `${colors.primary}44` }]}>
              控制中
            </Text>
          )}
        </View>
        <View style={styles.sectionHeaderRight}>
          {toolId === TOOLS.ELECTRIC && (
            <TouchableOpacity
              style={[styles.extraBtn, { borderColor: `${colors.border}66` }]}
              onPress={() => { focusTool(); clearElectrodes(); }}
            >
              <Feather name="trash-2" size={10} color={colors.mutedForeground} />
              <Text style={[styles.extraBtnText, { color: colors.mutedForeground }]}>清除电极</Text>
            </TouchableOpacity>
          )}
          {toolId === TOOLS.GRAB && (
            <>
              <TouchableOpacity
                style={[styles.extraBtn, { borderColor: 'rgba(255,180,40,0.6)', backgroundColor: 'rgba(255,160,20,0.08)' }]}
                onPress={() => { focusTool(); addClampPoint(); }}
              >
                <Feather name="anchor" size={10} color="#e8a820" />
                <Text style={[styles.extraBtnText, { color: '#e8a820' }]}>钳制点</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.extraBtn, { borderColor: `${colors.border}66` }]}
                onPress={() => { focusTool(); clearClampPoints(); }}
              >
                <Feather name="trash-2" size={10} color={colors.mutedForeground} />
                <Text style={[styles.extraBtnText, { color: colors.mutedForeground }]}>清除钳制</Text>
              </TouchableOpacity>
            </>
          )}
          {toolId === TOOLS.METAL_ROD && !state.navelPierced && !state.forcePierceMode && (
            <TouchableOpacity
              style={[styles.extraBtn, { borderColor: 'rgba(200,60,60,0.55)' }]}
              onPress={() => { focusTool(); setViewMode('external'); setForcePierceMode(true); }}
            >
              <Feather name="zap" size={10} color="#ff8080" />
              <Text style={[styles.extraBtnText, { color: '#ff8080' }]}>强行穿脐</Text>
            </TouchableOpacity>
          )}
          {toolId === TOOLS.METAL_ROD && state.forcePierceMode && (
            <TouchableOpacity
              style={[styles.extraBtn, { borderColor: 'rgba(200,60,60,0.55)' }]}
              onPress={() => { setForcePierceMode(false); }}
            >
              <Feather name="x" size={10} color="#ff8080" />
              <Text style={[styles.extraBtnText, { color: '#ff8080' }]}>取消穿脐</Text>
            </TouchableOpacity>
          )}
          {toolId === TOOLS.METAL_ROD && (() => {
            const electrified = state.toolStates[TOOLS.METAL_ROD]?.electrified === true;
            return (
              <TouchableOpacity
                style={[styles.extraBtn, {
                  borderColor: electrified ? 'rgba(255,220,40,0.7)' : `${colors.border}66`,
                  backgroundColor: electrified ? 'rgba(255,220,40,0.12)' : 'transparent',
                }]}
                onPress={() => { focusTool(); setToolState(TOOLS.METAL_ROD, { electrified: !electrified }); }}
              >
                <Feather name="zap" size={10} color={electrified ? '#ffee44' : colors.mutedForeground} />
                <Text style={[styles.extraBtnText, { color: electrified ? '#ffee44' : colors.mutedForeground }]}>
                  {electrified ? '断电' : '通电'}
                </Text>
              </TouchableOpacity>
            );
          })()}
          {toolId !== TOOLS.GRAB && toolId !== TOOLS.NEEDLE && (
            <TouchableOpacity
              style={[
                styles.toggleBtn,
                {
                  backgroundColor: active ? `${colors.primary}cc` : `${colors.secondary}cc`,
                  borderColor: active ? `${colors.primary}88` : `${colors.border}55`,
                },
              ]}
              onPress={() => { focusTool(); setToolState(toolId, { active: !active }); }}
              activeOpacity={0.8}
            >
              <Feather
                name={active ? 'pause' : 'play'}
                size={11}
                color={active ? colors.primaryForeground : colors.foreground}
              />
              <Text style={[styles.toggleText, {
                color: active ? colors.primaryForeground : colors.foreground,
              }]}>
                {startStopLabel()}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={styles.sliders}>
        <View style={styles.sliderRow}>
          <Text style={[styles.sliderLabel, { color: colors.mutedForeground }]}>
            {params.p1Label}：<Text style={{ color: colors.foreground }}>{Math.round(p1)}</Text>
          </Text>
          <GameSlider
            minimumValue={0}
            maximumValue={params.p1Max}
            step={params.p1Step}
            value={p1}
            onValueChange={v => { focusTool(); setToolState(toolId, { param1: v }); }}
            minimumTrackTintColor={colors.primary}
            maximumTrackTintColor={colors.secondary}
            thumbTintColor={colors.primary}
          />
        </View>
        <View style={styles.sliderRow}>
          <Text style={[styles.sliderLabel, { color: colors.mutedForeground }]}>
            {params.p2Label}：<Text style={{ color: colors.foreground }}>{Math.round(p2)}</Text>
          </Text>
          <GameSlider
            minimumValue={0}
            maximumValue={params.p2Max}
            step={params.p2Step}
            value={p2}
            onValueChange={v => { focusTool(); setToolState(toolId, { param2: v }); }}
            minimumTrackTintColor={colors.accent}
            maximumTrackTintColor={colors.secondary}
            thumbTintColor={colors.accent}
          />
        </View>
      </View>
    </View>
  );
}

export function ToolControls() {
  const colors = useColors();
  const { state } = useGame();
  const [collapsed, setCollapsed] = useState(false);

  const { enabledTools, activeTool } = state;
  if (!enabledTools || enabledTools.length === 0) return null;

  const anyRunning = enabledTools.some(id => state.toolStates[id]?.active);

  if (collapsed) {
    return (
      <TouchableOpacity
        style={[styles.collapsedTab, {
          backgroundColor: 'rgba(19,8,16,0.92)',
          borderColor: `${colors.border}88`,
          borderTopColor: anyRunning ? `${colors.primary}88` : `${colors.border}88`,
        }]}
        onPress={() => setCollapsed(false)}
        activeOpacity={0.85}
      >
        <View style={styles.collapsedLeft}>
          <View style={[styles.statusDot, {
            backgroundColor: anyRunning ? colors.primary : colors.mutedForeground,
          }]} />
          <Text style={[styles.collapsedName, { color: anyRunning ? colors.primary : colors.foreground }]}>
            {enabledTools.length} 个工具已激活
          </Text>
          <Text style={[styles.collapsedStatus, { color: colors.mutedForeground }]}>
            {anyRunning ? '运行中' : '已暂停'}
          </Text>
        </View>
        <Feather name="chevron-up" size={14} color={colors.mutedForeground} />
      </TouchableOpacity>
    );
  }

  return (
    <View style={[styles.container, { borderTopColor: `${colors.border}55` }]}>
      <View style={[styles.panelHeader, { borderBottomColor: `${colors.border}33` }]}>
        <Text style={[styles.panelTitle, { color: colors.mutedForeground }]}>工具控制</Text>
        <TouchableOpacity
          style={[styles.iconBtn, { borderColor: `${colors.border}55` }]}
          onPress={() => setCollapsed(true)}
          activeOpacity={0.7}
        >
          <Feather name="chevron-down" size={13} color={colors.mutedForeground} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
      >
        {enabledTools.map(toolId => (
          <ToolSection
            key={toolId}
            toolId={toolId}
            isActive={toolId === activeTool}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderTopWidth: 1,
    backgroundColor: 'rgba(19,8,16,0.92)',
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderBottomWidth: 1,
  },
  panelTitle: {
    flex: 1,
    fontSize: 10,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  iconBtn: {
    padding: 4,
    borderRadius: 5,
    borderWidth: 1,
  },
  scroll: {
    maxHeight: 230,
  },
  scrollContent: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 6,
  },
  toolSection: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 6,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    flex: 1,
  },
  sectionHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  sectionTitle: {
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
  },
  activeTag: {
    fontSize: 9,
    fontFamily: 'Inter_400Regular',
    borderWidth: 1,
    borderRadius: 3,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  toggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 5,
    borderWidth: 1,
    gap: 4,
  },
  toggleText: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
  },
  extraBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 5,
    borderWidth: 1,
    gap: 3,
  },
  extraBtnText: {
    fontSize: 10,
    fontFamily: 'Inter_400Regular',
  },
  sliders: {
    gap: 3,
  },
  sliderRow: {
    gap: 1,
  },
  sliderLabel: {
    fontSize: 10,
    fontFamily: 'Inter_400Regular',
  },
  collapsedTab: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderTopWidth: 2,
    borderLeftWidth: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
  },
  collapsedLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  collapsedName: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
  },
  collapsedStatus: {
    fontSize: 10,
    fontFamily: 'Inter_400Regular',
  },
});
