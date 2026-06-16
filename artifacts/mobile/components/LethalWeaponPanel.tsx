import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { useGame } from '@/contexts/GameContext';
import { LETHAL_WEAPON_LIST, type LethalWeaponId } from '../constants/gameConfig';
import { WeaponPistol22Icon } from './icons/WeaponPistol22Icon';
import { WeaponPistol9mmIcon } from './icons/WeaponPistol9mmIcon';
import { WeaponRifle762Icon } from './icons/WeaponRifle762Icon';
import { WeaponSniper127Icon } from './icons/WeaponSniper127Icon';

function WeaponIcon({ id, selected, size }: { id: LethalWeaponId; selected: boolean; size?: number }) {
  if (id === '.22手枪')            return <WeaponPistol22Icon  size={size ?? 44} selected={selected} />;
  if (id === '9MM手枪')            return <WeaponPistol9mmIcon  size={size ?? 44} selected={selected} />;
  if (id === '7.62mm步枪')         return <WeaponRifle762Icon   size={size ?? 52} selected={selected} />;
  if (id === '12.7mm反器材狙击枪') return <WeaponSniper127Icon  size={size ?? 56} selected={selected} />;
  if (id === '武士刀') {
    const c = selected ? '#cc44aa' : '#888899';
    return (
      <View style={{ width: 52, height: 28, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ width: 44, height: 3, backgroundColor: c, borderRadius: 2, transform: [{ rotate: '-20deg' }], shadowColor: selected ? '#cc44aa' : 'transparent', shadowRadius: selected ? 4 : 0, shadowOpacity: 0.8 }} />
        <View style={{ position: 'absolute', right: 4, bottom: 2, width: 10, height: 10, borderRadius: 2, borderWidth: 1.5, borderColor: c }} />
      </View>
    );
  }
  if (id === '胶囊炸弹') {
    const c1 = selected ? '#ff6600' : '#884422';
    const c2 = selected ? '#cc4400' : '#553311';
    return (
      <View style={{ width: 44, height: 28, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ width: 36, height: 16, borderRadius: 8, overflow: 'hidden', flexDirection: 'row' }}>
          <View style={{ flex: 1, backgroundColor: c1 }} />
          <View style={{ width: 1, backgroundColor: selected ? '#ffaa44' : '#664422' }} />
          <View style={{ flex: 1, backgroundColor: c2 }} />
        </View>
        <View style={{ position: 'absolute', top: 1, right: 5, width: 6, height: 6, borderRadius: 1, backgroundColor: selected ? '#ffcc00' : '#665500', borderWidth: 1, borderColor: selected ? '#ffaa00' : '#443300' }} />
      </View>
    );
  }
  return null;
}

const POWER_BADGES: Record<LethalWeaponId, { label: string; color: string }> = {
  '.22手枪':            { label: '轻伤', color: '#6ab04c' },
  '9MM手枪':            { label: '中伤', color: '#e1b12c' },
  '7.62mm步枪':         { label: '重伤', color: '#e84118' },
  '12.7mm反器材狙击枪': { label: '即死', color: '#c0392b' },
  '武士刀':             { label: '断肠', color: '#cc44aa' },
  '胶囊炸弹':           { label: '爆炸', color: '#ff6600' },
};

const SIGHT_LABELS: Record<string, string> = {
  iron:  '机械瞄具',
  scope: '圆形瞄准镜',
};

