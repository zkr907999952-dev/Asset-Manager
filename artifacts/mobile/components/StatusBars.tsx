import React, { useRef, useEffect } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import { useColors } from '@/hooks/useColors';

interface Props {
  hp: number;
  pleasure: number;
}

function AnimatedBar({ value, color, bgColor, label }: {
  value: number; color: string; bgColor: string; label: string;
}) {
  const anim = useRef(new Animated.Value(value)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: value, duration: 300, useNativeDriver: false }).start();
  }, [value]);

  return (
    <View style={styles.barContainer}>
      <Text style={[styles.barLabel, { color }]}>{label}</Text>
      <View style={[styles.barTrack, { backgroundColor: bgColor }]}>
        <Animated.View
          style={[
            styles.barFill,
            {
              backgroundColor: color,
              height: anim.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }),
            },
          ]}
        />
      </View>
      <Text style={[styles.barValue, { color }]}>{Math.round(value)}</Text>
    </View>
  );
}

export function StatusBars({ hp, pleasure }: Props) {
  const colors = useColors();
  return (
    <View style={styles.wrapper}>
      <AnimatedBar value={hp} color={colors.hp} bgColor={colors.hpBg} label="HP" />
      <View style={[styles.separator, { backgroundColor: colors.border }]} />
      <AnimatedBar value={pleasure} color={colors.pleasure} bgColor={colors.pleasureBg} label="快" />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    right: 8,
    top: 54,
    width: 32,
    gap: 8,
    alignItems: 'center',
    zIndex: 3,
    overflow: 'visible',
  },
  barContainer: {
    alignItems: 'center',
    gap: 3,
    overflow: 'visible',
  },
  barLabel: {
    fontSize: 9,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  barTrack: {
    width: 10,
    height: 100,
    borderRadius: 5,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  barFill: {
    width: '100%',
    borderRadius: 5,
    minHeight: 2,
  },
  barValue: {
    fontSize: 8,
    fontFamily: 'Inter_600SemiBold',
    textAlign: 'center',
  },
  separator: { width: 8, height: 1 },
});
