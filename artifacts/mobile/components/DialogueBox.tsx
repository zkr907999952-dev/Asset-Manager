import React, { useRef, useEffect } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import { useColors } from '@/hooks/useColors';

interface Props {
  dialogue: string | null;
}

export function DialogueBox({ dialogue }: Props) {
  const colors = useColors();
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(8)).current;
  const visible = useRef(false);

  useEffect(() => {
    if (dialogue) {
      visible.current = true;
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 350, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 6, duration: 350, useNativeDriver: true }),
      ]).start(() => { visible.current = false; });
    }
  }, [dialogue]);

  if (!dialogue && !visible.current) return null;

  return (
    <Animated.View style={[
      styles.container,
      { opacity, transform: [{ translateY }], borderColor: `${colors.border}aa` },
    ]}>
      <View style={[styles.indicator, { backgroundColor: colors.primary }]} />
      <Text style={[styles.text, { color: colors.foreground }]}>{dialogue}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderTopWidth: 1,
    minHeight: 40,
    gap: 10,
    backgroundColor: 'rgba(8, 2, 2, 0.78)',
  },
  indicator: {
    width: 3,
    height: '100%' as any,
    borderRadius: 2,
    minHeight: 22,
    marginTop: 2,
  },
  text: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    lineHeight: 20,
    flex: 1,
  },
});
