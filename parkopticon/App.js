import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from './src/navigation/AppNavigator';
import { AppModalProvider } from './src/components/AppModal';

export default function App() {
  return (
    <SafeAreaProvider>
      <AppModalProvider>
        <AppNavigator />
      </AppModalProvider>
      <StatusBar style="dark" />
    </SafeAreaProvider>
  );
}
