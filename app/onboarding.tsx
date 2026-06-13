import { Feather } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  Modal,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  isGemma4Ready,
  isModelReady,
  isMmprojReady,
  onDownloadState,
  onGemma4DownloadState,
  retryDownload,
  retryGemma4Download,
  skipDownload,
  skipGemma4Download,
  startDownload,
  startGemma4Download,
  type DownloadState,
} from '../lib/models';
import { prepareEmbedding } from '../lib/provider';
import {
  fetchModels,
  getAdapter,
  saveProviderConfig,
} from '../lib/providers/registry';
import type { ProviderName } from '../lib/providers/types';
import { setSetting } from '../lib/settings';
import { useTokens } from '../lib/theme-tokens';

const PROVIDERS: {
  name: ProviderName;
  label: string;
  icon: keyof typeof Feather.glyphMap;
  desc: string;
}[] = [
  {
    name: 'ollama-cloud',
    label: 'Ollama Cloud',
    icon: 'cloud',
    desc: 'Hébergé par Ollama. Clé API requise.',
  },
  {
    name: 'ollama-hosted',
    label: 'Auto-hébergé',
    icon: 'server',
    desc: 'Votre propre serveur Ollama.',
  },
  {
    name: 'llama-local',
    label: 'Sur l\'appareil',
    icon: 'smartphone',
    desc: 'Gemma 4 E2B en local. ~3.2 GB à télécharger.',
  },
];

type Step = 'provider' | 'config' | 'download' | 'ready';

