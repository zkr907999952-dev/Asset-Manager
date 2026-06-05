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
          <Text style={styles.modalTitle}>正在开发中</Text>
          <Text style={styles.modalDesc}>「{label}」功能尚未开放，敬请期待。</Text>
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
            {`玉腹模拟器\n腹腔物理仿真引擎 ${APP_VERSION}\n\n独立开发作品\n保留所有权利`}
          </Text>
          <TouchableOpacity style={styles.modalBtn} onPress={onClose}>
            <Text style={styles.modalBtnText}>关闭</Text>
          </TouchableOpacity>
        </View>
      </Pressable>
    </Modal>
  );
}

const BUTTONS: { label: string; action: (ctx: { setScreen: (s: string) => void; setWip: (l: string) => void }) => void; highlight?: boolean }[] = [
  { label: '继续游戏', action: ({ setWip }) => setWip('继续游戏') },
  { label: '开始',     action: ({ setWip }) => setWip('开始') },
  { label: '故事模式', action: ({ setWip }) => setWip('故事模式') },
  { label: '沙盒模式', action: ({ setScreen }) => setScreen('simulation'), highlight: true },
  { label: '存档',     action: ({ setWip }) => setWip('存档') },
  { label: '帮助',     action: ({ setScreen }) => setScreen('help') },
  { label: '设置',     action: ({ setScreen }) => setScreen('settings') },
];

