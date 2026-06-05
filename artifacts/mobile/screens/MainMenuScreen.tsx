import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Platform,
  ImageBackground, Animated, Modal, Pressable, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useGame } from '@/contexts/GameContext';

const COVER_IMG = require('@/assets/images/main_menu_cover.png');

interface WipModalProps {
  visible: boolean;
  label: string;
  onClose: () => void;
}

function WipModal({ visible, label, onClose }: WipModalProps) {
  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <View style={styles.modalBox}>
          <Text style={styles.modalTitle}>🚧 正在开发中</Text>
          <Text style={styles.modalDesc}>「{label}」功能尚未开放，敬请期待。</Text>
          <TouchableOpacity style={styles.modalBtn} onPress={onClose}>
            <Text style={styles.modalBtnText}>确定</Text>
          </TouchableOpacity>
        </View>
      </Pressable>
    </Modal>
  );
}

interface DevInfoModalProps {
  visible: boolean;
  onClose: () => void;
}

function DevInfoModal({ visible, onClose }: DevInfoModalProps) {
  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <View style={styles.modalBox}>
          <Text style={styles.modalTitle}>开发者信息</Text>
          <Text style={styles.modalDesc}>
            {'玉腹模拟器\n腹腔物理仿真引擎 v1.0\n\n独立开发作品\n保留所有权利'}
          </Text>
          <TouchableOpacity style={styles.modalBtn} onPress={onClose}>
            <Text style={styles.modalBtnText}>关闭</Text>
          </TouchableOpacity>
        </View>
      </Pressable>
    </Modal>
  );
}

export function MainMenuScreen() {
  const insets = useSafeAreaInsets();
  const { setScreen } = useGame();
  const [wipLabel, setWipLabel] = useState<string | null>(null);
  const [devInfoOpen, setDevInfoOpen] = useState(false);

  const titleOpacity = useRef(new Animated.Value(0)).current;
  const titleY = useRef(new Animated.Value(-20)).current;
  const btnOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(titleOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(titleY,      { toValue: 0, duration: 500, useNativeDriver: true }),
      Animated.timing(btnOpacity,  { toValue: 1, duration: 500, useNativeDriver: true }),
    ]).start();
  }, []);

  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom;
  const topPad    = Platform.OS === 'web' ? 67 : insets.top;

  const BUTTONS: { label: string; sub: string; action: () => void }[] = [
    { label: '继续游戏', sub: '读取上次存档',   action: () => setWipLabel('继续游戏') },
    { label: '开始',     sub: '从头开始冒险',   action: () => setWipLabel('开始') },
    { label: '故事模式', sub: '剧情引导体验',   action: () => setWipLabel('故事模式') },
    { label: '沙盒模式', sub: '自由腹腔物理探索', action: () => setScreen('simulation') },
    { label: '存档',     sub: '管理游戏存档',   action: () => setWipLabel('存档') },
    { label: '帮助',     sub: '游戏系统手册',   action: () => setScreen('help') },
    { label: '设置',     sub: '游戏选项与调整', action: () => setScreen('settings') },
  ];

  return (
    <ImageBackground
      source={COVER_IMG}
      style={styles.bg}
      resizeMode="cover"
    >
      {/* Dark gradient overlay */}
      <View style={styles.overlay} />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.container, { paddingTop: topPad, paddingBottom: bottomPad + 56 }]}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* Title */}
        <Animated.View style={[styles.titleBlock, { opacity: titleOpacity, transform: [{ translateY: titleY }] }]}>
          <Text style={styles.titleCn}>玉腹模拟器</Text>
          <Text style={styles.titleSub}>腹腔物理仿真系统</Text>
        </Animated.View>

        {/* Menu buttons */}
        <Animated.View style={[styles.menuBlock, { opacity: btnOpacity }]}>
          {BUTTONS.map((btn, i) => (
            <TouchableOpacity
              key={i}
              style={[
                styles.menuBtn,
                btn.label === '沙盒模式' && styles.menuBtnHighlight,
              ]}
              onPress={btn.action}
              activeOpacity={0.75}
            >
              <Text style={[
                styles.menuBtnLabel,
                btn.label === '沙盒模式' && styles.menuBtnLabelHighlight,
              ]}>
                {btn.label}
              </Text>
              <Text style={styles.menuBtnSub}>{btn.sub}</Text>
            </TouchableOpacity>
          ))}
        </Animated.View>
      </ScrollView>

      {/* Bottom bar: version + dev info — floats above scroll */}
      <View style={[styles.bottomBar, { bottom: bottomPad + 12 }]}>
        <Text style={styles.versionText}>v0.10.beta</Text>
        <TouchableOpacity onPress={() => setDevInfoOpen(true)} activeOpacity={0.7}>
          <Text style={styles.devBtnText}>开发者信息</Text>
        </TouchableOpacity>
      </View>

      <WipModal
        visible={wipLabel !== null}
        label={wipLabel ?? ''}
        onClose={() => setWipLabel(null)}
      />
      <DevInfoModal
        visible={devInfoOpen}
        onClose={() => setDevInfoOpen(false)}
      />
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: {
    flex: 1,
    backgroundColor: '#06020a',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(4,2,10,0.62)',
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  titleBlock: {
    alignItems: 'center',
    marginBottom: 36,
  },
  titleCn: {
    fontSize: 36,
    fontFamily: 'Inter_700Bold',
    color: '#f0d9a8',
    letterSpacing: 6,
    textShadow: '0px 2px 14px rgba(200,130,30,0.7)',
  },
  titleSub: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: 'rgba(200,170,100,0.65)',
    letterSpacing: 4,
    marginTop: 6,
  },

  menuBlock: {
    width: '68%',
    alignItems: 'stretch',
    gap: 7,
  },
  menuBtn: {
    paddingVertical: 9,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(20,10,30,0.72)',
    borderRadius: 7,
    borderWidth: 1,
    borderColor: 'rgba(180,130,60,0.22)',
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  menuBtnHighlight: {
    backgroundColor: 'rgba(80,30,10,0.85)',
    borderColor: 'rgba(255,160,50,0.55)',
    borderWidth: 1.5,
  },
  menuBtnLabel: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    color: '#e8d4a8',
    letterSpacing: 2,
  },
  menuBtnLabelHighlight: {
    color: '#ffcc66',
  },
  menuBtnSub: {
    fontSize: 10,
    fontFamily: 'Inter_400Regular',
    color: 'rgba(180,150,90,0.50)',
    letterSpacing: 0.5,
  },

  bottomBar: {
    position: 'absolute',
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  versionText: {
    fontSize: 10,
    fontFamily: 'Inter_400Regular',
    color: 'rgba(140,110,60,0.45)',
    letterSpacing: 1,
  },
  devBtnText: {
    fontSize: 10,
    fontFamily: 'Inter_400Regular',
    color: 'rgba(160,130,80,0.5)',
    letterSpacing: 1,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBox: {
    backgroundColor: '#1a0e2a',
    borderRadius: 12,
    padding: 28,
    width: 260,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(180,130,60,0.35)',
  },
  modalTitle: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    color: '#f0d090',
    marginBottom: 10,
  },
  modalDesc: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: 'rgba(220,190,140,0.8)',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  modalBtn: {
    backgroundColor: 'rgba(120,60,10,0.8)',
    paddingHorizontal: 28,
    paddingVertical: 9,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(200,130,40,0.4)',
  },
  modalBtnText: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: '#ffcc66',
    letterSpacing: 1,
  },
});
