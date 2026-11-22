import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from './src/navigation/AppNavigator';
import { AppModalProvider } from './src/components/AppModal';
import { useAppTheme } from './src/theme';

export default function App() {
  const theme = useAppTheme();
  return (
    <SafeAreaProvider>
      <AppModalProvider>
        <AppNavigator />
      </AppModalProvider>
      <StatusBar style={theme.dark ? 'light' : 'dark'} />
    </SafeAreaProvider>
  );
}