export function MainMenuScreen() {
  const insets = useSafeAreaInsets();
  const { setScreen } = useGame();
  const [wipLabel, setWipLabel] = useState<string | null>(null);
  const [devInfoOpen, setDevInfoOpen] = useState(false);

  const titleOpacity = useRef(new Animated.Value(0)).current;
  const titleY       = useRef(new Animated.Value(-16)).current;
  const btnOpacity   = useRef(new Animated.Value(0)).current;
  const lineScale    = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(titleOpacity, { toValue: 1, duration: 700, useNativeDriver: false }),
      Animated.timing(titleY,       { toValue: 0, duration: 700, useNativeDriver: false }),
      Animated.timing(lineScale,    { toValue: 1, duration: 700, useNativeDriver: false }),
      Animated.timing(btnOpacity,   { toValue: 1, duration: 900, useNativeDriver: false }),
    ]).start();
  }, []);

  const bottomPad = Platform.OS === 'web' ? 20 : insets.bottom;
  const topPad    = Platform.OS === 'web' ? 20 : insets.top;

  const ctx = { setScreen, setWip: (l: string) => setWipLabel(l) };

  return (
    <View style={styles.bg}>
      <Image source={COVER_IMG} style={styles.bgImage} resizeMode="cover" />
      <View style={styles.overlay} />

      <View style={[styles.root, { paddingTop: topPad, paddingBottom: bottomPad }]}>

        {/* ── Title ── */}
        <Animated.View style={[styles.titleBlock, { opacity: titleOpacity, transform: [{ translateY: titleY }] }]}>
          <Text style={styles.titleKana}>ぎょくふく</Text>
          <Text style={styles.titleCn}>玉腹模拟器</Text>
          <Animated.View style={[styles.titleLine, { transform: [{ scaleX: lineScale }] }]} />
          <Text style={styles.titleSub}>腹腔物理仿真系统</Text>
        </Animated.View>

        {/* ── Spacer ── */}
        <View style={{ flex: 1 }} />

        {/* ── Buttons ── */}
        <Animated.View style={[styles.menuBlock, { opacity: btnOpacity }]}>
          {BUTTONS.map((btn, i) => (
            <TouchableOpacity
              key={i}
              style={[styles.menuBtn, btn.highlight && styles.menuBtnHighlight]}
              onPress={() => btn.action(ctx)}
              activeOpacity={0.7}
            >
              {btn.highlight && <View style={styles.btnAccentLeft} />}
              <Text style={[styles.menuBtnLabel, btn.highlight && styles.menuBtnLabelHighlight]}>
                {btn.label}
              </Text>
              {btn.highlight && <View style={styles.btnAccentRight} />}
            </TouchableOpacity>
          ))}
        </Animated.View>

        {/* ── Spacer ── */}
        <View style={{ flex: 1 }} />

        {/* ── Bottom bar ── */}
        <View style={styles.bottomBar}>
          <Text style={styles.versionText}>{APP_VERSION}</Text>
          <TouchableOpacity onPress={() => setDevInfoOpen(true)} activeOpacity={0.7}>
            <Text style={styles.devBtnText}>© 独立开发作品</Text>
          </TouchableOpacity>
        </View>
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
    backgroundColor: '#05010c',
  },
  bgImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(2,1,8,0.72)',
  },
  root: {
    flex: 1,
    alignItems: 'center',
  },

  /* Title */
  titleBlock: {
    alignItems: 'center',
    marginTop: 32,
  },
  titleKana: {
    fontSize: 11,
    color: 'rgba(200,168,90,0.38)',
    letterSpacing: 10,
    marginBottom: 6,
    fontFamily: 'Inter_400Regular',
  },
  titleCn: {
    fontSize: 40,
    fontFamily: 'Inter_700Bold',
    color: '#f0d888',
    letterSpacing: 10,
    textShadowColor: 'rgba(220,160,20,0.75)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 22,
  },
  titleLine: {
    width: 180,
    height: 1,
    backgroundColor: 'rgba(200,160,50,0.35)',
    marginTop: 14,
    marginBottom: 10,
  },
  titleSub: {
    fontSize: 10,
    fontFamily: 'Inter_400Regular',
    color: 'rgba(200,168,90,0.42)',
    letterSpacing: 6,
  },

  /* Buttons */
  menuBlock: {
    width: '62%',
    alignItems: 'stretch',
    gap: 8,
  },
  menuBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(4,2,12,0.92)',
    borderRadius: 3,
    borderWidth: 1,
    borderColor: 'rgba(180,140,60,0.55)',
  },
  menuBtnHighlight: {
    backgroundColor: 'rgba(40,14,2,0.95)',
    borderColor: 'rgba(240,160,30,0.90)',
    borderWidth: 1.5,
  },
  menuBtnLabel: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    color: '#e8d49a',
    letterSpacing: 5,
    textAlign: 'center',
  },
  menuBtnLabelHighlight: {
    color: '#ffd45a',
    textShadowColor: 'rgba(255,180,0,0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  btnAccentLeft: {
    width: 14,
    height: 1,
    backgroundColor: 'rgba(240,160,30,0.6)',
    marginRight: 10,
  },
  btnAccentRight: {
    width: 14,
    height: 1,
    backgroundColor: 'rgba(240,160,30,0.6)',
    marginLeft: 10,
  },

  /* Bottom bar */
  bottomBar: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  versionText: {
    fontSize: 10,
    fontFamily: 'Inter_400Regular',
    color: 'rgba(150,120,60,0.45)',
    letterSpacing: 1,
  },
  devBtnText: {
    fontSize: 10,
    fontFamily: 'Inter_400Regular',
    color: 'rgba(160,130,75,0.5)',
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
    backgroundColor: '#140a22',
    borderRadius: 8,
    padding: 28,
    width: 260,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(180,130,60,0.32)',
  },
  modalTitle: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    color: '#f0d080',
    marginBottom: 12,
    letterSpacing: 3,
  },
  modalDesc: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: 'rgba(220,190,140,0.78)',
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 22,
  },
  modalBtn: {
    backgroundColor: 'rgba(100,45,8,0.85)',
    paddingHorizontal: 30,
    paddingVertical: 9,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(200,130,35,0.38)',
  },
  modalBtnText: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: '#ffcc55',
    letterSpacing: 2,
  },
});
