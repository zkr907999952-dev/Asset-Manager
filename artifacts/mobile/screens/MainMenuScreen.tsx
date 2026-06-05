import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Platform,
  Image, Animated, Modal, Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useGame } from '@/contexts/GameContext';
import { APP_VERSION } from '@/constants/version';

const COVER_IMG = require('@/assets/images/main_menu_cover.png');

function WipModal({ visible, label, onClose }: { visible: boolean; label: string; onClose: () => void }) {
  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <View style={styles.modalBox}>
          <Text style={styles.modalTitle} numberOfLines={1}>正在开发中</Text>
          <Text style={styles.modalLabel} numberOfLines={1}>「{label}」</Text>
          <Text style={styles.modalDesc} numberOfLines={2}>功能尚未开放，敬请期待。</Text>
          <TouchableOpacity style={styles.modalBtn} onPress={onClose}>
            <Text style={styles.modalBtnText}>确定</Text>
          </TouchableOpacity>
        </View>
      </Pressable>
    </Modal>
  );
}

function DevInfoModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <View style={styles.modalBox}>
          <Text style={styles.modalTitle}>开发者信息</Text>
          <Text style={styles.modalDesc}>
            {`玉腹模拟器\n地表最强恋肠模拟器 ${APP_VERSION}\n\n独立开发作品\n保留所有权利`}
          </Text>
          <TouchableOpacity style={styles.modalBtn} onPress={onClose}>
            <Text style={styles.modalBtnText}>关闭</Text>
          </TouchableOpacity>
        </View>
      </Pressable>
    </Modal>
  );
}

const BUTTONS: {
  label: string;
  action: (ctx: { setScreen: (s: string) => void; setWip: (l: string) => void }) => void;
  highlight?: boolean;
}[] = [
  { label: '继续游戏', action: ({ setWip }) => setWip('继续游戏') },
  { label: '开始',     action: ({ setWip }) => setWip('开始') },
  { label: '故事模式', action: ({ setWip }) => setWip('故事模式') },
  { label: '沙盒模式', action: ({ setScreen }) => setScreen('simulation'), highlight: true },
  { label: '存档',     action: ({ setWip }) => setWip('存档') },
  { label: '帮助',     action: ({ setScreen }) => setScreen('help') },
  { label: '设置',     action: ({ setScreen }) => setScreen('settings') },
];

function MenuButton({
  label,
  highlight,
  onPress,
  delay,
}: {
  label: string;
  highlight?: boolean;
  onPress: () => void;
  delay: number;
}) {
  const [hovered, setHovered] = useState(false);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateX = useRef(new Animated.Value(10)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity,    { toValue: 1, duration: 400, delay, useNativeDriver: false }),
      Animated.timing(translateX, { toValue: 0, duration: 400, delay, useNativeDriver: false }),
    ]).start();
  }, []);

  const isActive = hovered || highlight;

  return (
    <Animated.View style={[styles.menuBtnWrap, { opacity, transform: [{ translateX }] }]}>
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.8}
        {...(Platform.OS === 'web' ? {
          onMouseEnter: () => setHovered(true),
          onMouseLeave: () => setHovered(false),
        } : {})}
        style={styles.menuBtn}
      >
        <Text style={[
          styles.menuBtnLabel,
          highlight && styles.menuBtnHighlight,
          hovered && styles.menuBtnHovered,
        ]}>
          {label}
        </Text>
        <View style={[
          styles.btnUnderline,
          isActive && styles.btnUnderlineActive,
        ]} />
      </TouchableOpacity>
    </Animated.View>
  );
}