export function LethalWeaponPanel() {
  const colors = useColors();
  const { state, setSelectedWeapon } = useGame();
  const selected = state.selectedWeapon;

  return (
    <ScrollView showsVerticalScrollIndicator={false} style={styles.scroll} nestedScrollEnabled>
      <Text style={[styles.title, { color: colors.mutedForeground }]}>致命武器</Text>

      {LETHAL_WEAPON_LIST.map(weapon => {
        const isSel = selected === weapon.id;
        const badge = POWER_BADGES[weapon.id];
        const isReserved = !!weapon.reserved;

        return (
          <TouchableOpacity
            key={weapon.id}
            disabled={isReserved}
            style={[
              styles.card,
              {
                borderColor: isSel ? '#e84040cc' : `${colors.border}77`,
                backgroundColor: isSel ? 'rgba(232,64,64,0.1)' : isReserved ? 'rgba(40,40,40,0.3)' : 'transparent',
                opacity: isReserved ? 0.45 : 1,
              },
            ]}
            onPress={() => setSelectedWeapon(isSel ? null : weapon.id)}
            activeOpacity={0.75}
          >
            <View style={styles.iconBox}>
              {!isReserved && (
                <WeaponIcon id={weapon.id} selected={isSel} />
              )}
              {isReserved && (
                <View style={[styles.reservedBox, { borderColor: `${colors.border}44` }]}>
                  <Text style={[styles.reservedText, { color: colors.mutedForeground }]}>预留</Text>
                </View>
              )}
            </View>
            <View style={styles.info}>
              <View style={styles.nameRow}>
                <Text style={[styles.name, { color: isSel ? '#e84040' : isReserved ? colors.mutedForeground : colors.foreground }]}>
                  {weapon.id}
                </Text>
                <View style={[styles.badge, { backgroundColor: badge.color + '22', borderColor: badge.color + '88' }]}>
                  <Text style={[styles.badgeText, { color: badge.color }]}>{badge.label}</Text>
                </View>
              </View>
              <Text style={[styles.desc, { color: colors.mutedForeground }]}>{weapon.desc}</Text>
              {!isReserved && (
                <Text style={[styles.sight, { color: isSel ? '#e8404088' : colors.mutedForeground }]}>
                  {SIGHT_LABELS[weapon.sightType]}
                </Text>
              )}
            </View>
            {isSel && <View style={styles.selDot} />}
          </TouchableOpacity>
        );
      })}

      {selected && (() => {
        const def = LETHAL_WEAPON_LIST.find(w => w.id === selected);
        if (!def || def.reserved) return null;
        const isKatana = selected === '武士刀';
        const isBomb = selected === '胶囊炸弹';
        const hintColor = isKatana ? '#cc44aaaa' : isBomb ? '#ff6600aa' : '#e84040aa';
        const hintBg = isKatana ? 'rgba(204,68,170,0.05)' : isBomb ? 'rgba(255,102,0,0.05)' : 'rgba(232,64,64,0.05)';
        const hintBorder = isKatana ? `${'#cc44aa'}44` : isBomb ? '#ff660044' : `${colors.border}44`;
        const hintText = isKatana
          ? '点击为斩击起点，拖拽至终点\n松开即触发斩击，范围内肠段全部断裂\n斩击宽度可在设置中调整'
          : isBomb
          ? '下方选择放置模式\n腹腔模式：点击/拖拽放置（需刺穿肚脐）\n吞入模式：拖拽定位肠道中的位置\n调整威力后按引爆同时爆炸'
          : '按住并拖拽定位瞄准位置\n瞄准点偏移可在设置中调整\n松开即触发开火';
        return (
          <View style={[styles.hintBox, { borderColor: hintBorder, backgroundColor: hintBg }]}>
            <Text style={[styles.hintText, { color: hintColor }]}>{hintText}</Text>
          </View>
        );
      })()}

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
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 5,
    gap: 8,
  },
  iconBox: {
    width: 58,
    alignItems: 'center',
    justifyContent: 'center',
    height: 32,
  },
  reservedBox: {
    width: 48,
    height: 24,
    borderRadius: 4,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reservedText: {
    fontSize: 9,
    fontFamily: 'Inter_400Regular',
  },
  info: { flex: 1 },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flexWrap: 'wrap',
  },
  name: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
  },
  badge: {
    borderRadius: 3,
    borderWidth: 1,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  badgeText: {
    fontSize: 8,
    fontFamily: 'Inter_600SemiBold',
  },
  desc: {
    fontSize: 9,
    fontFamily: 'Inter_400Regular',
    marginTop: 1,
    lineHeight: 12,
  },
  sight: {
    fontSize: 9,
    fontFamily: 'Inter_400Regular',
    marginTop: 2,
  },
  selDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#e84040',
  },
  hintBox: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 8,
    marginTop: 2,
  },
  hintText: {
    fontSize: 9,
    fontFamily: 'Inter_400Regular',
    lineHeight: 14,
  },
  spacer: { height: 12 },
});
