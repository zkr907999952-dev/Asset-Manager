import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useGame } from '@/contexts/GameContext';

interface CmdBtnProps {
  label: string;
  subLabel: string;
  icon: string;
  onPress: () => void;
  cooldownSec?: number;
  disabled?: boolean;
  accentColor?: string;
  drugTimeLeft?: number;
}

function CmdButton({ label, subLabel, icon, onPress, cooldownSec = 0, disabled, accentColor, drugTimeLeft }: CmdBtnProps) {
  const colors = useColors();
  const [remaining, setRemaining] = useState(0);

  const handlePress = () => {
    if (remaining > 0 || disabled) return;
    onPress();
    if (cooldownSec > 0) {
      setRemaining(cooldownSec);
    }
  };

  useEffect(() => {
    if (remaining <= 0) return;
    const t = setInterval(() => setRemaining(r => Math.max(0, r - 1)), 1000);
    return () => clearInterval(t);
  }, [remaining > 0]);

  const isDisabled = disabled || remaining > 0;
  const borderColor = isDisabled ? colors.border : (accentColor ?? colors.primary);
  const bgColor = isDisabled ? 'transparent' : `${accentColor ?? colors.primary}18`;
  const hasDrugTimer = typeof drugTimeLeft === 'number' && drugTimeLeft > 0;

  return (
    <TouchableOpacity
      style={[styles.btn, { borderColor, backgroundColor: bgColor }]}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      <Feather name={icon as any} size={13} color={isDisabled ? colors.mutedForeground : (accentColor ?? colors.primary)} />
      <View style={styles.btnText}>
        <Text style={[styles.btnLabel, { color: isDisabled ? colors.mutedForeground : colors.foreground }]}>
          {remaining > 0 ? `${label} (${remaining}s)` : label}
        </Text>
        <Text style={[styles.btnSub, { color: colors.mutedForeground }]}>{subLabel}</Text>
      </View>
      {hasDrugTimer && (
        <View style={[styles.timerBadge, { borderColor: `${accentColor ?? colors.primary}66`, backgroundColor: `${accentColor ?? colors.primary}22` }]}>
          <Text style={[styles.timerText, { color: accentColor ?? colors.primary }]}>
            {drugTimeLeft}s
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

export function CommandPanel() {
  const colors = useColors();
  const { relaxAbdomen, takeLaxative, takeStimulant, takeSedative, takeParasiteEgg, state } = useGame();

  return (
    <ScrollView showsVerticalScrollIndicator={false} style={styles.scroll} nestedScrollEnabled>
      <Text style={[styles.title, { color: colors.mutedForeground }]}>命令指令</Text>

      <CmdButton
        icon="wind"
        label="放松腹部"
        subLabel="肌肉松弛，工具更易影响"
        onPress={relaxAbdomen}
        cooldownSec={12}
      />
      <CmdButton
        icon="droplet"
        label="服用泻药"
        subLabel="蠕动强度大幅提升20秒"
        onPress={takeLaxative}
        cooldownSec={30}
      />

      <View style={[styles.divider, { backgroundColor: colors.border }]} />
      <Text style={[styles.subTitle, { color: colors.mutedForeground }]}>药剂</Text>

      <CmdButton
        icon="zap"
        label="服用兴奋剂"
        subLabel="心率↑ 呼吸↑ 蠕动↑  过量触发心跳过速昏迷"
        onPress={takeStimulant}
        accentColor="#ffaa00"
        disabled={state.comaState === 'tachycardia'}
        drugTimeLeft={state.stimulantTimeLeft}
      />
      <CmdButton
        icon="moon"
        label="服用麻醉镇静剂"
        subLabel="心率↓ 疼痛↓ 呼吸↓  过量触发心跳过缓昏迷"
        onPress={takeSedative}
        accentColor="#6688ff"
        disabled={state.comaState === 'bradycardia'}
        drugTimeLeft={state.sedativeTimeLeft}
      />

      {state.comaState !== 'none' && (
        <View style={[styles.comaAlert, { borderColor: state.comaState === 'tachycardia' ? '#ff3333' : '#4466ff' }]}>
          <Feather
            name="alert-triangle"
            size={11}
            color={state.comaState === 'tachycardia' ? '#ff3333' : '#4466ff'}
          />
          <Text style={[styles.comaText, { color: state.comaState === 'tachycardia' ? '#ff3333' : '#4466ff' }]}>
            {state.comaState === 'tachycardia'
              ? '心跳过速昏迷  可服用镇静剂解除'
              : '心跳过缓昏迷  可服用兴奋剂解除'}
          </Text>
        </View>
      )}

      <View style={[styles.divider, { backgroundColor: colors.border }]} />
      <Text style={[styles.subTitle, { color: colors.mutedForeground }]}>寄生虫</Text>

      <CmdButton
        icon="activity"
        label="服用寄生虫卵"
        subLabel="虫卵在小肠内孵化并寄生，随时间成长"
        onPress={takeParasiteEgg}
        accentColor="#88cc66"
      />
      {state.parasites.length > 0 && (
        <View style={[styles.parasiteInfo, { borderColor: '#88cc6644', backgroundColor: '#88cc6611' }]}>
          <Text style={[styles.parasiteText, { color: '#88cc66' }]}>
            寄生体: {state.parasites.length} 个（
            {state.parasites.filter(p => p.phase === 'egg_traveling').length} 卵·
            {state.parasites.filter(p => p.phase === 'egg_hatching').length} 孵·
            {state.parasites.filter(p => p.phase === 'worm').length} 虫）
          </Text>
        </View>
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
  subTitle: {
    fontSize: 9,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 1,
    textTransform: 'uppercase',
    paddingHorizontal: 4,
    marginBottom: 4,
  },
  divider: {
    height: 1,
    marginVertical: 8,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 7,
    borderRadius: 6,
    borderWidth: 1,
    marginBottom: 4,
    gap: 8,
  },
  btnText: { flex: 1 },
  btnLabel: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  btnSub: { fontSize: 9, fontFamily: 'Inter_400Regular', marginTop: 1 },
  timerBadge: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    minWidth: 34,
    alignItems: 'center',
  },
  timerText: {
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
  },
  comaAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 5,
    borderWidth: 1,
    marginBottom: 4,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  comaText: {
    fontSize: 9,
    fontFamily: 'Inter_600SemiBold',
    flex: 1,
    flexWrap: 'wrap',
  },
  spacer: { height: 12 },
  parasiteInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 5,
    borderWidth: 1,
    marginBottom: 4,
  },
  parasiteText: {
    fontSize: 9,
    fontFamily: 'Inter_600SemiBold',
    flex: 1,
    flexWrap: 'wrap',
  },
});
