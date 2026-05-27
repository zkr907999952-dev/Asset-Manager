import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { GameSlider } from './GameSlider';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useGame } from '@/contexts/GameContext';
import { TOOLS } from '../constants/gameConfig';

const TOOL_PARAMS: Record<string, { p1Label: string; p1Max: number; p1Step: number; p2Label: string; p2Max: number; p2Step: number }> = {
  [TOOLS.METAL_ROD]:  { p1Label: '杆长', p1Max: 100, p1Step: 1, p2Label: '搅动强度', p2Max: 100, p2Step: 1 },
  [TOOLS.GRAB]:       { p1Label: '抓取范围', p1Max: 100, p1Step: 1, p2Label: '抓取力度', p2Max: 100, p2Step: 1 },
  [TOOLS.VIBRATOR]:   { p1Label: '震动强度', p1Max: 100, p1Step: 1, p2Label: '震动范围', p2Max: 100, p2Step: 1 },
  [TOOLS.NEEDLE]:     { p1Label: '针长', p1Max: 100, p1Step: 1, p2Label: '穿刺强度', p2Max: 100, p2Step: 1 },
  [TOOLS.ELECTRIC]:   { p1Label: '电压', p1Max: 100, p1Step: 1, p2Label: '电击范围', p2Max: 100, p2Step: 1 },
  [TOOLS.SYRINGE]:    { p1Label: '注射速度', p1Max: 100, p1Step: 1, p2Label: '泻药浓度', p2Max: 100, p2Step: 1 },
  [TOOLS.ENEMA]:      { p1Label: '灌肠流量', p1Max: 200, p1Step: 1, p2Label: '刺激程度', p2Max: 100, p2Step: 1 },
};

export function ToolControls() {
  const colors = useColors();
  const { state, setToolActive, setToolParam1, setToolParam2, setActiveTool, clearElectrodes } = useGame();
  const { activeTool, toolActive, toolParam1, toolParam2 } = state;

  if (!activeTool) return null;

  const params = TOOL_PARAMS[activeTool];
  if (!params) return null;

  return (
    <View style={[styles.container, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
      {/* Tool name + toggle */}
      <View style={styles.header}>
        <Text style={[styles.toolName, { color: colors.primary }]}>{activeTool}</Text>
        <View style={styles.headerRight}>
          {activeTool === TOOLS.ELECTRIC && (
            <TouchableOpacity
              style={[styles.clearBtn, { borderColor: colors.border }]}
              onPress={clearElectrodes}
            >
              <Feather name="trash-2" size={12} color={colors.mutedForeground} />
              <Text style={[styles.clearText, { color: colors.mutedForeground }]}>清除电极</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[
              styles.toggleBtn,
              { backgroundColor: toolActive ? colors.primary : colors.secondary,
                borderColor: toolActive ? colors.primary : colors.border },
            ]}
            onPress={() => setToolActive(!toolActive)}
            activeOpacity={0.8}
          >
            <Feather name={toolActive ? 'pause' : 'play'} size={13} color={toolActive ? colors.primaryForeground : colors.foreground} />
            <Text style={[styles.toggleText, { color: toolActive ? colors.primaryForeground : colors.foreground }]}>
              {toolActive ? '停止' : '启动'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.closeBtn, { borderColor: colors.border }]}
            onPress={() => setActiveTool(null)}
          >
            <Feather name="x" size={14} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Sliders */}
      <View style={styles.sliders}>
        <View style={styles.sliderRow}>
          <Text style={[styles.sliderLabel, { color: colors.mutedForeground }]}>
            {params.p1Label}: <Text style={{ color: colors.foreground }}>{Math.round(toolParam1)}</Text>
          </Text>
          <GameSlider
            minimumValue={0}
            maximumValue={params.p1Max}
            step={params.p1Step}
            value={toolParam1}
            onValueChange={setToolParam1}
            minimumTrackTintColor={colors.primary}
            maximumTrackTintColor={colors.secondary}
            thumbTintColor={colors.primary}
          />
        </View>
        <View style={styles.sliderRow}>
          <Text style={[styles.sliderLabel, { color: colors.mutedForeground }]}>
            {params.p2Label}: <Text style={{ color: colors.foreground }}>{Math.round(toolParam2)}</Text>
          </Text>
          <GameSlider
            minimumValue={0}
            maximumValue={params.p2Max}
            step={params.p2Step}
            value={toolParam2}
            onValueChange={setToolParam2}
            minimumTrackTintColor={colors.accent}
            maximumTrackTintColor={colors.secondary}
            thumbTintColor={colors.accent}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  toolName: {
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
    flex: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  toggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    gap: 4,
  },
  toggleText: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
  },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    gap: 4,
  },
  clearText: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
  },
  closeBtn: {
    padding: 5,
    borderRadius: 6,
    borderWidth: 1,
  },
  sliders: { gap: 4 },
  sliderRow: { gap: 2 },
  sliderLabel: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
  },
});
