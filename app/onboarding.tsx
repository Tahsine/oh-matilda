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
    <SafeAreaView className="flex-1 bg-bg items-center justify-center px-8">
      <Image
        source={require("../assets/images/icon.png")}
        style={{ width: 160, height: 160 }}
        className="mb-8"
      />

      <Text className="text-2xl font-bold text-text-primary mb-2">
        Bienvenue sur Matilda
      </Text>

      <Text className="text-base text-text-secondary text-center mb-8 leading-6">
        Votre assistant IA personnel pour analyser et comprendre vos documents
        (PDF, Word), directement sur votre appareil.
      </Text>

      {dl.status === "idle" || dl.status === "error" ? (
        <View className="w-full items-center">
          <Text className="text-sm text-text-muted text-center mb-6">
            Un petit téléchargement est nécessaire pour activer la recherche
            intelligente dans vos documents.
          </Text>
          <Text className="text-sm font-semibold text-warning mb-6">
            Taille : 438 MB — Assurez-vous d'être connecté en Wi-Fi.
          </Text>

          <TouchableOpacity
            onPress={handleStart}
            disabled={starting}
            className="bg-primary py-3.5 px-10 rounded-xl mb-4 w-full items-center"
          >
            <Text className="text-white font-semibold text-base">
              {starting ? "Préparation..." : "Télécharger le modèle"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={handleSkip} className="py-2">
            <Text className="text-text-muted text-sm">Passer pour l'instant</Text>
          </TouchableOpacity>

          {dl.status === "error" && (
            <Text className="text-danger text-sm mt-4 text-center">
              {dl.error}
            </Text>
          )}
        </View>
      ) : dl.status === "downloading" ? (
        <View className="w-full items-center">
          <Text className="text-sm text-text-muted mb-3">
            Téléchargement en cours… {pct}%
          </Text>
          <View className="w-full h-3 bg-surface rounded-full overflow-hidden">
            <View
              className="h-full bg-primary rounded-full"
              style={{ width: barWidth }}
            />
          </View>
          <Text className="text-xs text-text-muted mt-4 text-center">
            Ne quittez pas l'application pendant le téléchargement.
          </Text>
        </View>
      ) : dl.status === "done" ? (
        <View className="w-full items-center">
          <Text className="text-primary text-lg font-semibold mb-2">
            ✓ Prêt !
          </Text>
          <Text className="text-text-muted text-center">
            Le modèle est installé. Vous pouvez maintenant importer des documents
            et poser des questions.
          </Text>
        </View>
      ) : dl.status === "skipped" ? (
        <View className="w-full items-center">
          <Text className="text-text-muted text-center">
            Vous pourrez télécharger le modèle plus tard depuis les paramètres.
          </Text>
        </View>
      ) : null}
    </SafeAreaView>
  );
}
