import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useGame } from '@/contexts/GameContext';

export function HookActionBar() {
  const colors = useColors();
  const {
    state,
    insertHookViaNavel,
    retractHook,
    activateHookGrab,
    clearExposedNodes,
  } = useGame();

  const { hookTool, hookInserted, hookGrabActive, navelPierced, exposedSmallIndices, hookedPendingIndices } = state;

  const show = !!hookTool || hookInserted || exposedSmallIndices.length > 0;
  if (!show) return null;

  const hasPending = (hookedPendingIndices?.length ?? 0) > 0;

  return (
    <View style={styles.bar} pointerEvents="box-none">
      <View style={styles.row}>
        {!hookInserted ? (
          <TouchableOpacity
            style={[
              styles.btn,
              {
                borderColor: (navelPierced && !!hookTool) ? '#88aaffcc' : '#44446688',
                backgroundColor: (navelPierced && !!hookTool) ? 'rgba(136,170,255,0.15)' : 'rgba(20,10,30,0.7)',
                opacity: (navelPierced && !!hookTool) ? 1 : 0.45,
              },
            ]}
            onPress={insertHookViaNavel}
            disabled={!navelPierced || !hookTool}
            activeOpacity={0.75}
          >
            <Feather name="log-in" size={13} color="#88aaff" />
            <Text style={[styles.btnText, { color: '#88aaff' }]}>经肚脐插入</Text>
          </TouchableOpacity>
        ) : (
          <>
            {!hookGrabActive && (
              <TouchableOpacity
                style={[styles.btn, { borderColor: '#ff884499', backgroundColor: 'rgba(255,136,68,0.12)' }]}
                onPress={activateHookGrab}
                activeOpacity={0.75}
              >
                <Feather name="zap" size={13} color="#ff8844" />
                <Text style={[styles.btnText, { color: '#ff8844' }]}>勾住肠管</Text>
              </TouchableOpacity>
            )}
            {hookGrabActive && (
              <View style={[styles.btn, { borderColor: hasPending ? '#ff884466' : '#ff884422', opacity: 0.8 }]}>
                <Feather name={hasPending ? 'check-circle' : 'loader'} size={13} color="#ff8844" />
                <Text style={[styles.btnText, { color: '#ff8844' }]}>
                  {hasPending ? `已钩住${hookedPendingIndices!.length}节 — 拖向肚脐拉出` : '搜索中...'}
                </Text>
              </View>
            )}
            <TouchableOpacity
              style={[styles.btn, { borderColor: `${colors.border}88`, backgroundColor: 'rgba(20,10,30,0.7)' }]}
              onPress={retractHook}
              activeOpacity={0.75}
            >
              <Feather name="log-out" size={13} color={colors.mutedForeground} />
              <Text style={[styles.btnText, { color: colors.mutedForeground }]}>收回工具</Text>
            </TouchableOpacity>
          </>
        )}
        {exposedSmallIndices.length > 0 && (
          <TouchableOpacity
            style={[styles.btn, { borderColor: '#e8404066', backgroundColor: 'rgba(232,64,64,0.1)' }]}
            onPress={clearExposedNodes}
            activeOpacity={0.75}
          >
            <Feather name="rotate-ccw" size={13} color="#e84040" />
            <Text style={[styles.btnText, { color: '#e84040' }]}>还纳{exposedSmallIndices.length}节</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    paddingHorizontal: 10,
    paddingBottom: 4,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    justifyContent: 'center',
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: 'rgba(20,10,30,0.75)',
  },
  btnText: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
  },
});
