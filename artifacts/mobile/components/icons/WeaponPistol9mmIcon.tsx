import React from 'react';
import { Image, View } from 'react-native';

interface Props { size?: number; opacity?: number; selected?: boolean }

export function WeaponPistol9mmIcon({ size = 44, opacity = 1, selected = false }: Props) {
  return (
    <View style={{ opacity }}>
      <Image
        source={require('../../assets/images/weapon_9mm_pistol.png')}
        resizeMode="contain"
        tintColor={selected ? undefined : 'rgba(160,160,160,0.85)'}
        style={{ width: size * 1.33, height: size }}
      />
    </View>
  );
}
