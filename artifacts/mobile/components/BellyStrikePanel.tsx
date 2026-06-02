import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, Image, StyleSheet } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { useGame } from '@/contexts/GameContext';
import { GameSlider } from './GameSlider';
import { BELLY_STRIKE_TOOL_LIST, type BellyStrikeToolId } from '../constants/gameConfig';

const TOOL_IMAGES: Record<BellyStrikeToolId, any> = {
  '拳头': require('@/assets/images/strike_fist.png'),
  '棒球棒': require('@/assets/images/strike_bat.png'),
  '撞钟锤': require('@/assets/images/strike_hammer.png'),
};

const TOOL_DELAY_LABELS: Record<BellyStrikeToolId, string> = {
  '拳头': '0.4s 延迟',
  '棒球棒': '1s 延迟',
  '撞钟锤': '2s 延迟',
};

const FORCE_LABELS = ['低', '中', '高'];

export function BellyStrikePanel() {
  const colors = useColors();
  const { state, setBellyStrikeTool, setBellyStrikeForce, setBellyStrikeRange } = useGame();

  const selected = state.bellyStrikeTool;
  const force = state.bellyStrikeForce;
  const range = state.bellyStrikeRange;

  const forceLevel = force < 34 ? 0 : force < 67 ? 1 : 2;

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      style={styles.scroll}
      nestedScrollEnabled
    >
      <Text style={[styles.title, { color: colors.mutedForeground }]}>腹击工具</Text>

      {BELLY_STRIKE_TOOL_LIST.map(tool => {
        const isSel = selected === tool.id;
        return (
          <TouchableOpacity
            key={tool.id}
            style={[
              styles.toolCard,
              {
                borderColor: isSel ? `${colors.primary}cc` : `${colors.border}88`,
                backgroundColor: isSel ? `${colors.primary}16` : 'transparent',
              },
            ]}
            onPress={() => setBellyStrikeTool(isSel ? null : tool.id)}
            activeOpacity={0.75}
          >
            <Image
              source={TOOL_IMAGES[tool.id]}
              style={[styles.toolImg, !isSel && { opacity: 0.55 }]}
              resizeMode="contain"
            />
            <View style={styles.toolInfo}>
              <Text style={[styles.toolName, { color: isSel ? colors.primary : colors.foreground }]}>
                {tool.id}
              </Text>
              <Text style={[styles.toolDesc, { color: colors.mutedForeground }]}>{tool.desc}</Text>
              <Text style={[styles.toolDelay, { color: isSel ? `${colors.primary}bb` : colors.mutedForeground }]}>
                {TOOL_DELAY_LABELS[tool.id]}
              </Text>
            </View>
            {isSel && (
              <View style={[styles.selDot, { backgroundColor: colors.primary }]} />
            )}
          </TouchableOpacity>
        );
      })}

      {selected && (
        <View style={[styles.settingsBox, { borderColor: `${colors.border}55`, backgroundColor: `${colors.primary}08` }]}>
          <Text style={[styles.settingsTitle, { color: colors.mutedForeground }]}>参数设置</Text>

          <View style={styles.sliderRow}>
            <View style={styles.sliderLabelRow}>
              <Text style={[styles.sliderLabel, { color: colors.foreground }]}>力度</Text>
              <View style={[
                styles.forceBadge,
                { backgroundColor: forceLevel === 2 ? '#e05050' : forceLevel === 1 ? colors.primary : `${colors.primary}88` },
              ]}>
                <Text style={styles.forceBadgeText}>{FORCE_LABELS[forceLevel]}</Text>
              </View>
            </View>
            <GameSlider
              value={force}
              minimumValue={0}
              maximumValue={100}
              step={1}
              onValueChange={setBellyStrikeForce}
            />
          </View>

          <View style={styles.sliderRow}>
            <Text style={[styles.sliderLabel, { color: colors.foreground }]}>范围</Text>
            <GameSlider
              value={range}
              minimumValue={0}
              maximumValue={100}
              step={1}
              onValueChange={setBellyStrikeRange}
            />
          </View>

          <View style={[styles.hintBox, { borderColor: `${colors.border}44` }]}>
            <Text style={[styles.hintText, { color: colors.mutedForeground }]}>
              按住并拖拽以定位击打位置{'\n'}松手时触发腹击
            </Text>
          </View>
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
  toolCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 5,
    gap: 8,
  },
  toolImg: {
    width: 36,
    height: 36,
  },
  toolInfo: { flex: 1 },
  toolName: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
  },
  toolDesc: {
    fontSize: 9,
    fontFamily: 'Inter_400Regular',
    marginTop: 1,
    lineHeight: 12,
  },
  toolDelay: {
    fontSize: 9,
    fontFamily: 'Inter_400Regular',
    marginTop: 2,
  },
  selDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  settingsBox: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 8,
    marginTop: 4,
    gap: 6,
  },
  settingsTitle: {
    fontSize: 9,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  sliderRow: {
    gap: 3,
  },
  sliderLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sliderLabel: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
  },
  forceBadge: {
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  forceBadgeText: {
    fontSize: 9,
    fontFamily: 'Inter_600SemiBold',
    color: '#fff',
  },
  hintBox: {
    borderWidth: 1,
    borderRadius: 6,
    padding: 6,
    marginTop: 2,
  },
  hintText: {
    fontSize: 9,
    fontFamily: 'Inter_400Regular',
    lineHeight: 13,
  },
  spacer: { height: 12 },
});
