import { Feather } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Image,
  Linking,
  Modal,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  onDownloadState,
  onGemma4DownloadState,
  retryDownload,
  retryGemma4Download,
  skipDownload,
  skipGemma4Download,
  startDownload,
  startGemma4Download,
  type DownloadState
} from '../lib/models';
import { prepareEmbedding, prepareLocalLLM } from '../lib/provider';
import {
  fetchModels,
  getAdapter,
  isGpuSupported,
  saveProviderConfig,
} from '../lib/providers/registry';
import type { ProviderName } from '../lib/providers/types';
import { setSetting } from '../lib/settings';
import { useTokens } from '../lib/theme-tokens';

function getProviders(t: (key: string) => string): {
  name: ProviderName;
  label: string;
  icon: keyof typeof Feather.glyphMap;
  desc: string;
  available: boolean;
  reason?: string;
}[] {
  const gpuOk = isGpuSupported();
  return [
    {
      name: 'ollama-cloud',
      label: t('onboarding.provider.ollamaCloud'),
      icon: 'cloud',
      desc: t('onboarding.provider.ollamaCloudDesc'),
      available: true,
    },
    {
      name: 'self-hosted',
      label: t('onboarding.provider.selfHosted'),
      icon: 'server',
      desc: t('onboarding.provider.selfHostedDesc'),
      available: true,
    },
    {
      name: 'llama-local',
      label: t('onboarding.provider.onDevice'),
      icon: 'smartphone',
      desc: t('onboarding.provider.onDeviceDesc'),
      available: gpuOk,
      reason: gpuOk ? undefined : t('onboarding.provider.gpuUnsupported'),
    },
  ];
}

type Step = 'provider' | 'config' | 'download' | 'ready';

