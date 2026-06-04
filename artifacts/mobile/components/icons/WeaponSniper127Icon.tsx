import React from 'react';
import { Image, View } from 'react-native';

interface Props { size?: number; opacity?: number; selected?: boolean }

export function WeaponSniper127Icon({ size = 64, opacity = 1, selected = false }: Props) {
  return (
    <View style={{ opacity }}>
      <Image
        source={require('../../assets/images/weapon_127_barrett.png')}
        resizeMode="contain"
        tintColor={selected ? undefined : 'rgba(160,160,160,0.85)'}
        style={{ width: size * 1.33, height: size }}
      />
    </View>
  );
}
