import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useColors } from '@/hooks/useColors';
import type { ComaState } from './HeartRateMonitor';

export type CharacterStatus =
  | 'normal'
  | 'tachycardia_coma'
  | 'bradycardia_coma'
  | 'stimulated'
  | 'sedated'
  | 'high_pain'
  | 'ruptured'
  | 'broken';

interface BadgeInfo {
  label: string;
  color: string;
  bg: string;
  priority: number;
}

function getBadges(
  comaState: ComaState,
  heartRate: number,
  hp: number,
  ruptures: number,
  breaks: number,
  heartRateModifier: number,
  avgPain: number,
  isDead: boolean,
  exposedCount: number,
): BadgeInfo[] {
  const badges: BadgeInfo[] = [];

  if (isDead) {
    badges.push({ label: '心脏停止', color: '#fff', bg: '#880000', priority: -1 });
    return badges;
  }

  if (comaState === 'tachycardia') {
    badges.push({ label: '昏迷·心跳过速', color: '#fff', bg: '#cc0000', priority: 0 });
  } else if (comaState === 'bradycardia') {
    badges.push({ label: '昏迷·心跳过缓', color: '#fff', bg: '#0044cc', priority: 0 });
  } else {
    if (heartRate > 140) {
      badges.push({ label: '心跳亢进', color: '#ff4444', bg: '#330000', priority: 1 });
    } else if (heartRate < 50) {
      badges.push({ label: '心动过缓', color: '#4488ff', bg: '#000033', priority: 1 });
    }

    if (heartRateModifier > 20) {
      badges.push({ label: '兴奋剂效果', color: '#ffcc00', bg: '#332200', priority: 2 });
    } else if (heartRateModifier < -20) {
      badges.push({ label: '镇静剂效果', color: '#88aaff', bg: '#001133', priority: 2 });
    }

    if (avgPain > 60) {
      badges.push({ label: '剧烈疼痛', color: '#ff6666', bg: '#220000', priority: 3 });
    }
  }

  if (exposedCount > 0) {
    badges.push({ label: `肠管露出×${exposedCount}`, color: '#ff9966', bg: '#2a1000', priority: 4 });
  }
  if (breaks > 0) {
    badges.push({ label: `肠管断裂×${breaks}`, color: '#ff4444', bg: '#220000', priority: 5 });
  }
  if (ruptures > 0) {
    badges.push({ label: `肠穿孔×${ruptures}`, color: '#cc88ff', bg: '#110022', priority: 6 });
  }

  if (hp < 20 && comaState === 'none') {
    badges.push({ label: '生命垂危', color: '#ff0000', bg: '#1a0000', priority: 6 });
  }

  if (badges.length === 0) {
    badges.push({ label: '状态正常', color: '#00cc44', bg: '#001a00', priority: 99 });
  }

  return badges.sort((a, b) => a.priority - b.priority);
}

interface Props {
  comaState: ComaState;
  heartRate: number;
  hp: number;
  isDead?: boolean;
  ruptures: number;
  breaks: number;
  heartRateModifier: number;
  avgPain: number;
  compact?: boolean;
  exposedCount?: number;
}

export function CharacterStatusBadges({
  comaState, heartRate, hp, isDead = false, ruptures, breaks, heartRateModifier, avgPain, compact = false, exposedCount = 0,
}: Props) {
  const colors = useColors();
  const badges = getBadges(comaState, heartRate, hp, ruptures, breaks, heartRateModifier, avgPain, isDead, exposedCount);

  if (compact) {
    return (
      <View style={styles.compactWrap}>
        {badges.slice(0, 3).map((b, i) => (
          <View key={i} style={[styles.compactBadge, { backgroundColor: b.bg, borderColor: b.color + '55' }]}>
            <Text style={[styles.compactLabel, { color: b.color }]}>{b.label}</Text>
          </View>
        ))}
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <Text style={[styles.sectionTitle, { color: colors.primary }]}>角色状态</Text>
      {badges.map((b, i) => (
        <View key={i} style={[styles.badge, { backgroundColor: b.bg, borderColor: b.color + '66' }]}>
          <View style={[styles.dot, { backgroundColor: b.color }]} />
          <Text style={[styles.label, { color: b.color }]}>{b.label}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 0 },
  sectionTitle: {
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 8,
    marginTop: 4,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
    marginBottom: 4,
    gap: 6,
  },
  dot: { width: 5, height: 5, borderRadius: 3 },
  label: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  compactWrap: {
    flexDirection: 'column',
    gap: 3,
    alignItems: 'flex-end',
  },
  compactBadge: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
  },
  compactLabel: {
    fontSize: 9,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 0.3,
  },
});
