import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { useCallback, useEffect, useState } from "react";
import { Image, View } from "react-native";
import { colorScheme, useColorScheme } from "nativewind";
import { useFonts } from 'expo-font';
import { isModelReady, onDownloadState } from "../lib/models";
import { prepareEmbedding } from "../lib/provider";
import { getSetting } from "../lib/settings";
import OnboardingScreen from "./onboarding";
import '../polyfills';
import './global.css';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    SpaceGrotesk: require('../assets/fonts/SpaceGrotesk-Regular.ttf'),
    SpaceGroteskMedium: require('../assets/fonts/SpaceGrotesk-Medium.ttf'),
    SpaceGroteskBold: require('../assets/fonts/SpaceGrotesk-Bold.ttf'),
    JetBrainsMono: require('../assets/fonts/JetBrainsMono-Regular.ttf'),
    JetBrainsMonoMedium: require('../assets/fonts/JetBrainsMono-Medium.ttf'),
    JetBrainsMonoBold: require('../assets/fonts/JetBrainsMono-Bold.ttf'),
  });

  const [phase, setPhase] = useState<"loading" | "onboarding" | "app">("loading");
  const { colorScheme: activeTheme } = useColorScheme();

  const check = useCallback(async () => {
    const ready = await isModelReady();
    setPhase(ready ? "app" : "onboarding");
    SplashScreen.hideAsync();
    if (ready) prepareEmbedding();
  }, []);

  useEffect(() => {
    if (!fontsLoaded) return;
    const saved = getSetting('theme');
    setTimeout(() => {
      if (saved !== 'system') colorScheme.set(saved as 'light' | 'dark');
    }, 0);
    check();
    const unsub = onDownloadState((s) => {
      if (s.status === "done" || s.status === "skipped") {
        setPhase("app");
      }
    });
    return unsub;
  }, [fontsLoaded, check]);

  if (!fontsLoaded || phase === "loading") {
    const bg = activeTheme === "dark" ? "#000000" : "#FFFFFF";
    return (
      <View style={{ flex: 1, backgroundColor: bg, justifyContent: "center", alignItems: "center" }}>
        <Image source={require("../assets/images/icon.png")} style={{ width: 200, height: 200 }} />
      </View>
    );
  }

  if (phase === "onboarding") {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <KeyboardProvider>
          <OnboardingScreen />
        </KeyboardProvider>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}
