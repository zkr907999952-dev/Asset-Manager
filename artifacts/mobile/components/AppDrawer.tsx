import React, { useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, Animated, StyleSheet,
  Dimensions, Pressable, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useGame, type ScreenName } from '@/contexts/GameContext';

const DRAWER_WIDTH = 220;

const SCREENS: { id: ScreenName; label: string; subtitle: string }[] = [
  { id: 'character', label: '人物展示', subtitle: '查看角色全身状态' },
  { id: 'simulation', label: '腹部交互', subtitle: '物理仿真主界面' },
  { id: 'console', label: '控制台', subtitle: '调整仿真参数' },
  { id: 'settings', label: '设置', subtitle: '游戏选项与调试' },
  { id: 'help', label: '帮助', subtitle: '游戏系统手册' },
];

interface Props {
  open: boolean;
  onClose: () => void;
}

export function AppDrawer({ open, onClose }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { state, setScreen } = useGame();
  const translateX = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(translateX, {
        toValue: open ? 0 : -DRAWER_WIDTH,
        useNativeDriver: true,
        tension: 80, friction: 14,
      }),
      Animated.timing(overlayOpacity, {
        toValue: open ? 1 : 0,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start();
  }, [open]);

  const handleSelect = (id: ScreenName) => {
    setScreen(id);
    onClose();
  };

  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  return (
    <>
      {open && (
        <Pressable
          onPress={onClose}
          style={StyleSheet.absoluteFillObject}
        >
          <Animated.View
            style={[styles.overlay, { opacity: overlayOpacity, backgroundColor: colors.overlay }]}
          />
        </Pressable>
      )}
      <Animated.View
        style={[
          styles.drawer,
          {
            transform: [{ translateX }],
            backgroundColor: colors.drawerBg,
            borderRightColor: colors.drawerBorder,
            paddingTop: topPad + 16,
            paddingBottom: Platform.OS === 'web' ? 34 : insets.bottom + 16,
            pointerEvents: open ? 'auto' : 'none',
          },
        ]}
      >
        <View style={styles.drawerHeader}>
          <Text style={[styles.appTitle, { color: colors.primary }]}>玉腹模拟器</Text>
          <Text style={[styles.appSubtitle, { color: colors.mutedForeground }]}>物理仿真系统</Text>
        </View>

        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        {SCREENS.map(s => {
          const active = state.currentScreen === s.id;
          return (
            <TouchableOpacity
              key={s.id}
              style={[
                styles.menuItem,
                active && { backgroundColor: colors.secondary },
              ]}
              onPress={() => handleSelect(s.id)}
              activeOpacity={0.7}
            >
              <View style={[styles.menuIndicator, { backgroundColor: active ? colors.primary : 'transparent' }]} />
              <View style={styles.menuText}>
                <Text style={[styles.menuLabel, { color: active ? colors.primary : colors.foreground }]}>
                  {s.label}
                </Text>
                <Text style={[styles.menuSubtitle, { color: colors.mutedForeground }]}>
                  {s.subtitle}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}

        <View style={[styles.divider, { backgroundColor: colors.border, marginTop: 'auto' }]} />
        <View style={styles.drawerFooter}>
          <Text style={[styles.footerText, { color: colors.mutedForeground }]}>
            v1.0 腹腔仿真引擎
          </Text>
        </View>
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
  },
  drawer: {
    position: 'absolute',
    left: 0, top: 0, bottom: 0,
    width: DRAWER_WIDTH,
    zIndex: 20,
    borderRightWidth: 1,
    elevation: 12,
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 10,
    shadowOffset: { width: 4, height: 0 },
  },
  drawerHeader: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  appTitle: {
    fontSize: 20,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 1,
  },
  appSubtitle: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    marginTop: 2,
  },
  divider: {
    height: 1,
    marginHorizontal: 12,
    marginVertical: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    marginHorizontal: 8,
    borderRadius: 8,
    marginBottom: 2,
  },
  menuIndicator: {
    width: 3,
    height: 32,
    borderRadius: 2,
    marginRight: 12,
  },
  menuText: { flex: 1 },
  menuLabel: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
  },
  menuSubtitle: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    marginTop: 2,
  },
  drawerFooter: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  footerText: {
    fontSize: 10,
    fontFamily: 'Inter_400Regular',
  },
});
