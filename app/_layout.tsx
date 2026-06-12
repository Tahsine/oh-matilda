import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { useCallback, useEffect, useState } from "react";
import { Image, useColorScheme, View } from "react-native";
import { isModelReady, onDownloadState } from "../lib/models";
import { prepareEmbedding } from "../lib/provider";
import OnboardingScreen from "./onboarding";
import '../polyfills';
import './global.css';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [phase, setPhase] = useState<"loading" | "onboarding" | "app">("loading");
  const theme = useColorScheme();

  const check = useCallback(async () => {
    const ready = await isModelReady();
    setPhase(ready ? "app" : "onboarding");
    SplashScreen.hideAsync();
    if (ready) prepareEmbedding();
  }, []);

  useEffect(() => {
    check();
    const unsub = onDownloadState((s) => {
      if (s.status === "done" || s.status === "skipped") {
        setPhase("app");
      }
    });
    return unsub;
  }, [check]);

  if (phase === "loading") {
    const bg = theme === "dark" ? "#000000" : "#FFFFFF";
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
