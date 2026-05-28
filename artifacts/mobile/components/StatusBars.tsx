import React, { useRef, useEffect } from 'react';
import { View, Text, Animated, StyleSheet, ViewStyle } from 'react-native';
import { useColors } from '@/hooks/useColors';

interface Props {
  hp: number;
  pleasure: number;
  embedded?: boolean;
}

function HorizBar({ value, color, label }: {
  value: number; color: string; label: string;
}) {
  const anim = useRef(new Animated.Value(value)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: value, duration: 280, useNativeDriver: false }).start();
  }, [value]);

  return (
    <View style={styles.barRow}>
      <Text style={[styles.barLabel, { color }]}>{label}</Text>
      <View style={styles.barTrack}>
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

export function StatusBars({ hp, pleasure, embedded = false }: Props) {
  const colors = useColors();

  const wrapperStyle: ViewStyle = embedded
    ? styles.wrapperEmbedded
    : styles.wrapperOverlay;

  return (
    <View style={wrapperStyle}>
      <HorizBar value={hp} color={colors.hp} label="HP" />
      <HorizBar value={pleasure} color={colors.pleasure} label="快" />
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
    gap: 5,
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
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  barFill: {
    height: '100%',
    borderRadius: 5,
    minWidth: 2,
  },
  barValue: {
    fontSize: 9,
    fontFamily: 'Inter_600SemiBold',
    width: 20,
    textAlign: 'right',
  },
});