export default function OnboardingScreen({
  onComplete,
}: {
  onComplete: () => void;
}) {
  const { t: tr } = useTranslation();
  const PROVIDERS = useMemo(() => getProviders(tr), [tr]);
  const t = useTokens();

  const [step, setStep] = useState<Step>('provider');
  const [selectedProvider, setSelectedProvider] =
    useState<ProviderName>('ollama-cloud');

  // Config state
  const [apiKey, setApiKey] = useState('');
  const [serverUrl, setServerUrl] = useState('http://192.168.1.100:11434');
  const [activeModel, setActiveModel] = useState(getAdapter('ollama-cloud').defaultModel);
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

  // When download step completes, prepare models then transition
  useEffect(() => {
    if (step === 'download' && downloadDone) {
      if (isLocal) {
        (async () => {
          setSetting('onboarded', 'true');
          await Promise.all([prepareEmbedding(), prepareLocalLLM()]);
          onComplete();
        })();
      } else {
        setStep('ready');
      }
    }
  }, [step, downloadDone, isLocal, onComplete]);

  const handleSelectProvider = (name: ProviderName) => {
    const p = PROVIDERS.find(x => x.name === name);
    if (p && !p.available) return;
    setSelectedProvider(name);
    const adapter = getAdapter(name);
    setActiveModel(adapter.defaultModel);
  };

  const handleConfigContinue = () => {
    saveProviderConfig({
      provider: selectedProvider,
      apiKey: selectedProvider === 'ollama-cloud' ? apiKey : undefined,
      baseUrl: selectedProvider === 'self-hosted' ? serverUrl : undefined,
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
      Alert.alert(tr('common.error'), tr('errors.cannotLoadModels'));
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
              {tr('settings.chooseModel')}
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
            {tr('onboarding.welcome.title')}
          </Text>
          <Text className="text-base text-text-secondary text-center mb-4 leading-6">
            {tr('onboarding.welcome.subtitle')}
          </Text>

          <View className="w-full gap-3 mb-4">
            {PROVIDERS.map((p) => {
              const active = selectedProvider === p.name;
              return (
                <TouchableOpacity
                  key={p.name}
                  onPress={() => handleSelectProvider(p.name)}
                  disabled={!p.available}
                  className={`flex-row items-center gap-4 p-4 rounded-xl border-2 ${
                    active
                      ? 'border-primary bg-primary/10'
                      : 'border-border bg-surface'
                  } ${!p.available ? 'opacity-50' : ''}`}
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
                    {!p.available && p.reason && (
                      <View className="bg-warning/20 self-start rounded-full px-2.5 py-0.5 mt-1">
                        <Text className="text-xs text-warning font-medium">{p.reason}</Text>
                      </View>
                    )}
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
              {tr('common.continue')}
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
            {tr('onboarding.config.title', { provider: PROVIDERS.find((p) => p.name === selectedProvider)?.label })}
          </Text>

          {selectedProvider === 'ollama-cloud' && (
            <View className="w-full mb-6">
              <Text className="text-sm text-text-secondary mb-2">
                {tr('onboarding.config.apiKeyLabel')}
              </Text>
              <TextInput
                value={apiKey}
                onChangeText={setApiKey}
                placeholder={tr('onboarding.config.apiKeyPlaceholder')}
                placeholderTextColor="#525252"
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                className="text-text-primary text-base bg-surface rounded-xl px-4 py-3.5 mb-3"
              />
              <TouchableOpacity
                onPress={() => Linking.openURL('https://ollama.com/settings/keys')}
                className="mb-4"
              >
                <Text className="text-primary text-sm font-semibold">{tr('onboarding.config.apiKeyHint')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleFetchModels}
                disabled={loadingModels}
                className="bg-surface rounded-xl px-4 py-3.5 flex-row items-center justify-between"
              >
                <Text className="text-text-primary text-base font-medium">
                  {loadingModels ? tr('common.loading') : activeModel}
                </Text>
                <Feather name="chevron-down" size={18} color={t.icon} />
              </TouchableOpacity>
              <Text className="text-xs text-text-muted text-center mt-1.5">
                {tr('onboarding.config.modelSelectorHint')}
              </Text>
            </View>
          )}

          {selectedProvider === 'self-hosted' && (
            <View className="w-full mb-6">
              <Text className="text-sm text-text-secondary mb-2">
                {tr('onboarding.config.serverUrlLabel')}
              </Text>
              <TextInput
                value={serverUrl}
                onChangeText={setServerUrl}
                placeholder={tr('onboarding.config.serverUrlPlaceholder')}
                placeholderTextColor="#525252"
                autoCapitalize="none"
                autoCorrect={false}
                className="text-text-primary text-base bg-surface rounded-xl px-4 py-3.5 mb-3"
              />
              <TouchableOpacity
                onPress={handleFetchModels}
                disabled={loadingModels}
                className="bg-surface rounded-xl px-4 py-3.5 flex-row items-center justify-between"
              >
                <Text className="text-text-primary text-base font-medium">
                  {loadingModels ? tr('common.loading') : activeModel}
                </Text>
                <Feather name="chevron-down" size={18} color={t.icon} />
              </TouchableOpacity>
              <Text className="text-xs text-text-muted text-center mt-1.5">
                {tr('onboarding.config.modelSelectorHint')}
              </Text>
            </View>
          )}

          {isLocal && (
            <View className="w-full mb-6">
              <View className="bg-surface rounded-xl p-5">
                <Text className="text-text-primary font-semibold mb-2">
                  {tr('onboarding.config.gemma4Title')}
                </Text>
                <Text className="text-sm text-text-secondary leading-5 mb-3">
                  {tr('onboarding.config.gemma4Desc')}
                </Text>
                <View className="flex-row items-center gap-2 mb-1">
                  <Feather name="database" size={14} color={t.icon} />
                  <Text className="text-sm text-text-muted">
                    {tr('onboarding.config.modelSize')}
                  </Text>
                </View>
                <View className="flex-row items-center gap-2">
                  <Feather name="database" size={14} color={t.icon} />
                  <Text className="text-sm text-text-muted">
                    {tr('onboarding.config.visionSize')}
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
              {tr('common.continue')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setStep('provider')}
            className="py-3 px-10 w-full items-center"
          >
            <Text className="text-text-secondary text-sm font-medium">
              ← {tr('common.back')}
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
            {tr('onboarding.download.title')}
          </Text>

          {/* BGE-M3 */}
          <View className="w-full mb-5">
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-sm font-semibold text-text-primary">
                {tr('onboarding.download.bgem3')}
              </Text>
              <Text className="text-xs text-text-muted">{tr('onboarding.download.bgem3Size')}</Text>
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
                ? tr('onboarding.download.pending')
                : bgeM3State.status === 'downloading'
                  ? `${Math.round(bgeM3State.progress * 100)}%`
                  : bgeM3State.status === 'done'
                    ? tr('onboarding.download.completed')
                    : bgeM3State.status === 'skipped'
                      ? tr('onboarding.download.skipped')
                      : tr('onboarding.download.error')}
            </Text>
            {bgeM3State.status === 'downloading' && (
              <TouchableOpacity onPress={handleSkipBGE} className="mt-2">
                <Text className="text-text-muted text-sm text-center">
                  {tr('common.skip')}
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
                    {tr('common.retry')}
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
                  {tr('onboarding.download.gemma4')}
                </Text>
                <Text className="text-xs text-text-muted">{tr('onboarding.download.gemma4Size')}</Text>
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
                    ? tr('onboarding.download.ready')
                    : tr('onboarding.download.waiting')
                  : gemma4State.status === 'downloading'
                    ? `${Math.round(gemma4State.progress * 100)}%`
                    : gemma4State.status === 'done'
                      ? tr('onboarding.download.completed')
                      : gemma4State.status === 'skipped'
                        ? tr('onboarding.download.skipped')
                        : tr('onboarding.download.error')}
              </Text>
              {gemma4State.status === 'downloading' && (
                <TouchableOpacity onPress={handleSkipGemma4} className="mt-2">
                  <Text className="text-text-muted text-sm text-center">
                    {tr('common.skip')}
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
                      {tr('common.retry')}
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
            {tr('onboarding.ready.title')}
          </Text>
          <Text className="text-base text-text-secondary text-center mb-8 leading-6">
            {tr('onboarding.ready.description')}
          </Text>
          <TouchableOpacity
            onPress={handleReadyContinue}
            className="bg-primary py-3.5 px-10 rounded-xl w-full items-center"
          >
            <Text className="text-white font-semibold text-base">
              {tr('common.start')}
            </Text>
          </TouchableOpacity>
        </>
      )}
    </SafeAreaView>
  );
}
