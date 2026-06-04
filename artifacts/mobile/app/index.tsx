import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useGame } from '@/contexts/GameContext';
import { AppDrawer } from '@/components/AppDrawer';
import { CharacterScreen } from '@/screens/CharacterScreen';
import { SimulationScreen } from '@/screens/SimulationScreen';
import { ConsoleScreen } from '@/screens/ConsoleScreen';
import { SettingsScreen } from '@/screens/SettingsScreen';
import { HelpScreen } from '@/screens/HelpScreen';
import { MesenteryEditorScreen } from '@/screens/MesenteryEditorScreen';
import { useColors } from '@/hooks/useColors';

export default function App() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { state } = useGame();
  const colors = useColors();

  const renderScreen = () => {
    const props = { onMenuPress: () => setDrawerOpen(true) };
    switch (state.currentScreen) {
      case 'character': return <CharacterScreen {...props} />;
      case 'console': return <ConsoleScreen {...props} />;
      case 'settings': return <SettingsScreen {...props} />;
      case 'help': return <HelpScreen {...props} />;
      case 'mesenteryEditor': return <MesenteryEditorScreen {...props} />;
      default: return <SimulationScreen {...props} />;
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {renderScreen()}
      <AppDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
