import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { CharacterView } from '@/components/CharacterView';
import { AttributePanel } from '@/components/AttributePanel';
import { DialogueBox } from '@/components/DialogueBox';
import { useGame } from '@/contexts/GameContext';

interface Props {
  onMenuPress: () => void;
}

export function CharacterScreen({ onMenuPress }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { state } = useGame();
  const topPad = Platform.OS === 'web' ? 16 : insets.top;

  const charWidth = Math.min(width * 0.44, 180);
  const charHeight = height - topPad - 60;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad, backgroundColor: colors.headerBg, borderBottomColor: colors.border }]}>
        <TouchableOpacity style={styles.menuBtn} onPress={onMenuPress}>
          <Feather name="menu" size={20} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.foreground }]}>人物展示</Text>
        <View style={[styles.heartRate, { borderColor: colors.border }]}>
          <Feather name="heart" size={10} color={colors.hp} />
          <Text style={[styles.heartText, { color: colors.hp }]}>{state.heartRate}</Text>
        </View>
      </View>

      <View style={styles.body}>
        {/* Character SVG */}
        <View style={[styles.charContainer, { width: charWidth, borderRightColor: colors.border }]}>
          <CharacterView width={charWidth} height={charHeight} />
        </View>

        {/* Attributes panel */}
        <View style={styles.attrContainer}>
          <AttributePanel />
        </View>
      </View>

      <View style={[styles.footer, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
        <DialogueBox dialogue={state.currentDialogue} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
  },
  menuBtn: { padding: 6, marginRight: 8 },
  title: { flex: 1, fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  heartRate: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  heartText: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  body: { flex: 1, flexDirection: 'row' },
  charContainer: {
    borderRightWidth: 1,
    backgroundColor: '#100808',
  },
  attrContainer: { flex: 1, paddingTop: 12 },
  footer: { borderTopWidth: 1 },
});
