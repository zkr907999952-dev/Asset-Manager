import React, { useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, Animated, StyleSheet, ScrollView, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useGame } from '@/contexts/GameContext';
import { TOOL_LIST, type ToolType } from '../constants/gameConfig';
import { CommandPanel } from './CommandPanel';
import { SurgeryPanel } from './SurgeryPanel';
import { BellyStrikePanel } from './BellyStrikePanel';
import { LethalWeaponPanel } from './LethalWeaponPanel';
import { IntestineExposurePanel } from './IntestineExposurePanel';

const PANEL_WIDTH = 210;
const TAB_WIDTH = 32;
const PANEL_MAX_HEIGHT = 400;
const WRAPPER_HEIGHT = 510;
const TAB_SPACING = 66;

type TabId = 'tools' | 'commands' | 'surgery' | 'strike' | 'lethal' | 'expose';

const TOOL_ICONS: Record<string, string> = {
  '金属棒':   'minus',
  '抓握':     'anchor',
  '振动器':   'zap',
  '长柄针':   'edit-2',
  '电击器':   'activity',
  '注射器':   'droplet',
  '灌肠器':   'git-branch',
  '刺刀':     'navigation',
  '长硅胶棒': 'bar-chart-2',
  '拉珠':     'more-horizontal',
  '吞入跳蛋': 'circle',
};

const TABS: { id: TabId; icon: string; label: string }[] = [
  { id: 'tools', icon: 'tool', label: '工具' },
  { id: 'commands', icon: 'command', label: '命令' },
  { id: 'surgery', icon: 'scissors', label: '手术' },
  { id: 'strike', icon: 'target', label: '腹击' },
  { id: 'lethal', icon: 'crosshair', label: '武器' },
  { id: 'expose', icon: 'external-link', label: '肠露出' },
];

const PANEL_BG = 'rgba(34,9,26,0.88)';
const TAB_BG_OPEN = 'rgba(232,121,160,0.18)';
const TAB_BG_CLOSED = 'rgba(34,9,26,0.78)';

function ToolsContent() {
  const colors = useColors();
  const { state, toggleToolEnabled } = useGame();

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      style={styles.toolScroll}
      nestedScrollEnabled
    >
      <Text style={[styles.panelTitle, { color: colors.mutedForeground }]}>工具选择</Text>
      {TOOL_LIST.map(tool => {
        const isEnabled = (state.enabledTools ?? []).includes(tool.id);
        const isActive = state.activeTool === tool.id;
        const isRunning = state.toolStates?.[tool.id]?.active === true;

        return (
          <TouchableOpacity
            key={tool.id}
            style={[
              styles.toolItem,
              {
                borderColor: isEnabled
                  ? (isRunning ? colors.primary : `${colors.primary}88`)
                  : colors.border,
              },
              isEnabled && { backgroundColor: isActive ? `${colors.primary}22` : `${colors.primary}10` },
            ]}
            onPress={() => toggleToolEnabled(tool.id)}
            activeOpacity={0.75}
          >
            <Feather
              name={TOOL_ICONS[tool.id] as any || 'circle'}
              size={14}
              color={
                isEnabled
                  ? (isRunning ? colors.primary : `${colors.primary}cc`)
                  : colors.mutedForeground
              }
            />
            <View style={styles.toolText}>
              <Text style={[styles.toolName, {
                color: isEnabled
                  ? (isRunning ? colors.primary : `${colors.primary}dd`)
                  : colors.foreground,
              }]}>
                {tool.id}
              </Text>
              <Text style={[styles.toolDesc, { color: colors.mutedForeground }]}>{tool.desc}</Text>
            </View>
            {isRunning && (
              <View style={[styles.runningDot, { backgroundColor: colors.primary }]} />
            )}
            {isEnabled && !isRunning && (
              <View style={[styles.activeDot, { backgroundColor: `${colors.primary}88` }]} />
            )}
          </TouchableOpacity>
        );
      })}
      <View style={styles.spacer} />
    </ScrollView>
  );
}

