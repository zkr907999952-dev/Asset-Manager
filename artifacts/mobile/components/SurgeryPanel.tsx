import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useGame } from '@/contexts/GameContext';

interface SurgBtnProps {
  label: string;
  subLabel: string;
  icon: string;
  onPress: () => void;
  variant?: 'normal' | 'danger' | 'confirm' | 'disabled';
}

function SurgButton({ label, subLabel, icon, onPress, variant = 'normal' }: SurgBtnProps) {
  const colors = useColors();
  const isDisabled = variant === 'disabled';
  const isDanger = variant === 'danger';
  const isConfirm = variant === 'confirm';
  const tint = isDisabled ? colors.mutedForeground
    : isDanger ? '#e05050'
    : isConfirm ? '#50c050'
    : colors.primary;

  return (
    <TouchableOpacity
      style={[styles.btn, {
        borderColor: isDisabled ? colors.border : `${tint}88`,
        backgroundColor: isDisabled ? 'transparent' : `${tint}12`,
      }]}
      onPress={isDisabled ? undefined : onPress}
      activeOpacity={0.7}
    >
      <Feather name={icon as any} size={13} color={isDisabled ? colors.mutedForeground : tint} />
      <View style={styles.btnText}>
        <Text style={[styles.btnLabel, { color: isDisabled ? colors.mutedForeground : colors.foreground }]}>
          {label}
        </Text>
        <Text style={[styles.btnSub, { color: colors.mutedForeground }]}>{subLabel}</Text>
      </View>
    </TouchableOpacity>
  );
}

export function SurgeryPanel() {
  const colors = useColors();
  const {
    state,
    performFirstAid, startTransfusion,
    repairIntestine, sutureIntestine,
    performNavelSurgery,
    transplantSmallIntestine, transplantLargeIntestine, transplantAllIntestines,
    enterMesenterySelection, executeMesenterySelection, cancelMesenterySelection,
  } = useGame();

  const inSelMode = state.mesenterySelectionMode;
  const selCount = state.mesenterySelectedNodes?.length ?? 0;

  return (
    <ScrollView showsVerticalScrollIndicator={false} style={styles.scroll}>
      <Text style={[styles.title, { color: colors.mutedForeground }]}>手术操作</Text>

      <Text style={[styles.section, { color: colors.mutedForeground }]}>紧急处理</Text>
      <SurgButton icon="heart" label="急救" subLabel="濒死时提供25点生命值" onPress={performFirstAid} variant="danger" />
      <SurgButton icon="activity" label="输血" subLabel="缓慢恢复30点生命值" onPress={startTransfusion} />

      <Text style={[styles.section, { color: colors.mutedForeground }]}>肠道修复</Text>
      <SurgButton icon="plus-circle" label="肠道修补手术" subLabel="清除所有穿孔，留下修补痕迹" onPress={repairIntestine} />
      <SurgButton icon="scissors" label="断肠缝合手术" subLabel="清除所有断裂，留下缝合痕迹" onPress={sutureIntestine} />
      <SurgButton icon="circle" label="肚脐贯通手术" subLabel="永久开放肚脐，工具可直接插入" onPress={performNavelSurgery} />

      <Text style={[styles.section, { color: colors.mutedForeground }]}>移植手术</Text>
      <SurgButton icon="refresh-cw" label="小肠移植手术" subLabel="重置小肠（初始健康85%，随机色调）" onPress={transplantSmallIntestine} variant="danger" />
      <SurgButton icon="refresh-cw" label="大肠移植手术" subLabel="重置大肠（初始健康85%，随机色调）" onPress={transplantLargeIntestine} variant="danger" />
      <SurgButton icon="refresh-cw" label="全肠移植手术" subLabel="重置全部肠道（初始健康85%，随机色调）" onPress={transplantAllIntestines} variant="danger" />

      <Text style={[styles.section, { color: colors.mutedForeground }]}>精细手术</Text>
      {!inSelMode ? (
        <SurgButton
          icon="crop"
          label="肠系膜切断手术"
          subLabel="点击进入选区：触碰大肠节点选择范围"
          onPress={enterMesenterySelection}
        />
      ) : (
        <View>
          <View style={[styles.selBanner, { borderColor: `${colors.primary}66`, backgroundColor: `${colors.primary}12` }]}>
            <Feather name="map-pin" size={12} color={colors.primary} />
            <Text style={[styles.selText, { color: colors.primary }]}>
              选区模式：已选 {selCount} 个节点{'\n'}在模拟画面中触碰大肠节点选择范围
            </Text>
          </View>
          <SurgButton icon="check-circle" label="执行切断" subLabel={`切断选中 ${selCount} 个节点的肠系膜`} onPress={executeMesenterySelection} variant="confirm" />
          <SurgButton icon="x-circle" label="取消选区" subLabel="退出选区模式" onPress={cancelMesenterySelection} variant="danger" />
        </View>
      )}

      <View style={styles.spacer} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { maxHeight: 480 },
  title: {
    fontSize: 10,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 1,
    textTransform: 'uppercase',
    paddingHorizontal: 4,
    marginBottom: 4,
  },
  section: {
    fontSize: 9,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    paddingHorizontal: 4,
    marginTop: 6,
    marginBottom: 3,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    marginBottom: 3,
    gap: 8,
  },
  btnText: { flex: 1 },
  btnLabel: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  btnSub: { fontSize: 9, fontFamily: 'Inter_400Regular', marginTop: 1 },
  selBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
    marginBottom: 4,
  },
  selText: { fontSize: 10, fontFamily: 'Inter_400Regular', flex: 1, lineHeight: 14 },
  spacer: { height: 16 },
});
