import { useEffect, useState } from "react";
import { Image, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { onDownloadState, startDownload, skipDownload, isModelReady, type DownloadState } from "../lib/models";

export default function OnboardingScreen() {
  const [dl, setDl] = useState<DownloadState>({ status: "idle", progress: 0, path: null });
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    const unsub = onDownloadState((s) => {
      setDl(s);
      if (s.status !== "idle") setStarting(false);
    });
    return unsub;
  }, []);

  const handleStart = () => {
    setStarting(true);
    startDownload();
  };

  const handleSkip = () => {
    skipDownload();
  };

  const pct = Math.round(dl.progress * 100);
  const barWidth = `${Math.max(pct, 5)}%`;

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-black items-center justify-center px-8">
      <Image
        source={require("../assets/images/icon.png")}
        style={{ width: 160, height: 160 }}
        className="mb-8"
      />

      <Text className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
        Bienvenue sur Matilda
      </Text>

      <Text className="text-base text-gray-500 dark:text-gray-400 text-center mb-8 leading-6">
        Votre assistant IA personnel pour analyser et comprendre vos documents
        (PDF, Word), directement sur votre appareil.
      </Text>

      {dl.status === "idle" || dl.status === "error" ? (
        <View className="w-full items-center">
          <Text className="text-sm text-gray-400 dark:text-gray-500 text-center mb-6">
            Un petit téléchargement est nécessaire pour activer la recherche
            intelligente dans vos documents.
          </Text>
          <Text className="text-sm font-semibold text-orange-500 mb-6">
            Taille : 438 MB — Assurez-vous d'être connecté en Wi-Fi.
          </Text>

          <TouchableOpacity
            onPress={handleStart}
            disabled={starting}
            className="bg-emerald-600 py-3.5 px-10 rounded-xl mb-4 w-full items-center"
          >
            <Text className="text-white font-semibold text-base">
              {starting ? "Préparation..." : "Télécharger le modèle"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={handleSkip} className="py-2">
            <Text className="text-gray-400 text-sm">Passer pour l'instant</Text>
          </TouchableOpacity>

          {dl.status === "error" && (
            <Text className="text-red-500 text-sm mt-4 text-center">
              {dl.error}
            </Text>
          )}
        </View>
      ) : dl.status === "downloading" ? (
        <View className="w-full items-center">
          <Text className="text-sm text-gray-500 dark:text-gray-400 mb-3">
            Téléchargement en cours… {pct}%
          </Text>
          <View className="w-full h-3 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
            <View
              className="h-full bg-emerald-500 rounded-full"
              style={{ width: barWidth }}
            />
          </View>
          <Text className="text-xs text-gray-400 mt-4 text-center">
            Ne quittez pas l'application pendant le téléchargement.
          </Text>
        </View>
      ) : dl.status === "done" ? (
        <View className="w-full items-center">
          <Text className="text-emerald-500 text-lg font-semibold mb-2">
            ✓ Prêt !
          </Text>
          <Text className="text-gray-500 text-center">
            Le modèle est installé. Vous pouvez maintenant importer des documents
            et poser des questions.
          </Text>
        </View>
      ) : dl.status === "skipped" ? (
        <View className="w-full items-center">
          <Text className="text-gray-500 text-center">
            Vous pourrez télécharger le modèle plus tard depuis les paramètres.
          </Text>
        </View>
      ) : null}
    </SafeAreaView>
  );
}
