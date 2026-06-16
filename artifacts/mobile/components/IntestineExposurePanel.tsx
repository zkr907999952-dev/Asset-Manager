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
  const {
    state,
    setHookTool,
    insertHookViaNavel,
    retractHook,
    activateHookGrab,
    clearExposedNodes,
  } = useGame();

  const { hookTool, hookInserted, hookGrabActive, exposedSmallIndices, navelPierced } = state;

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
              <Text style={[styles.toolDesc, { color: colors.mutedForeground }]}>{tool.desc}</Text>
            </View>
            {isSelected && (
              <View style={[styles.dot, { backgroundColor: colors.primary }]} />
            )}
          </TouchableOpacity>
        );
      })}

      <View style={[styles.divider, { backgroundColor: colors.border }]} />

      {/* Status */}
      <View style={styles.statusRow}>
        <View style={[styles.statusDot, { backgroundColor: navelPierced ? '#88dd88' : '#888' }]} />
        <Text style={[styles.statusText, { color: colors.mutedForeground }]}>
          {navelPierced ? '肚脐已刺穿' : '需先刺穿肚脐'}
        </Text>
      </View>

      {exposedSmallIndices.length > 0 && (
        <View style={styles.statusRow}>
          <View style={[styles.statusDot, { backgroundColor: '#ff8844' }]} />
          <Text style={[styles.statusText, { color: '#ff8844' }]}>
            {exposedSmallIndices.length} 节肠管已露出
          </Text>
        </View>
      )}

      <View style={[styles.divider, { backgroundColor: colors.border }]} />

      {/* Action buttons */}
      {!hookInserted ? (
        <TouchableOpacity
          style={[
            styles.actionBtn,
            {
              borderColor: (navelPierced && !!hookTool) ? `${colors.primary}cc` : `${colors.border}66`,
              opacity: (navelPierced && !!hookTool) ? 1 : 0.45,
            },
          ]}
          onPress={insertHookViaNavel}
          disabled={!navelPierced || !hookTool}
          activeOpacity={0.75}
        >
          <Feather name="log-in" size={13} color={colors.primary} />
          <Text style={[styles.actionText, { color: colors.primary }]}>经肚脐插入</Text>
        </TouchableOpacity>
      ) : (
        <>
          {!hookGrabActive ? (
            <TouchableOpacity
              style={[styles.actionBtn, { borderColor: '#ff884499' }]}
              onPress={activateHookGrab}
              activeOpacity={0.75}
            >
              <Feather name="zap" size={13} color="#ff8844" />
              <Text style={[styles.actionText, { color: '#ff8844' }]}>勾住肠管</Text>
            </TouchableOpacity>
          ) : (
            <View style={[styles.actionBtn, { borderColor: '#ff884466', opacity: 0.65 }]}>
              <Feather name="check-circle" size={13} color="#ff8844" />
              <Text style={[styles.actionText, { color: '#ff8844' }]}>
                {state.hookedSmallSegIdx >= 0 ? '已钩住 — 拖动钩出' : '搜索中...'}
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.actionBtn, { borderColor: `${colors.border}88`, marginTop: 4 }]}
            onPress={retractHook}
            activeOpacity={0.75}
          >
            <Feather name="log-out" size={13} color={colors.mutedForeground} />
            <Text style={[styles.actionText, { color: colors.mutedForeground }]}>收回工具</Text>
          </TouchableOpacity>
        </>
      )}

      {exposedSmallIndices.length > 0 && (
        <TouchableOpacity
          style={[styles.actionBtn, { borderColor: '#e8404066', marginTop: 4 }]}
          onPress={clearExposedNodes}
          activeOpacity={0.75}
        >
          <Feather name="rotate-ccw" size={13} color="#e84040" />
          <Text style={[styles.actionText, { color: '#e84040' }]}>还纳肠管</Text>
        </TouchableOpacity>
      )}

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
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    marginBottom: 4,
  },
  actionText: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  spacer: { height: 8 },
});
