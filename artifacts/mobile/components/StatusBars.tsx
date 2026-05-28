import React, { useRef, useEffect } from 'react';
import { View, Text, Animated, StyleSheet, ViewStyle } from 'react-native';
import { useColors } from '@/hooks/useColors';

interface Props {
  hp: number;
  pleasure: number;
  smallTransplantCount?: number;
  largeTransplantCount?: number;
  embedded?: boolean;
}

function HorizBar({ value, color, bgColor, label }: {
  value: number; color: string; bgColor: string; label: string;
}) {
  const anim = useRef(new Animated.Value(value)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: value, duration: 280, useNativeDriver: false }).start();
  }, [value]);

  return (
    <View style={styles.barRow}>
      <Text style={[styles.barLabel, { color }]}>{label}</Text>
      <View style={[styles.barTrack, { backgroundColor: bgColor }]}>
        <Animated.View
          style={[
            styles.barFill,
            {
              backgroundColor: color,
              width: anim.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }),
            },
          ]}
        />
      </View>
      <Text style={[styles.barValue, { color }]}>{Math.round(value)}</Text>
    </View>
  );
}

export function StatusBars({ hp, pleasure, smallTransplantCount, largeTransplantCount, embedded = false }: Props) {
  const colors = useColors();
  const showTransplant = (smallTransplantCount ?? 0) > 0 || (largeTransplantCount ?? 0) > 0;

  const wrapperStyle: ViewStyle = embedded
    ? styles.wrapperEmbedded
    : styles.wrapperOverlay;

  return (
    <View style={wrapperStyle}>
      <HorizBar value={hp} color={colors.hp} bgColor={colors.hpBg} label="HP" />
      <HorizBar value={pleasure} color={colors.pleasure} bgColor={colors.pleasureBg} label="快" />
      {showTransplant && (
        <View style={styles.transplantRow}>
          {(smallTransplantCount ?? 0) > 0 && (
            <Text style={[styles.transplantText, { color: colors.mutedForeground }]}>
              小×{smallTransplantCount}
            </Text>
          )}
          {(largeTransplantCount ?? 0) > 0 && (
            <Text style={[styles.transplantText, { color: colors.mutedForeground }]}>
              大×{largeTransplantCount}
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapperOverlay: {
    position: 'absolute',
    left: 6,
    right: 8,
    top: 4,
    gap: 4,
    zIndex: 3,
  },
  wrapperEmbedded: {
    flex: 1,
    gap: 4,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  barLabel: {
    fontSize: 9,
    fontFamily: 'Inter_700Bold',
    width: 14,
    textAlign: 'right',
    letterSpacing: 0.3,
  },
  barTrack: {
    flex: 1,
    height: 7,
    borderRadius: 4,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
    minWidth: 2,
  },
  barValue: {
    fontSize: 8,
    fontFamily: 'Inter_600SemiBold',
    width: 20,
    textAlign: 'right',
  },
  transplantRow: {
    flexDirection: 'row',
    gap: 6,
    paddingLeft: 19,
  },
  transplantText: {
    fontSize: 8,
    fontFamily: 'Inter_400Regular',
    opacity: 0.7,
  },
});
