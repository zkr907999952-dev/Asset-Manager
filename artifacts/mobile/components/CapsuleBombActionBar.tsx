import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useGame } from '@/contexts/GameContext';
import { GameSlider } from '@/components/GameSlider';

export function CapsuleBombActionBar() {
  const colors = useColors();
  const {
    state,
    swallowCapsuleBomb,
    setCapsuleBombPlacementMode,
    setCapsuleBombPower,
    detonateCapsuleBombs,
    clearCapsuleBombs,
  } = useGame();

  const { selectedWeapon, capsuleBombs, capsuleBombPlacementMode, capsuleBombPower, navelPierced } = state;

  if (selectedWeapon !== '胶囊炸弹') return null;

  const hasBombs = capsuleBombs.length > 0;
  const hasSwallow = capsuleBombs.some(b => b.mode === 'swallow');
  const cavityActive = capsuleBombPlacementMode === 'cavity';
  const swallowActive = capsuleBombPlacementMode === 'swallow';

  return (
    <View style={styles.bar} pointerEvents="box-none">
      {/* Mode select row */}
      <View style={styles.row}>
        <TouchableOpacity
          style={[
            styles.btn,
            {
              borderColor: cavityActive ? '#ff660099' : navelPierced ? '#ff660044' : '#44444488',
              backgroundColor: cavityActive ? 'rgba(255,102,0,0.18)' : 'rgba(20,10,30,0.75)',
              opacity: navelPierced ? 1 : 0.4,
            },
          ]}
          disabled={!navelPierced}
          onPress={() => setCapsuleBombPlacementMode(cavityActive ? null : 'cavity')}
          activeOpacity={0.75}
        >
          <Feather name="target" size={13} color={cavityActive ? '#ff6600' : navelPierced ? '#ff8844' : colors.mutedForeground} />
          <Text style={[styles.btnText, { color: cavityActive ? '#ff6600' : navelPierced ? '#ff8844' : colors.mutedForeground }]}>
            塞入腹腔
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.btn,
            {
              borderColor: swallowActive ? '#ff880099' : '#ff660044',
              backgroundColor: swallowActive ? 'rgba(255,136,0,0.18)' : 'rgba(20,10,30,0.75)',
              opacity: hasSwallow && !swallowActive ? 0.4 : 1,
            },
          ]}
          disabled={hasSwallow && !swallowActive}
          onPress={() => {
            if (swallowActive) {
              setCapsuleBombPlacementMode(null);
            } else {
              swallowCapsuleBomb();
            }
          }}
          activeOpacity={0.75}
        >
          <Feather name="arrow-down-circle" size={13} color={swallowActive ? '#ff8800' : '#ff9944'} />
          <Text style={[styles.btnText, { color: swallowActive ? '#ff8800' : '#ff9944' }]}>
            {swallowActive ? '拖拽定位' : '服下胶囊炸弹'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Detonation row — show when bombs exist */}
      {hasBombs && (
        <View style={styles.row}>
          <View style={[styles.sliderWrap, { borderColor: '#ff440033' }]}>
            <Text style={[styles.sliderLabel, { color: '#ff8844' }]}>
              爆炸威力 {Math.round(capsuleBombPower)}
            </Text>
            <GameSlider
              value={capsuleBombPower}
              minimumValue={0}
              maximumValue={100}
              step={1}
              onValueChange={setCapsuleBombPower}
              minimumTrackTintColor="#ff4400"
              maximumTrackTintColor="#442200"
              thumbTintColor="#ff6600"
            />
            <View style={styles.sliderHints}>
              <Text style={[styles.sliderHint, { color: colors.mutedForeground }]}>7.62mm</Text>
              <Text style={[styles.sliderHint, { color: '#ff6600' }]}>2×12.7mm</Text>
            </View>
          </View>

          <View style={styles.detonateRow}>
            <TouchableOpacity
              style={[styles.btn, styles.detonateBtn, { borderColor: '#ff220099', backgroundColor: 'rgba(255,34,0,0.18)' }]}
              onPress={detonateCapsuleBombs}
              activeOpacity={0.7}
            >
              <Feather name="zap" size={13} color="#ff2200" />
              <Text style={[styles.btnText, { color: '#ff2200' }]}>引爆 ({capsuleBombs.length}枚)</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.btn, { borderColor: `${colors.border}55`, backgroundColor: 'rgba(20,10,30,0.75)' }]}
              onPress={clearCapsuleBombs}
              activeOpacity={0.75}
            >
              <Feather name="trash-2" size={13} color={colors.mutedForeground} />
              <Text style={[styles.btnText, { color: colors.mutedForeground }]}>清除</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    paddingHorizontal: 10,
    paddingBottom: 4,
    gap: 5,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  detonateRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: 'rgba(20,10,30,0.75)',
  },
  detonateBtn: {
    paddingHorizontal: 16,
  },
  btnText: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
  },
  sliderWrap: {
    flex: 1,
    minWidth: 160,
    maxWidth: 260,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: 'rgba(20,10,30,0.75)',
  },
  sliderLabel: {
    fontSize: 10,
    fontFamily: 'Inter_600SemiBold',
    marginBottom: 2,
  },
  sliderHints: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 1,
  },
  sliderHint: {
    fontSize: 8,
    fontFamily: 'Inter_400Regular',
  },
});
