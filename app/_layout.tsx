import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import '../polyfills';
import './global.css';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </KeyboardProvider>
    </GestureHandlerRootView>
  )
}