export default function OnboardingScreen({
  onComplete,
}: {
  onComplete: () => void;
}) {
  const t = useTokens();

  const [step, setStep] = useState<Step>('provider');
  const [selectedProvider, setSelectedProvider] =
    useState<ProviderName>('ollama-cloud');

  // Config state
  const [apiKey, setApiKey] = useState('');
  const [serverUrl, setServerUrl] = useState('http://localhost:8080');
  const [activeModel, setActiveModel] = useState('');
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [loadingModels, setLoadingModels] = useState(false);

  // Download state
  const [bgeM3State, setBgeM3State] = useState<DownloadState>({
    status: 'idle',
    progress: 0,
    path: null,
  });
  const [gemma4State, setGemma4State] = useState<DownloadState>({
    status: 'idle',
    progress: 0,
    path: null,
  });
  const [gemma4Ready, setGemma4Ready] = useState(false);

  const isLocal = selectedProvider === 'llama-local';

  // Subscribe to download state changes
  useEffect(() => {
    const unsub1 = onDownloadState(setBgeM3State);
    const unsub2 = onGemma4DownloadState(setGemma4State);
    return () => {
      unsub1();
      unsub2();
    };
  }, []);

  // Determine if we can proceed from download step
  const bgeM3Done =
    bgeM3State.status === 'done' ||
    bgeM3State.status === 'skipped';
  const gemma4Done =
    gemma4State.status === 'done' ||
    gemma4State.status === 'skipped';
  const downloadDone = bgeM3Done && (!isLocal || gemma4Done);

  // When download step completes, wait a beat then go to ready
  useEffect(() => {
    if (step === 'download' && downloadDone) {
      if (isLocal) {
        setSetting('onboarded', 'true');
        prepareEmbedding();
        const timer = setTimeout(() => onComplete(), 600);
        return () => clearTimeout(timer);
      } else {
        setStep('ready');
      }
    }
  }, [step, downloadDone, isLocal, onComplete]);

  const handleSelectProvider = (name: ProviderName) => {
    setSelectedProvider(name);
    const adapter = getAdapter(name);
    setActiveModel(adapter.defaultModel);
  };

  const handleConfigContinue = () => {
    saveProviderConfig({
      provider: selectedProvider,
      apiKey: selectedProvider === 'ollama-cloud' ? apiKey : undefined,
      baseUrl: selectedProvider === 'ollama-hosted' ? serverUrl : undefined,
      activeModel,
    });
    if (isLocal) {
      setStep('download');
      startDownload();
    } else {
      setStep('download');
      startDownload();
    }
  };

  const handleFetchModels = async () => {
    setLoadingModels(true);
    try {
      const models = await fetchModels(selectedProvider);
      setAvailableModels(models);
      setShowModelPicker(true);
    } catch {
      Alert.alert('Erreur', 'Impossible de charger les modèles.');
    } finally {
      setLoadingModels(false);
    }
  };

  const handleSelectModel = (modelId: string) => {
    setActiveModel(modelId);
    setShowModelPicker(false);
  };

  const handleSkipBGE = () => {
    skipDownload();
  };

  const handleSkipGemma4 = () => {
    skipGemma4Download();
  };

  const handleReadyContinue = () => {
    setSetting('onboarded', 'true');
    prepareEmbedding();
    onComplete();
  };

  // Step 3: detect when BGE-M3 done → start Gemma 4 if local
  useEffect(() => {
    if (step === 'download' && isLocal && bgeM3Done && gemma4State.status === 'idle') {
      startGemma4Download();
    }
  }, [step, isLocal, bgeM3Done, gemma4State.status]);

  const providerIcon = useMemo(
    () => PROVIDERS.find((p) => p.name === selectedProvider)?.icon ?? 'cloud',
    [selectedProvider],
  );

  return (
    <SafeAreaView className="flex-1 bg-bg items-center justify-center px-8">
      {/* ── Model Picker Modal ── */}
      <Modal visible={showModelPicker} transparent animationType="fade">
        <TouchableOpacity
          className="flex-1 bg-overlay justify-center px-6"
          activeOpacity={1}
          onPress={() => setShowModelPicker(false)}
        >
          <View className="bg-surface rounded-2xl overflow-hidden max-h-[60%]">
            <Text className="text-text-primary text-lg font-semibold text-center py-4 border-b border-border">
              Choisir un modèle
            </Text>
            <ScrollView>
              {availableModels.map((m, i) => (
                <TouchableOpacity
                  key={m}
                  onPress={() => handleSelectModel(m)}
                  className={`flex-row items-center justify-between px-5 py-4 ${activeModel === m ? 'bg-primary/20' : ''} ${i < availableModels.length - 1 ? 'border-b border-border' : ''}`}
                >
                  <Text className="text-text-primary text-base">{m}</Text>
                  {activeModel === m && (
                    <Feather name="check" size={18} color={t.info} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── Step 1: Provider ── */}
      {step === 'provider' && (
        <>
          <Image
            source={require('../assets/images/icon.png')}
            style={{ width: 120, height: 120 }}
            className="mb-6"
          />
          <Text className="text-2xl font-bold text-text-primary mb-2">
            Bienvenue sur Matilda
          </Text>
          <Text className="text-base text-text-secondary text-center mb-8 leading-6">
            Choisissez votre mode de fonctionnement
          </Text>

          <View className="w-full gap-3 mb-8">
            {PROVIDERS.map((p) => {
              const active = selectedProvider === p.name;
              return (
                <TouchableOpacity
                  key={p.name}
                  onPress={() => handleSelectProvider(p.name)}
                  className={`flex-row items-center gap-4 p-4 rounded-xl border-2 ${
                    active
                      ? 'border-primary bg-primary/10'
                      : 'border-border bg-surface'
                  }`}
                >
                  <View
                    className={`w-10 h-10 rounded-full items-center justify-center ${
                      active ? 'bg-primary' : 'bg-surface-hover'
                    }`}
                  >
                    <Feather
                      name={p.icon}
                      size={20}
                      color={active ? '#FFFFFF' : t.icon}
                    />
                  </View>
                  <View className="flex-1">
                    <Text
                      className={`text-base font-semibold ${
                        active ? 'text-primary' : 'text-text-primary'
                      }`}
                    >
                      {p.label}
                    </Text>
                    <Text className="text-sm text-text-muted">{p.desc}</Text>
                  </View>
                  {active && (
                    <Feather name="check-circle" size={20} color={t.primary} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity
            onPress={() => setStep('config')}
            className="bg-primary py-3.5 px-10 rounded-xl w-full items-center"
          >
            <Text className="text-white font-semibold text-base">
              Continuer
            </Text>
          </TouchableOpacity>
        </>
      )}

      {/* ── Step 2: Config ── */}
      {step === 'config' && (
        <>
          <View className="w-14 h-14 rounded-full bg-primary/20 items-center justify-center mb-4">
            <Feather name={providerIcon} size={28} color={t.primary} />
          </View>
          <Text className="text-xl font-bold text-text-primary mb-6">
            Configuration{' '}
            {PROVIDERS.find((p) => p.name === selectedProvider)?.label}
          </Text>

          {selectedProvider === 'ollama-cloud' && (
            <View className="w-full mb-6">
              <Text className="text-sm text-text-secondary mb-2">
                Clé API Ollama
              </Text>
              <TextInput
                value={apiKey}
                onChangeText={setApiKey}
                placeholder="sk-..."
                placeholderTextColor="#525252"
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                className="text-text-primary text-base bg-surface rounded-xl px-4 py-3.5 mb-3"
              />
              <Text className="text-sm text-text-muted mb-4">
                Obtenez votre clé sur{' '}
                <Text className="text-link">ollama.com/settings/keys</Text>
              </Text>
              <TouchableOpacity
                onPress={handleFetchModels}
                disabled={loadingModels}
                className="bg-surface-hover py-3 rounded-xl items-center"
              >
                <Text className="text-text-primary font-semibold">
                  {loadingModels
                    ? 'Chargement...'
                    : `Voir les modèles disponibles`}
                </Text>
              </TouchableOpacity>
              {activeModel ? (
                <Text className="text-sm text-text-muted text-center mt-2">
                  Modèle sélectionné : {activeModel}
                </Text>
              ) : null}
            </View>
          )}

          {selectedProvider === 'ollama-hosted' && (
            <View className="w-full mb-6">
              <Text className="text-sm text-text-secondary mb-2">
                URL du serveur Ollama
              </Text>
              <TextInput
                value={serverUrl}
                onChangeText={setServerUrl}
                placeholder="http://localhost:8080"
                placeholderTextColor="#525252"
                autoCapitalize="none"
                autoCorrect={false}
                className="text-text-primary text-base bg-surface rounded-xl px-4 py-3.5 mb-3"
              />
              <TouchableOpacity
                onPress={handleFetchModels}
                disabled={loadingModels}
                className="bg-surface-hover py-3 rounded-xl items-center"
              >
                <Text className="text-text-primary font-semibold">
                  {loadingModels
                    ? 'Chargement...'
                    : 'Voir les modèles disponibles'}
                </Text>
              </TouchableOpacity>
              {activeModel ? (
                <Text className="text-sm text-text-muted text-center mt-2">
                  Modèle sélectionné : {activeModel}
                </Text>
              ) : null}
            </View>
          )}

          {isLocal && (
            <View className="w-full mb-6">
              <View className="bg-surface rounded-xl p-5">
                <Text className="text-text-primary font-semibold mb-2">
                  Gemma 4 E2B
                </Text>
                <Text className="text-sm text-text-secondary leading-5 mb-3">
                  Modèle de dernière génération optimisé pour les appareils
                  mobiles. Fonctionne entièrement hors-ligne.
                </Text>
                <View className="flex-row items-center gap-2 mb-1">
                  <Feather name="database" size={14} color={t.icon} />
                  <Text className="text-sm text-text-muted">
                    Modèle principal : 2.19 GB
                  </Text>
                </View>
                <View className="flex-row items-center gap-2">
                  <Feather name="database" size={14} color={t.icon} />
                  <Text className="text-sm text-text-muted">
                    Vision (mmproj) : 986 MB
                  </Text>
                </View>
              </View>
            </View>
          )}

          <TouchableOpacity
            onPress={handleConfigContinue}
            className="bg-primary py-3.5 px-10 rounded-xl w-full items-center"
          >
            <Text className="text-white font-semibold text-base">
              Continuer
            </Text>
          </TouchableOpacity>
        </>
      )}

      {/* ── Step 3: Download ── */}
      {step === 'download' && (
        <>
          <View className="w-14 h-14 rounded-full bg-primary/20 items-center justify-center mb-4">
            <Feather name="download" size={28} color={t.primary} />
          </View>
          <Text className="text-xl font-bold text-text-primary mb-6">
            Téléchargement des modèles
          </Text>

          {/* BGE-M3 */}
          <View className="w-full mb-5">
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-sm font-semibold text-text-primary">
                BGE-M3 (Embedding)
              </Text>
              <Text className="text-xs text-text-muted">438 MB</Text>
            </View>
            <View className="w-full h-3 bg-surface rounded-full overflow-hidden">
              <View
                className="h-full bg-primary rounded-full"
                style={{
                  width: `${Math.max(bgeM3State.progress * 100, bgeM3State.status === 'downloading' ? 3 : bgeM3Done ? 100 : 0)}%`,
                }}
              />
            </View>
            <Text className="text-xs text-text-muted mt-1">
              {bgeM3State.status === 'idle'
                ? 'En attente...'
                : bgeM3State.status === 'downloading'
                  ? `${Math.round(bgeM3State.progress * 100)}%`
                  : bgeM3State.status === 'done'
                    ? '✓ Terminé'
                    : bgeM3State.status === 'skipped'
                      ? 'Passé'
                      : 'Erreur'}
            </Text>
            {bgeM3State.status === 'downloading' && (
              <TouchableOpacity onPress={handleSkipBGE} className="mt-2">
                <Text className="text-text-muted text-sm text-center">
                  Passer
                </Text>
              </TouchableOpacity>
            )}
            {bgeM3State.status === 'error' && (
              <>
                <Text className="text-danger text-sm mt-1">
                  {bgeM3State.error}
                </Text>
                <TouchableOpacity
                  onPress={retryDownload}
                  className="bg-danger py-2 rounded-xl items-center mt-2"
                >
                  <Text className="text-white font-semibold text-sm">
                    Réessayer
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>

          {/* Gemma 4 (local only) */}
          {isLocal && (
            <View className="w-full">
              <View className="flex-row items-center justify-between mb-2">
                <Text className="text-sm font-semibold text-text-primary">
                  Gemma 4 E2B (LLM)
                </Text>
                <Text className="text-xs text-text-muted">~3.2 GB</Text>
              </View>
              <View className="w-full h-3 bg-surface rounded-full overflow-hidden">
                <View
                  className="h-full bg-primary rounded-full"
                  style={{
                    width: `${Math.max(gemma4State.progress * 100, gemma4State.status === 'downloading' ? 3 : gemma4Done ? 100 : 0)}%`,
                  }}
                />
              </View>
              <Text className="text-xs text-text-muted mt-1">
                {gemma4State.status === 'idle'
                  ? bgeM3Done
                    ? 'Prêt...'
                    : 'En attente de BGE-M3...'
                  : gemma4State.status === 'downloading'
                    ? `${Math.round(gemma4State.progress * 100)}%`
                    : gemma4State.status === 'done'
                      ? '✓ Terminé'
                      : gemma4State.status === 'skipped'
                        ? 'Passé'
                        : 'Erreur'}
              </Text>
              {gemma4State.status === 'downloading' && (
                <TouchableOpacity onPress={handleSkipGemma4} className="mt-2">
                  <Text className="text-text-muted text-sm text-center">
                    Passer
                  </Text>
                </TouchableOpacity>
              )}
              {gemma4State.status === 'error' && (
                <>
                  <Text className="text-danger text-sm mt-1">
                    {gemma4State.error}
                  </Text>
                  <TouchableOpacity
                    onPress={retryGemma4Download}
                    className="bg-danger py-2 rounded-xl items-center mt-2"
                  >
                    <Text className="text-white font-semibold text-sm">
                      Réessayer
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          )}
        </>
      )}

      {/* ── Step 4: Ready ── */}
      {step === 'ready' && (
        <>
          <View className="w-16 h-16 rounded-full bg-primary/20 items-center justify-center mb-5">
            <Feather name="check" size={32} color={t.primary} />
          </View>
          <Text className="text-xl font-bold text-text-primary mb-2">
            Configuration terminée !
          </Text>
          <Text className="text-base text-text-secondary text-center mb-8 leading-6">
            Vous pouvez maintenant importer des documents et poser des
            questions.
          </Text>
          <TouchableOpacity
            onPress={handleReadyContinue}
            className="bg-primary py-3.5 px-10 rounded-xl w-full items-center"
          >
            <Text className="text-white font-semibold text-base">
              Commencer
            </Text>
          </TouchableOpacity>
        </>
      )}
    </SafeAreaView>
  );
}
