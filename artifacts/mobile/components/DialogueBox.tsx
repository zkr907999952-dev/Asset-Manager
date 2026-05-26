import React, { useRef, useEffect } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import { useColors } from '@/hooks/useColors';

interface Props {
  dialogue: string | null;
}

export function DialogueBox({ dialogue }: Props) {
  const colors = useColors();
  const opacity = useRef(new Animated.Value(0)).current;
  const visible = useRef(false);

  useEffect(() => {
    if (dialogue) {
      visible.current = true;
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    } else {
      Animated.timing(opacity, { toValue: 0, duration: 400, useNativeDriver: true }).start(
        () => { visible.current = false; }
      );
    }
  }, [dialogue]);

  if (!dialogue && !visible.current) return null;

  return (
    <Animated.View style={[styles.container, { opacity, borderColor: colors.border, backgroundColor: `${colors.card}ee` }]}>
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
    paddingVertical: 10,
    borderTopWidth: 1,
    minHeight: 44,
    gap: 10,
  },
  indicator: {
    width: 3,
    height: '100%' as any,
    borderRadius: 2,
    minHeight: 24,
    marginTop: 2,
  },
  text: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    lineHeight: 20,
    flex: 1,
  },
});
