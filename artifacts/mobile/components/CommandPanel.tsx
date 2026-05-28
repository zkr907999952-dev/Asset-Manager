import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
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
}

function CmdButton({ label, subLabel, icon, onPress, cooldownSec = 0, disabled }: CmdBtnProps) {
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

  return (
    <TouchableOpacity
      style={[styles.btn, {
        borderColor: isDisabled ? colors.border : colors.primary,
        backgroundColor: isDisabled ? 'transparent' : `${colors.primary}18`,
      }]}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      <Feather name={icon as any} size={13} color={isDisabled ? colors.mutedForeground : colors.primary} />
      <View style={styles.btnText}>
        <Text style={[styles.btnLabel, { color: isDisabled ? colors.mutedForeground : colors.foreground }]}>
          {remaining > 0 ? `${label} (${remaining}s)` : label}
        </Text>
        <Text style={[styles.btnSub, { color: colors.mutedForeground }]}>{subLabel}</Text>
      </View>
    </TouchableOpacity>
  );
}

export function CommandPanel() {
  const colors = useColors();
  const { relaxAbdomen, takeLaxative } = useGame();

  return (
    <View>
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
      <CmdButton
        icon="alert-circle"
        label="服用寄生虫卵"
        subLabel="（功能预留）"
        onPress={() => {}}
        disabled
      />
    </View>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 10,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 1,
    textTransform: 'uppercase',
    paddingHorizontal: 4,
    marginBottom: 6,
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
});
