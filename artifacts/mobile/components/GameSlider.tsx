import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Slider from '@react-native-community/slider';

interface Props {
  value: number;
  minimumValue: number;
  maximumValue: number;
  step?: number;
  onValueChange: (v: number) => void;
  minimumTrackTintColor?: string;
  maximumTrackTintColor?: string;
  thumbTintColor?: string;
}

export function GameSlider({
  value, minimumValue, maximumValue, step = 1,
  onValueChange,
  minimumTrackTintColor = '#b06040',
  maximumTrackTintColor = '#333333',
  thumbTintColor = '#b06040',
}: Props) {
  if (Platform.OS === 'web') {
    return (
      <View style={styles.webWrapper}>
        <input
          type="range"
          min={minimumValue}
          max={maximumValue}
          step={step}
          value={value}
          onChange={(e) => onValueChange(parseFloat(e.target.value))}
          style={{
            width: '100%',
            height: 28,
            accentColor: minimumTrackTintColor,
            cursor: 'pointer',
          }}
        />
      </View>
    );
  }
  return (
    <Slider
      style={styles.nativeSlider}
      minimumValue={minimumValue}
      maximumValue={maximumValue}
      step={step}
      value={value}
      onValueChange={onValueChange}
      minimumTrackTintColor={minimumTrackTintColor}
      maximumTrackTintColor={maximumTrackTintColor}
      thumbTintColor={thumbTintColor}
    />
  );
}

const styles = StyleSheet.create({
  webWrapper: { width: '100%' },
  nativeSlider: { height: 28 },
});
