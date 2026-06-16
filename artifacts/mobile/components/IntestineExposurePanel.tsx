import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useGame } from '@/contexts/GameContext';
import { INTESTINE_HOOK_TOOL_LIST } from '../constants/gameConfig';
import type { HookToolId } from '../constants/gameConfig';

const HOOK_ICONS: Record<string, string> = {
  '手指勾肠': 'git-commit',
  '铁钩':    'anchor',
  '长柄夹':  'scissors',
  '手术机械臂': 'cpu',
};

export function IntestineExposurePanel() {
  const colors = useColors();
  const { state, setHookTool } = useGame();

  const { hookTool, hookInserted, hookGrabActive, exposedSmallIndices, navelPierced, hookedPendingIndices } = state;
  const hasPending = (hookedPendingIndices?.length ?? 0) > 0;

  return (
    <ScrollView showsVerticalScrollIndicator={false} style={styles.scroll} nestedScrollEnabled>
      <Text style={[styles.title, { color: colors.mutedForeground }]}>勾肠工具</Text>

      {INTESTINE_HOOK_TOOL_LIST.map(tool => {
        const isSelected = hookTool === tool.id;
        return (
          <TouchableOpacity
            key={tool.id}
            style={[
              styles.toolItem,
              {
                borderColor: isSelected ? `${colors.primary}cc` : colors.border,
                backgroundColor: isSelected ? `${colors.primary}18` : 'transparent',
              },
            ]}
            onPress={() => setHookTool(isSelected ? null : tool.id as HookToolId)}
            disabled={hookInserted}
            activeOpacity={0.75}
          >
            <Feather
              name={(HOOK_ICONS[tool.id] ?? 'git-commit') as any}
              size={14}
              color={isSelected ? colors.primary : colors.mutedForeground}
            />
            <View style={styles.toolText}>
              <Text style={[styles.toolName, { color: isSelected ? colors.primary : colors.foreground }]}>
                {tool.id}
              </Text>
              <Text style={[styles.toolDesc, { color: colors.mutedForeground }]}>
                {tool.desc} · {tool.rodLength}px杆长
              </Text>
            </View>
            {isSelected && (
              <View style={[styles.dot, { backgroundColor: colors.primary }]} />
            )}
          </TouchableOpacity>
        );
      })}

      <View style={[styles.divider, { backgroundColor: colors.border }]} />

      {/* Status indicators */}
      <View style={styles.statusRow}>
        <View style={[styles.statusDot, { backgroundColor: navelPierced ? '#88dd88' : '#888' }]} />
        <Text style={[styles.statusText, { color: colors.mutedForeground }]}>
          {navelPierced ? '肚脐已刺穿' : '需先刺穿肚脐'}
        </Text>
      </View>

      {hookInserted && (
        <View style={styles.statusRow}>
          <View style={[styles.statusDot, { backgroundColor: '#88aaff' }]} />
          <Text style={[styles.statusText, { color: '#88aaff' }]}>
            工具已插入 {hookGrabActive ? '· 抓取中' : ''}
          </Text>
        </View>
      )}

      {hasPending && (
        <View style={styles.statusRow}>
          <View style={[styles.statusDot, { backgroundColor: '#ff8844' }]} />
          <Text style={[styles.statusText, { color: '#ff8844' }]}>
            已钩住 {hookedPendingIndices!.length} 节 — 向外拖动拉出
          </Text>
        </View>
      )}

      {exposedSmallIndices.length > 0 && (
        <View style={styles.statusRow}>
          <View style={[styles.statusDot, { backgroundColor: '#ff8844' }]} />
          <Text style={[styles.statusText, { color: '#ff8844' }]}>
            {exposedSmallIndices.length} 节肠管已露出体外
          </Text>
        </View>
      )}

      <View style={[styles.divider, { backgroundColor: colors.border }]} />

      <Text style={[styles.hint, { color: colors.mutedForeground }]}>
        操作按钮显示在屏幕下方
      </Text>

      <View style={styles.spacer} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  title: {
    fontSize: 10,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 1,
    textTransform: 'uppercase',
    paddingHorizontal: 4,
    marginBottom: 6,
  },
  toolItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 7,
    borderRadius: 6,
    borderWidth: 1,
    marginBottom: 4,
    gap: 8,
  },
  toolText: { flex: 1 },
  toolName: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  toolDesc: { fontSize: 9, fontFamily: 'Inter_400Regular', marginTop: 1 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  divider: { height: 1, marginVertical: 8, opacity: 0.4 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4, paddingHorizontal: 2 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 10, fontFamily: 'Inter_400Regular' },
  hint: { fontSize: 9, fontFamily: 'Inter_400Regular', paddingHorizontal: 4, opacity: 0.6 },
  spacer: { height: 8 },
});
