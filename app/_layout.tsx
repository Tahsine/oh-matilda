import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Image, StatusBar, View } from "react-native";
import { colorScheme, useColorScheme, vars } from "nativewind";
import { useFonts } from 'expo-font';
import { Toast } from "../components/ui/Toast";
import { isModelReady } from "../lib/models";
import { prepareEmbedding, prepareLocalLLM, checkGpuSupport } from "../lib/provider";
import { getActiveProvider, setGpuSupported } from "../lib/providers/registry";
import { getSetting } from "../lib/settings";
import { detectLanguage, initI18n } from "../lib/i18n";
import OnboardingScreen from "./onboarding";
import '../polyfills';
import './global.css';

SplashScreen.preventAutoHideAsync();

const LIGHT_VARS = {
  '--color-bg': '#FFFFFF',
  '--color-surface': '#F5F5F5',
  '--color-surface-hover': '#E5E5E5',
  '--color-border': '#E5E5E5',
  '--color-text-primary': '#1A1A1A',
  '--color-text-secondary': '#525252',
  '--color-text-muted': '#737373',
  '--color-text-subtle': '#A3A3A3',
  '--color-icon': '#525252',
  '--color-chevron': '#A3A3A3',
  '--color-primary': '#64748B',
  '--color-primary-hover': '#475569',
  '--color-warning': '#F97316',
  '--color-danger': '#EF4444',
  '--color-info': '#3B82F6',
  '--color-code-text': '#A78BFA',
  '--color-code-bg': '#F5F5F5',
  '--color-code-block-bg': '#F0F0F0',
  '--color-link': '#3B82F6',
  '--color-input-bg': '#F5F5F5',
  '--color-input-placeholder': '#A3A3A3',
  '--color-modal-overlay': 'rgba(0,0,0,0.4)',
  '--color-skeleton': '#E5E5E5',
};

const DARK_VARS = {
  '--color-bg': '#1E1E1E',
  '--color-surface': '#2A2A2A',
  '--color-surface-hover': '#333333',
  '--color-border': '#262626',
  '--color-text-primary': '#E4E4E7',
  '--color-text-secondary': '#D4D4D4',
  '--color-text-muted': '#A3A3A3',
  '--color-text-subtle': '#737373',
  '--color-icon': '#D4D4D4',
  '--color-chevron': '#737373',
  '--color-primary': '#64748B',
  '--color-primary-hover': '#475569',
  '--color-warning': '#F97316',
  '--color-danger': '#EF4444',
  '--color-info': '#3B82F6',
  '--color-code-text': '#A78BFA',
  '--color-code-bg': '#2A2A2A',
  '--color-code-block-bg': '#1A1A1A',
  '--color-link': '#60A5FA',
  '--color-input-bg': '#2A2A2A',
  '--color-input-placeholder': '#525252',
  '--color-modal-overlay': 'rgba(0,0,0,0.6)',
  '--color-skeleton': '#333333',
};

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

  const themeVars = useMemo(
    () => (activeTheme === 'dark' ? DARK_VARS : LIGHT_VARS),
    [activeTheme],
  );

  const check = useCallback(async () => {
    const onboarded = getSetting('onboarded') === 'true';
    if (!onboarded) {
      setPhase("onboarding");
      SplashScreen.hideAsync();
      return;
    }
    const gpuOk = await checkGpuSupport();
    setGpuSupported(gpuOk);
    const ready = await isModelReady();
    setPhase(ready ? "app" : "onboarding");
    SplashScreen.hideAsync();
    if (ready) {
      prepareEmbedding();
      if (getActiveProvider().provider === 'llama-local') {
        prepareLocalLLM().catch(err => console.warn('[layout] prepareLocalLLM failed:', err));
      }
    }
  }, []);

  const handleOnboardingComplete = useCallback(() => {
    setPhase("app");
  }, []);

  useEffect(() => {
    if (!fontsLoaded) return;
    initI18n();
    detectLanguage();
    const saved = getSetting('theme');
    if (saved !== 'system') colorScheme.set(saved as 'light' | 'dark');
    check();
  }, [fontsLoaded, check]);

  if (!fontsLoaded || phase === "loading") {
    const bg = activeTheme === "dark" ? "#000000" : "#FFFFFF";
    return (
      <View style={[{ flex: 1, backgroundColor: bg, justifyContent: "center", alignItems: "center" }, vars(themeVars)]}>
        <StatusBar barStyle={activeTheme === "dark" ? "light-content" : "dark-content"} backgroundColor={bg} />
        <Image source={require("../assets/images/icon.png")} style={{ width: 200, height: 200 }} />
      </View>
    );
  }

  if (phase === "onboarding") {
    return (
      <View style={vars(themeVars)} className="flex-1">
        <StatusBar barStyle={activeTheme === "dark" ? "light-content" : "dark-content"} backgroundColor={themeVars['--color-bg'] as string} />
        <GestureHandlerRootView style={{ flex: 1 }}>
          <KeyboardProvider>
            <OnboardingScreen onComplete={handleOnboardingComplete} />
          </KeyboardProvider>
        </GestureHandlerRootView>
      </View>
    );
  }

  return (
    <View style={vars(themeVars)} className="flex-1">
      <StatusBar barStyle={activeTheme === "dark" ? "light-content" : "dark-content"} backgroundColor={themeVars['--color-bg'] as string} />
      <GestureHandlerRootView style={{ flex: 1 }}>
        <KeyboardProvider>
          <Stack screenOptions={{ headerShown: false, animation: 'fade', contentStyle: { backgroundColor: themeVars['--color-bg'] as string } }} />
        </KeyboardProvider>
      </GestureHandlerRootView>
      <Toast />
    </View>
  );
}
