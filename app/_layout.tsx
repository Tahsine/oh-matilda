import { Stack } from "expo-router";
import { KeyboardProvider } from "react-native-keyboard-controller";
import '../polyfills';
import './global.css';

export default function RootLayout() {
  return (
    <KeyboardProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </KeyboardProvider>
  )
  
}