export function ToolBar() {
  const colors = useColors();
  const { state } = useGame();
  const [openTab, setOpenTab] = React.useState<TabId | null>(null);

  const toolsX = useRef(new Animated.Value(PANEL_WIDTH + TAB_WIDTH)).current;
  const commandsX = useRef(new Animated.Value(PANEL_WIDTH + TAB_WIDTH)).current;
  const surgeryX = useRef(new Animated.Value(PANEL_WIDTH + TAB_WIDTH)).current;
  const strikeX = useRef(new Animated.Value(PANEL_WIDTH + TAB_WIDTH)).current;
  const lethalX = useRef(new Animated.Value(PANEL_WIDTH + TAB_WIDTH)).current;
  const exposeX = useRef(new Animated.Value(PANEL_WIDTH + TAB_WIDTH)).current;
  const animMap: Record<TabId, Animated.Value> = { tools: toolsX, commands: commandsX, surgery: surgeryX, strike: strikeX, lethal: lethalX, expose: exposeX };

  useEffect(() => {
    const target = PANEL_WIDTH + TAB_WIDTH;
    TABS.forEach(tab => {
      Animated.spring(animMap[tab.id], {
        toValue: openTab === tab.id ? 0 : target,
        useNativeDriver: true,
        tension: 90, friction: 16,
      }).start();
    });
  }, [openTab]);

  const toggle = (tab: TabId) => setOpenTab(prev => prev === tab ? null : tab);

  const anyToolEnabled = (state.enabledTools ?? []).length > 0;
  const anyToolRunning = Object.values(state.toolStates ?? {}).some(ts => ts.active);
  const inSelMode = state.mesenterySelectionMode;
  const hasWeapon = !!state.selectedWeapon;

  // On native: wrapper uses "box-none" prop — wrapper itself ignores events, children receive them normally.
  // On web: wrapper uses style "none" (CSS pointer-events: none), then each interactive child
  //   explicitly overrides with style "auto" — CSS children can override parent's none.
  const wrapperProps = Platform.OS === 'web'
    ? { style: [styles.wrapper, { pointerEvents: 'none' as const }] }
    : { pointerEvents: 'box-none' as const, style: styles.wrapper };

  return (
    <View {...wrapperProps} collapsable={false}>
      {/* Panels — on web only interactive when open; on native always passthrough (off-screen when closed) */}
      <Animated.View
        style={[styles.panel, { top: 0, transform: [{ translateX: toolsX }], backgroundColor: PANEL_BG, borderColor: `${colors.border}cc` },
          Platform.OS === 'web' && { pointerEvents: openTab === 'tools' ? 'auto' : 'none' } as any,
        ]}
      >
        <ToolsContent />
      </Animated.View>

      {/* Commands panel */}
      <Animated.View
        style={[styles.panel, { top: 0, transform: [{ translateX: commandsX }], backgroundColor: PANEL_BG, borderColor: `${colors.border}cc` },
          Platform.OS === 'web' && { pointerEvents: openTab === 'commands' ? 'auto' : 'none' } as any,
        ]}
      >
        <CommandPanel />
      </Animated.View>

      {/* Surgery panel */}
      <Animated.View
        style={[styles.panel, { top: 0, transform: [{ translateX: surgeryX }], backgroundColor: PANEL_BG, borderColor: `${colors.border}cc` },
          Platform.OS === 'web' && { pointerEvents: openTab === 'surgery' ? 'auto' : 'none' } as any,
        ]}
      >
        <SurgeryPanel />
      </Animated.View>

      {/* Belly Strike panel */}
      <Animated.View
        style={[styles.panel, { top: 0, transform: [{ translateX: strikeX }], backgroundColor: PANEL_BG, borderColor: `${colors.border}cc` },
          Platform.OS === 'web' && { pointerEvents: openTab === 'strike' ? 'auto' : 'none' } as any,
        ]}
      >
        <BellyStrikePanel />
      </Animated.View>

      {/* Lethal weapons panel */}
      <Animated.View
        style={[styles.panel, { top: 0, transform: [{ translateX: lethalX }], backgroundColor: PANEL_BG, borderColor: '#e8404066' },
          Platform.OS === 'web' && { pointerEvents: openTab === 'lethal' ? 'auto' : 'none' } as any,
        ]}
      >
        <LethalWeaponPanel />
      </Animated.View>

      {/* Intestine exposure panel */}
      <Animated.View
        style={[styles.panel, { top: 0, transform: [{ translateX: exposeX }], backgroundColor: PANEL_BG, borderColor: '#88aaff66' },
          Platform.OS === 'web' && { pointerEvents: openTab === 'expose' ? 'auto' : 'none' } as any,
        ]}
      >
        <IntestineExposurePanel />
      </Animated.View>

      {/* 6 tab buttons — always interactive, evenly spaced */}
      {TABS.map((tab, i) => {
        const isOpen = openTab === tab.id;
        const hasDot = tab.id === 'tools' && (anyToolEnabled || anyToolRunning);
        const hasSel = tab.id === 'surgery' && inSelMode;
        const hasStrike = tab.id === 'strike' && !!state.bellyStrikeTool;
        const hasLethal = tab.id === 'lethal' && hasWeapon;
        const hasExpose = tab.id === 'expose' && (!!state.hookTool || state.hookInserted || state.exposedSmallIndices.length > 0);
        const dotColor = tab.id === 'tools'
          ? (anyToolRunning ? colors.primary : `${colors.primary}88`)
          : hasSel ? '#e05050'
          : hasStrike ? '#ff8844'
          : hasLethal ? '#e84040'
          : hasExpose ? '#88aaff'
          : colors.primary;

        return (
          <TouchableOpacity
            key={tab.id}
            style={[
              styles.tab,
              {
                top: i * TAB_SPACING,
                backgroundColor: isOpen
                  ? (tab.id === 'lethal' ? 'rgba(232,64,64,0.15)' : tab.id === 'expose' ? 'rgba(136,170,255,0.13)' : TAB_BG_OPEN)
                  : TAB_BG_CLOSED,
                borderColor: isOpen
                  ? (tab.id === 'strike' ? '#ff884488' : tab.id === 'lethal' ? '#e8404088' : tab.id === 'expose' ? '#88aaff88' : `${colors.primary}cc`)
                  : `${colors.border}99`,
              },
              Platform.OS === 'web' && { pointerEvents: 'auto' },
            ]}
            onPress={() => toggle(tab.id)}
            activeOpacity={0.7}
          >
            <Feather
              name={isOpen ? 'chevron-right' : (tab.icon as any)}
              size={15}
              color={isOpen
                ? (tab.id === 'strike' ? '#ff8844' : tab.id === 'lethal' ? '#e84040' : tab.id === 'expose' ? '#88aaff' : colors.primary)
                : colors.mutedForeground}
            />
            <Text style={[styles.tabLabel, { color: isOpen
              ? (tab.id === 'strike' ? '#ff8844' : tab.id === 'lethal' ? '#e84040' : tab.id === 'expose' ? '#88aaff' : colors.primary)
              : colors.mutedForeground }]}>
              {tab.label}
            </Text>
            {(hasDot || hasSel || hasStrike || hasLethal || hasExpose) && (
              <View style={[styles.tabDot, { backgroundColor: dotColor }]} />
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    right: 0,
    top: 70,
    width: PANEL_WIDTH + TAB_WIDTH,
    height: WRAPPER_HEIGHT,
    zIndex: 5,
  },
  tab: {
    position: 'absolute',
    right: 0,
    width: TAB_WIDTH,
    paddingVertical: 10,
    paddingHorizontal: 0,
    alignItems: 'center',
    borderTopLeftRadius: 8,
    borderBottomLeftRadius: 8,
    borderWidth: 1,
    borderRightWidth: 0,
    zIndex: 2,
    gap: 3,
  },
  tabLabel: {
    fontSize: 9,
    fontFamily: 'Inter_600SemiBold',
    writingDirection: 'ltr',
  },
  tabDot: {
    width: 5, height: 5,
    borderRadius: 3,
    marginTop: 1,
  },
  panel: {
    position: 'absolute',
    right: TAB_WIDTH,
    width: PANEL_WIDTH,
    maxHeight: PANEL_MAX_HEIGHT,
    borderTopLeftRadius: 10,
    borderBottomLeftRadius: 10,
    borderWidth: 1,
    borderRightWidth: 0,
    paddingVertical: 10,
    paddingHorizontal: 8,
    zIndex: 1,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 10,
    shadowOffset: { width: -2, height: 0 },
  },
  toolScroll: {
    flex: 1,
  },
  panelTitle: {
    fontSize: 10,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 1,
    textTransform: 'uppercase',
    paddingHorizontal: 4,
    marginBottom: 6,
  },
  toolItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 7,
    borderRadius: 6,
    borderWidth: 1,
    marginBottom: 4,
    gap: 8,
  },
  toolText: { flex: 1 },
  toolName: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  toolDesc: { fontSize: 9, fontFamily: 'Inter_400Regular', marginTop: 1 },
  runningDot: { width: 6, height: 6, borderRadius: 3 },
  activeDot: { width: 5, height: 5, borderRadius: 3 },
  spacer: { height: 8 },
});
