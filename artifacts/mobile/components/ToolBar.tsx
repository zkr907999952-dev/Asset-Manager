import React, { useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, Animated, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useGame } from '@/contexts/GameContext';
import { TOOL_LIST, type ToolType } from '../constants/gameConfig';

const TOOLBAR_WIDTH = 180;

const TOOL_ICONS: Record<string, string> = {
  '金属棒': 'minus',
  '抓握': 'anchor',
  '振动器': 'zap',
  '长柄针': 'edit-2',
  '电击器': 'activity',
  '注射器': 'droplet',
  '灌肠器': 'git-branch',
};

export function ToolBar() {
  const colors = useColors();
  const { state, setActiveTool } = useGame();
  const [expanded, setExpanded] = React.useState(false);
  const translateX = useRef(new Animated.Value(TOOLBAR_WIDTH)).current;

  useEffect(() => {
    Animated.spring(translateX, {
      toValue: expanded ? 0 : TOOLBAR_WIDTH,
      useNativeDriver: true,
      tension: 90, friction: 16,
    }).start();
  }, [expanded]);

  const handleSelect = (tool: ToolType) => {
    if (state.activeTool === tool) {
      setActiveTool(null);
    } else {
      setActiveTool(tool);
    }
    setExpanded(false);
  };

  return (
    <View style={styles.wrapper} pointerEvents="box-none">
      {/* Tab trigger */}
      <TouchableOpacity
        style={[styles.tab, { backgroundColor: colors.card, borderColor: colors.border }]}
        onPress={() => setExpanded(v => !v)}
        activeOpacity={0.7}
      >
        <Feather name={expanded ? 'chevron-right' : 'tool'} size={16} color={colors.primary} />
        {state.activeTool && (
          <View style={[styles.tabDot, { backgroundColor: colors.primary }]} />
        )}
      </TouchableOpacity>

      {/* Expanded tool list */}
      <Animated.View
        style={[
          styles.panel,
          {
            transform: [{ translateX }],
            backgroundColor: colors.card,
            borderColor: colors.border,
          },
        ]}
        pointerEvents={expanded ? 'auto' : 'none'}
      >
        <Text style={[styles.panelTitle, { color: colors.mutedForeground }]}>工具选择</Text>
        {TOOL_LIST.map(tool => {
          const active = state.activeTool === tool.id;
          return (
            <TouchableOpacity
              key={tool.id}
              style={[
                styles.toolItem,
                { borderColor: active ? colors.primary : colors.border },
                active && { backgroundColor: `${colors.primary}22` },
              ]}
              onPress={() => handleSelect(tool.id)}
              activeOpacity={0.75}
            >
              <Feather
                name={TOOL_ICONS[tool.id] as any || 'circle'}
                size={14}
                color={active ? colors.primary : colors.mutedForeground}
              />
              <View style={styles.toolText}>
                <Text style={[styles.toolName, { color: active ? colors.primary : colors.foreground }]}>
                  {tool.id}
                </Text>
                <Text style={[styles.toolDesc, { color: colors.mutedForeground }]}>{tool.desc}</Text>
              </View>
              {active && <View style={[styles.activeDot, { backgroundColor: colors.primary }]} />}
            </TouchableOpacity>
          );
        })}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    right: 0,
    top: 80,
    flexDirection: 'row',
    alignItems: 'flex-start',
    zIndex: 5,
  },
  tab: {
    width: 28,
    paddingVertical: 14,
    alignItems: 'center',
    borderTopLeftRadius: 8,
    borderBottomLeftRadius: 8,
    borderWidth: 1,
    borderRightWidth: 0,
    marginTop: 10,
  },
  tabDot: {
    width: 5, height: 5,
    borderRadius: 3,
    marginTop: 4,
  },
  panel: {
    width: TOOLBAR_WIDTH,
    borderTopLeftRadius: 10,
    borderBottomLeftRadius: 10,
    borderWidth: 1,
    borderRightWidth: 0,
    paddingVertical: 10,
    paddingHorizontal: 8,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: { width: -2, height: 0 },
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
  toolName: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
  },
  toolDesc: {
    fontSize: 9,
    fontFamily: 'Inter_400Regular',
    marginTop: 1,
  },
  activeDot: {
    width: 5, height: 5, borderRadius: 3,
  },
});
