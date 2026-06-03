import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Image, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useGame } from '@/contexts/GameContext';
import { GameSlider } from './GameSlider';
import { BELLY_STRIKE_TOOL_LIST, type BellyStrikeToolId } from '../constants/gameConfig';
import { StrikeHammerIcon } from './icons/StrikeHammerIcon';

const TOOL_IMAGES: Record<BellyStrikeToolId, any> = {
  '拳头': require('@/assets/images/strike_fist.png'),
  '棒球棒': require('@/assets/images/strike_bat.png'),
  '撞钟锤': null,
};

const TOOL_DELAY_LABELS: Record<BellyStrikeToolId, string> = {
  '拳头': '0.4s 延迟',
  '棒球棒': '1s 延迟',
  '撞钟锤': '2s 延迟',
};

const FORCE_LABELS = ['低', '中', '高'];

export function BellyStrikePanel() {
  const colors = useColors();
  const {
    state,
    setBellyStrikeTool, setBellyStrikeForce, setBellyStrikeRange,
    setBellyStrikeImpulseScale, setBellyStrikeToolPower,
  } = useGame();
  const [showAdvanced, setShowAdvanced] = useState(false);

  const selected = state.bellyStrikeTool;
  const force = state.bellyStrikeForce;
  const range = state.bellyStrikeRange;
  const impulseScale = state.bellyStrikeImpulseScale;
  const toolPowers = state.bellyStrikeToolPowers;

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
            {tool.id === '撞钟锤' ? (
              <StrikeHammerIcon size={36} opacity={isSel ? 1 : 0.5} />
            ) : (
              <Image
                source={TOOL_IMAGES[tool.id]}
                style={[styles.toolImg, !isSel && { opacity: 0.55 }]}
                resizeMode="contain"
              />
            )}
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
              按住并拖拽以定位击打位置{'\n'}松手时触发腹击，可连续多次点击
            </Text>
          </View>
        </View>
      )}

      {/* Advanced settings section */}
      <TouchableOpacity
        style={[styles.advHeader, { borderColor: `${colors.border}44` }]}
        onPress={() => setShowAdvanced(v => !v)}
        activeOpacity={0.7}
      >
        <Text style={[styles.advHeaderText, { color: colors.mutedForeground }]}>高级设置</Text>
        <Feather name={showAdvanced ? 'chevron-up' : 'chevron-down'} size={12} color={colors.mutedForeground} />
      </TouchableOpacity>

      {showAdvanced && (
        <View style={[styles.advBox, { borderColor: `${colors.border}44`, backgroundColor: `${colors.primary}06` }]}>

          {/* Impulse scale */}
          <View style={styles.sliderRow}>
            <View style={styles.sliderLabelRow}>
              <Text style={[styles.sliderLabel, { color: colors.foreground }]}>物理推力</Text>
              <Text style={[styles.sliderVal, { color: colors.mutedForeground }]}>{impulseScale}%</Text>
            </View>
            <GameSlider
              value={impulseScale}
              minimumValue={20}
              maximumValue={300}
              step={5}
              onValueChange={setBellyStrikeImpulseScale}
            />
          </View>

          {/* Per-tool power */}
          <Text style={[styles.advSubTitle, { color: colors.mutedForeground }]}>工具威力倍数</Text>
          {BELLY_STRIKE_TOOL_LIST.map(tool => {
            const pwr = toolPowers[tool.id] ?? 100;
            return (
              <View key={tool.id} style={styles.sliderRow}>
                <View style={styles.sliderLabelRow}>
                  <Text style={[styles.sliderLabel, { color: colors.foreground, fontSize: 10 }]}>{tool.id}</Text>
                  <Text style={[styles.sliderVal, { color: colors.mutedForeground }]}>{pwr}%</Text>
                </View>
                <GameSlider
                  value={pwr}
                  minimumValue={10}
                  maximumValue={400}
                  step={10}
                  onValueChange={v => setBellyStrikeToolPower(tool.id, v)}
                />
              </View>
            );
          })}
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
  sliderVal: {
    fontSize: 9,
    fontFamily: 'Inter_400Regular',
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
  advHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    paddingHorizontal: 4,
    marginTop: 6,
    borderTopWidth: 1,
  },
  advHeaderText: {
    fontSize: 9,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  advBox: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 8,
    gap: 6,
    marginTop: 2,
  },
  advSubTitle: {
    fontSize: 9,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginTop: 2,
    marginBottom: 2,
  },
  spacer: { height: 12 },
});