export function MainMenuScreen() {
  const insets = useSafeAreaInsets();
  const { setScreen } = useGame();
  const [wipLabel, setWipLabel] = useState<string | null>(null);
  const [devInfoOpen, setDevInfoOpen] = useState(false);

  const titleOpacity = useRef(new Animated.Value(0)).current;
  const titleY       = useRef(new Animated.Value(-12)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(titleOpacity, { toValue: 1, duration: 600, useNativeDriver: false }),
      Animated.timing(titleY,       { toValue: 0, duration: 600, useNativeDriver: false }),
    ]).start();
  }, []);

  const bottomPad = Platform.OS === 'web' ? 20 : insets.bottom;
  const topPad    = Platform.OS === 'web' ? 20 : insets.top;

  const ctx = { setScreen, setWip: (l: string) => setWipLabel(l) };

  return (
    <View style={styles.bg}>
      {/* Background image — slightly zoomed to make character larger */}
      <Image
        source={COVER_IMG}
        style={styles.bgImage}
        resizeMode="cover"
      />


      {/* Main layout */}
      <View style={[styles.root, { paddingTop: topPad, paddingBottom: bottomPad }]}>

        {/* ── Title (top-left) ── */}
        <Animated.View style={[styles.titleBlock, { opacity: titleOpacity, transform: [{ translateY: titleY }] }]}>
          <Text style={styles.titleCn}>玉腹模拟器</Text>
          <View style={styles.titleLine} />
          <Text style={styles.titleSub}>地表最强恋肠模拟器</Text>
        </Animated.View>

        {/* ── Spacer ── */}
        <View style={{ flex: 1 }} />

        {/* ── Buttons (left-aligned, pure text) ── */}
        <View style={styles.menuBlock}>
          {BUTTONS.map((btn, i) => (
            <MenuButton
              key={i}
              label={btn.label}
              highlight={btn.highlight}
              onPress={() => btn.action(ctx)}
              delay={i * 60}
            />
          ))}
        </View>

        {/* ── Spacer ── */}
        <View style={{ flex: 1 }} />
      </View>

      {/* ── Bottom bar — absolutely positioned full-width ── */}
      <View style={[styles.bottomBar, { bottom: bottomPad + 8 }]}>
        <Text style={styles.versionText}>{APP_VERSION}</Text>
        <TouchableOpacity onPress={() => setDevInfoOpen(true)} activeOpacity={0.7}>
          <Text style={styles.devBtnText}>© 独立开发作品</Text>
        </TouchableOpacity>
      </View>

      <WipModal
        visible={wipLabel !== null}
        label={wipLabel ?? ''}
        onClose={() => setWipLabel(null)}
      />
      <DevInfoModal visible={devInfoOpen} onClose={() => setDevInfoOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  bg: {
    flex: 1,
    backgroundColor: '#1a0018',
  },
  bgImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    transform: [{ scale: 1.08 }],
  },
  root: {
    flex: 1,
    alignItems: 'flex-end',
    paddingRight: 28,
  },

  /* Title */
  titleBlock: {
    alignItems: 'flex-end',
    marginTop: 24,
  },
  titleCn: {
    fontSize: 34,
    fontFamily: 'Inter_700Bold',
    color: '#ffb8d8',
    letterSpacing: 8,
    textShadowColor: 'rgba(255,100,180,0.7)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 18,
  },
  titleLine: {
    width: 140,
    height: 1,
    backgroundColor: 'rgba(255,150,200,0.4)',
    marginTop: 10,
    marginBottom: 7,
  },
  titleSub: {
    fontSize: 10,
    fontFamily: 'Inter_400Regular',
    color: 'rgba(255,180,220,0.5)',
    letterSpacing: 5,
  },

  /* Buttons */
  menuBlock: {
    alignItems: 'flex-end',
  },
  menuBtnWrap: {
    alignItems: 'flex-end',
  },
  menuBtn: {
    paddingVertical: 8,
    paddingLeft: 12,
    alignItems: 'flex-end',
    minWidth: 90,
  },
  menuBtnLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
    letterSpacing: 4,
    color: 'rgba(255,210,230,0.88)',
    textAlign: 'right',
    textShadowColor: 'rgba(0,0,0,0.9)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 6,
  },
  menuBtnHighlight: {
    color: '#ff8ec8',
    textShadowColor: 'rgba(0,0,0,0.9)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  menuBtnHovered: {
    color: '#ffffff',
    textShadowColor: 'rgba(0,0,0,0.95)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  btnUnderline: {
    height: 1,
    width: 0,
    backgroundColor: 'transparent',
    marginTop: 1,
  },
  btnUnderlineActive: {
    width: 32,
    backgroundColor: 'rgba(255,140,200,0.75)',
  },

  /* Bottom bar */
  bottomBar: {
    position: 'absolute',
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  versionText: {
    fontSize: 10,
    fontFamily: 'Inter_400Regular',
    color: 'rgba(255,180,210,0.38)',
    letterSpacing: 1,
  },
  devBtnText: {
    fontSize: 10,
    fontFamily: 'Inter_400Regular',
    color: 'rgba(255,180,210,0.42)',
    letterSpacing: 1,
  },

  /* Modals */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.68)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBox: {
    backgroundColor: '#1e0828',
    borderRadius: 8,
    padding: 28,
    width: 260,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,120,180,0.30)',
  },
  modalTitle: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    color: '#ffb8d8',
    marginBottom: 12,
    letterSpacing: 3,
  },
  modalLabel: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    color: 'rgba(255,180,220,0.9)',
    textAlign: 'center',
    marginBottom: 6,
    letterSpacing: 2,
  },
  modalDesc: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: 'rgba(255,200,230,0.70)',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 22,
  },
  modalBtn: {
    backgroundColor: 'rgba(180,30,100,0.7)',
    paddingHorizontal: 30,
    paddingVertical: 9,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,120,180,0.40)',
  },
  modalBtnText: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: '#ffcce8',
    letterSpacing: 2,
  },
});
