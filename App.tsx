import React from 'react';
import { View, StyleSheet, StatusBar } from 'react-native';
import { AppProvider, useApp } from './src/context/AppContext';
import { MainLayout } from './src/components/layout/MainLayout';
import { LoginScreen } from './src/screens/LoginScreen';

const RootApp: React.FC = () => {
  const { currentUser } = useApp();

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      {currentUser ? <MainLayout /> : <LoginScreen />}
    </View>
  );
};

export default function App() {
  return (
    <AppProvider>
      <RootApp />
    </AppProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    height: '100%',
    width: '100%',
  },
});
