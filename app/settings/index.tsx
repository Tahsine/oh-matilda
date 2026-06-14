import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { colorScheme } from 'nativewind';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Linking, Modal, ScrollView, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronValue } from '../../components/ui/ChevronValue';
import { DestructiveRow } from '../../components/ui/DestructiveRow';
import { Divider } from '../../components/ui/Divider';
import { LoadingModal } from '../../components/ui/LoadingModal';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { SectionHeader } from '../../components/ui/SectionHeader';
import { SettingsRow } from '../../components/ui/SettingsRow';
import { showToast } from '../../components/ui/Toast';
import { deleteAllConversations, getAllDocuments, deleteDocument } from '../../lib/db';
import { isGemma4Ready, isModelReady, isMmprojReady, onGemma4DownloadState, startGemma4Download, type DownloadState } from '../../lib/models';
import { getProviderInfo, prepareLocalLLM, reloadLocalLLM, unloadLocalLLM } from '../../lib/provider';
import { getBoolean, getSetting, setBoolean, setSetting } from '../../lib/settings';
import { getAvailableProviders, getActiveProvider, saveProviderConfig, fetchModels, getAdapter } from '../../lib/providers/registry';
import type { ProviderName } from '../../lib/providers/types';
import { useTokens } from '../../lib/theme-tokens';

const THEME_OPTIONS = ['system', 'light', 'dark'] as const;

const THEME_ICONS: Record<string, keyof typeof Feather.glyphMap> = {
  system: 'monitor',
  light: 'sun',
  dark: 'moon',
};

export default function SettingsScreen() {
  const { t: tr, i18n } = useTranslation();
  const [offline, setOffline] = useState(false);
  const [reasoning, setReasoning] = useState(false);
  const [temperature, setTemperature] = useState('1.0');
  const [customPrompt, setCustomPrompt] = useState('');
  const [serverUrl, setServerUrl] = useState('');
  const [embeddingReady, setEmbeddingReady] = useState(false);
  const [theme, setTheme] = useState('system');
  const [, forceUpdate] = useState(0);
  const t = useTokens();
  const [showLanguagePicker, setShowLanguagePicker] = useState(false);

  const [providerName, setProviderName] = useState('ollama-cloud');
  const [apiKey, setApiKey] = useState('');
  const [apiKeyFromSettings, setApiKeyFromSettings] = useState(false);
  const [activeModel, setActiveModel] = useState('');

  const [showProviderPicker, setShowProviderPicker] = useState(false);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [showTavilyKeyModal, setShowTavilyKeyModal] = useState(false);
  const [tavilyApiKey, setTavilyApiKey] = useState('');
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);

  const { provider: providerLabel } = getProviderInfo();

  const [localLlmReady, setLocalLlmReady] = useState(false);
  const [gemma4Dl, setGemma4Dl] = useState<DownloadState>({ status: 'idle', progress: 0, path: null });
  const [downloadingLlm, setDownloadingLlm] = useState(false);
  const [llmNCtx, setLlmNCtx] = useState('4096');
  const [llmNGpuLayers, setLlmNGpuLayers] = useState('99');
  const [llmNBatch, setLlmNBatch] = useState('512');
  const [llmNThreads, setLlmNThreads] = useState('4');
  const [llmFlashAttn, setLlmFlashAttn] = useState(false);
  const [reloading, setReloading] = useState(false);
  const [preparingLocal, setPreparingLocal] = useState(false);

  const LANGUAGES = [
    { code: 'fr', label: 'Français' },
    { code: 'en', label: 'English' },
  ];
  const themeLabels: Record<string, string> = {
    system: tr('settings.themeSystem'),
    light: tr('settings.themeLight'),
    dark: tr('settings.themeDark'),
  };

  const load = useCallback(async () => {
    setOffline(getBoolean('offline_mode'));
    setReasoning(getBoolean('reasoning'));
    setTemperature(getSetting('temperature'));
    setCustomPrompt(getSetting('custom_prompt'));
    setTheme(getSetting('theme'));
    setEmbeddingReady(await isModelReady());
    setLlmNCtx(getSetting('llm_n_ctx'));
    setLlmNGpuLayers(getSetting('llm_n_gpu_layers'));
    setLlmNBatch(getSetting('llm_n_batch'));
    setLlmNThreads(getSetting('llm_n_threads'));
    setLlmFlashAttn(getBoolean('llm_flash_attn'));

    const config = getActiveProvider();
    setProviderName(config.provider);
    setApiKey(config.apiKey);
    const settingsKey = getSetting('api_key');
    setApiKeyFromSettings(!!settingsKey);
    setTavilyApiKey(getSetting('tavily_api_key'));
    setActiveModel(config.activeModel);
    setServerUrl(getSetting('server_url') || config.baseUrl);

    const g4 = await isGemma4Ready();
    const mp = await isMmprojReady();
    setLocalLlmReady(g4 && mp);
  }, []);

  useFocusEffect(useCallback(() => { load(); return undefined; }, [load]));

  useEffect(() => {
    const unsub = onGemma4DownloadState(setGemma4Dl);
    return unsub;
  }, []);

  useEffect(() => {
    if (gemma4Dl.status === 'done' || gemma4Dl.status === 'skipped') {
      setDownloadingLlm(false);
      setLocalLlmReady(gemma4Dl.status === 'done');
      if (gemma4Dl.status === 'done' && providerName === 'llama-local') {
        setPreparingLocal(true);
        prepareLocalLLM().finally(() => setPreparingLocal(false));
      }
    }
  }, [gemma4Dl, providerName]);

  const cycleTheme = () => {
    const idx = THEME_OPTIONS.indexOf(theme as typeof THEME_OPTIONS[number]);
    const next = THEME_OPTIONS[(idx + 1) % THEME_OPTIONS.length];
    setTheme(next);
    setSetting('theme', next);
    colorScheme.set(next);
  };

  const handleClearCache = () => {
    Alert.alert(
      tr('settings.clearCacheTitle'),
      tr('settings.clearCacheDesc'),
      [
        { text: tr('common.cancel'), style: 'cancel' },
        {
          text: tr('settings.clear'),
          style: 'destructive',
          onPress: () => {
            const docs = getAllDocuments();
            docs.forEach(d => deleteDocument(d.id));
            forceUpdate(n => n + 1);
            load();
          },
        },
      ],
    );
  };

  const handleDeleteHistory = () => {
    Alert.alert(
      tr('settings.deleteHistoryTitle'),
      tr('settings.deleteHistoryDesc'),
      [
        { text: tr('common.cancel'), style: 'cancel' },
        {
          text: tr('settings.delete'),
          style: 'destructive',
          onPress: () => {
            deleteAllConversations();
            forceUpdate(n => n + 1);
          },
        },
      ],
    );
  };

  const handleSelectProvider = async (name: string) => {
    const prevProvider = providerName;
    setProviderName(name);
    const adapter = getAdapter(name);
    saveProviderConfig({ provider: name as any, activeModel: adapter.defaultModel });
    setActiveModel(adapter.defaultModel);

    // Unload previous local model if switching away
    if (prevProvider === 'llama-local' && name !== 'llama-local') {
      await unloadLocalLLM();
    }

    // Prepare local model if switching to it
    if (name === 'llama-local' && name !== prevProvider) {
      setPreparingLocal(true);
      const ok = await prepareLocalLLM();
      setPreparingLocal(false);
      if (!ok) {
        Alert.alert(tr('common.error'), tr('settings.prepareLocalError'));
        saveProviderConfig({ provider: prevProvider as any, activeModel: getAdapter(prevProvider).defaultModel });
        setProviderName(prevProvider);
        setActiveModel(getAdapter(prevProvider).defaultModel);
      }
    }

    if (name === 'ollama-cloud') {
      setShowApiKeyModal(true);
    } else if (name === 'ollama-hosted') {
      setShowApiKeyModal(true);
    }
    setShowProviderPicker(false);
    load();
  };

  const handleDownloadLlm = async () => {
    setDownloadingLlm(true);
    await startGemma4Download();
  };

  const handleApplyLlmParams = async () => {
    setSetting('llm_n_ctx', llmNCtx);
    setSetting('llm_n_gpu_layers', llmNGpuLayers);
    setSetting('llm_n_batch', llmNBatch);
    setSetting('llm_n_threads', llmNThreads);
    setBoolean('llm_flash_attn', llmFlashAttn);
    setReloading(true);
    try {
      await reloadLocalLLM();
    } catch (err) {
      console.error('[settings] reloadLocalLLM error:', err);
    } finally {
      setReloading(false);
    }
  };

  const handleSaveApiKey = () => {
    saveProviderConfig({ apiKey });
    setShowApiKeyModal(false);
    load();
  };

  const handleSaveTavilyKey = () => {
    setSetting('tavily_api_key', tavilyApiKey);
    setShowTavilyKeyModal(false);
    showToast(tr('toast.tavilySaved'), tr('toast.tavilyKeySaved'));
    load();
  };

  const handleDeleteTavilyKey = () => {
    setSetting('tavily_api_key', '');
    setTavilyApiKey('');
    setShowTavilyKeyModal(false);
    load();
  };

  const handleFetchModels = async () => {
    setLoadingModels(true);
    try {
      const models = await fetchModels(providerName);
      setAvailableModels(models);
      setShowModelPicker(true);
    } catch {
      Alert.alert(tr('common.error'), tr('settings.loadModelsError'));
    } finally {
      setLoadingModels(false);
    }
  };

  const handleSelectModel = (modelId: string) => {
    saveProviderConfig({ activeModel: modelId });
    setActiveModel(modelId);
    setShowModelPicker(false);
    load();
  };

  const availableProviders = getAvailableProviders();

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <ScreenHeader title={tr('settings.title')} />

      {/* Provider Picker Modal */}
      <Modal visible={showProviderPicker} transparent animationType="fade">
        <TouchableOpacity
          className="flex-1 bg-overlay justify-center px-6"
          activeOpacity={1}
          onPress={() => setShowProviderPicker(false)}
        >
          <View className="bg-surface rounded-2xl overflow-hidden">
            <Text className="text-text-primary text-lg font-semibold text-center py-4 border-b border-border">
              {tr('settings.chooseProvider')}
            </Text>
            {availableProviders.map((p, i) => (
              <TouchableOpacity
                key={p.name}
                onPress={() => p.available && handleSelectProvider(p.name)}
                disabled={!p.available}
                className={`flex-row items-center justify-between px-5 py-4 ${providerName === p.name ? 'bg-primary/20' : ''} ${i < availableProviders.length - 1 ? 'border-b border-border' : ''}`}
              >
                <Text className={`text-base ${p.available ? 'text-text-primary' : 'text-text-muted'}`}>{p.label}</Text>
                {providerName === p.name && (
                    <Feather name="check" size={18} color={t.info} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* API Key Modal */}
      <Modal visible={showApiKeyModal} transparent animationType="fade">
        <TouchableOpacity
          className="flex-1 bg-overlay justify-center px-6"
          activeOpacity={1}
          onPress={() => setShowApiKeyModal(false)}
        >
          <View className="bg-surface rounded-2xl p-5">
            <Text className="text-text-primary text-lg font-semibold text-center mb-4">
              {tr('settings.apiKey')}
            </Text>
            <TextInput
              value={apiKey}
              onChangeText={setApiKey}
              placeholder="sk-..."
              placeholderTextColor="#525252"
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              className="text-text-primary text-base bg-bg rounded-xl px-4 py-3 mb-4"
            />
            <TouchableOpacity
              onPress={() => Linking.openURL('https://ollama.com/settings/keys')}
              className="mb-4 items-center"
            >
              <Text className="text-primary text-sm font-semibold">{tr('settings.getApiKeyLink')}</Text>
            </TouchableOpacity>
            <View className="flex-row gap-3">
              {apiKeyFromSettings ? (
                <TouchableOpacity
                  onPress={() => { setApiKey(''); setApiKeyFromSettings(false); saveProviderConfig({ apiKey: '' }); setShowApiKeyModal(false); load(); }}
                  className="py-3 px-4 rounded-xl bg-danger/20 items-center"
                >
                  <Text className="text-danger text-base">{tr('settings.delete')}</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity
                onPress={() => setShowApiKeyModal(false)}
                className="flex-1 py-3 rounded-xl bg-surface items-center"
              >
                <Text className="text-text-primary text-base">{tr('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSaveApiKey}
                className="flex-1 py-3 rounded-xl bg-primary items-center"
              >
                <Text className="text-white text-base font-semibold">{tr('common.save')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Tavily API Key Modal */}
      <Modal visible={showTavilyKeyModal} transparent animationType="fade">
        <TouchableOpacity
          className="flex-1 bg-overlay justify-center px-6"
          activeOpacity={1}
          onPress={() => setShowTavilyKeyModal(false)}
        >
          <View className="bg-surface rounded-2xl p-5">
            <Text className="text-text-primary text-lg font-semibold text-center mb-1">
              {tr('settings.tavilyKeyTitle')}
            </Text>
            <Text className="text-text-secondary text-sm text-center mb-4">
              {tr('settings.tavilyKeyDesc')}
            </Text>
            <TextInput
              value={tavilyApiKey}
              onChangeText={setTavilyApiKey}
              placeholder="tvly-..."
              placeholderTextColor="#525252"
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              className="text-text-primary text-base bg-bg rounded-xl px-4 py-3 mb-4"
            />
            <TouchableOpacity
              onPress={() => Linking.openURL('https://app.tavily.com/home')}
              className="mb-4 items-center"
            >
              <Text className="text-primary text-sm font-semibold">{tr('settings.getTavilyKeyLink')}</Text>
            </TouchableOpacity>
            <View className="flex-row gap-3">
              {tavilyApiKey ? (
                <TouchableOpacity
                  onPress={handleDeleteTavilyKey}
                  className="py-3 px-4 rounded-xl bg-danger/20 items-center"
                >
                  <Text className="text-danger text-base">{tr('settings.delete')}</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity
                onPress={() => setShowTavilyKeyModal(false)}
                className="flex-1 py-3 rounded-xl bg-surface items-center"
              >
                <Text className="text-text-primary text-base">{tr('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSaveTavilyKey}
                className="flex-1 py-3 rounded-xl bg-primary items-center"
              >
                <Text className="text-white text-base font-semibold">{tr('common.save')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Model Picker Modal */}
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

      <ScrollView className="flex-1">
        <SectionHeader title={tr('settings.sectionModel')} />

        <View className="mx-4 rounded-xl overflow-hidden">
          <TouchableOpacity onPress={() => setShowProviderPicker(true)} activeOpacity={0.7}>
            <SettingsRow label={tr('settings.provider')} right={<ChevronValue value={providerLabel} />} />
          </TouchableOpacity>
          <Divider />
          <TouchableOpacity onPress={handleFetchModels} activeOpacity={0.7} disabled={loadingModels}>
            <SettingsRow
              label={tr('settings.activeModel')}
              right={
                loadingModels ? (
                  <Text className="text-text-secondary text-sm">{tr('common.loading')}</Text>
                ) : (
                  <ChevronValue value={activeModel} />
                )
              }
            />
          </TouchableOpacity>
          <Divider />
          <SettingsRow
            label={tr('settings.serverUrl')}
            right={
              providerName === 'ollama-hosted' ? (
                <TextInput
                  value={serverUrl}
                  onChangeText={(v) => { setServerUrl(v); setSetting('server_url', v); }}
                  className="text-text-primary text-sm text-right flex-1 ml-4 bg-surface"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              ) : (
                <Text className="text-text-secondary text-sm text-right flex-1 ml-4">
                  {serverUrl || tr('settings.serverUrlNA')}
                </Text>
              )
            }
          />
          <Divider />
          <TouchableOpacity onPress={() => setShowApiKeyModal(true)} activeOpacity={0.7}>
            <SettingsRow
              label={tr('settings.apiKey')}
              right={
                <Text className={`text-sm ${apiKeyFromSettings ? 'text-primary' : apiKey ? 'text-info' : 'text-warning'}`}>
                  {apiKeyFromSettings ? tr('settings.configured') : apiKey ? '.env' : tr('settings.notSet')}
                </Text>
              }
            />
          </TouchableOpacity>
          <Divider />
          <TouchableOpacity onPress={() => setShowTavilyKeyModal(true)} activeOpacity={0.7}>
            <SettingsRow
              label={tr('settings.tavilyKey')}
              right={
                <Text className={`text-sm ${tavilyApiKey ? 'text-primary' : 'text-warning'}`}>
                  {tavilyApiKey ? tr('settings.configured') : tr('settings.notSet')}
                </Text>
              }
            />
          </TouchableOpacity>
          <Divider />
          <SettingsRow
            label={tr('settings.offlineMode')}
            right={
              <Switch
                value={offline}
                onValueChange={(v) => { setOffline(v); setBoolean('offline_mode', v); }}
                trackColor={{ false: '#525252', true: '#64748B' }}
                thumbColor="#fff"
              />
            }
          />
        </View>

        <SectionHeader title={tr('settings.sectionAgent')} />

        <View className="mx-4 rounded-xl overflow-hidden">
          <SettingsRow
            label={tr('settings.temperature')}
            right={<ChevronValue value={temperature} />}
          />
          {providerName === 'llama-local' && (
            <>
              <Divider />
              <SettingsRow
                label={tr('settings.reasoning')}
                right={
                  <Switch
                    value={reasoning}
                    onValueChange={(v) => { setReasoning(v); setBoolean('reasoning', v); }}
                    trackColor={{ false: '#525252', true: '#64748B' }}
                    thumbColor="#fff"
                  />
                }
              />
              <Divider />
            </>
          )}
          <View className="px-4 py-3.5 bg-surface">
            <Text className="text-text-primary text-base mb-2">{tr('settings.customInstructions')}</Text>
            <TextInput
              value={customPrompt}
              onChangeText={(v) => { setCustomPrompt(v); setSetting('custom_prompt', v); }}
              placeholder={tr('settings.customInstructionsPlaceholder')}
              placeholderTextColor={t.inputPlaceholder}
              multiline
              className="text-text-primary text-sm bg-bg rounded-xl px-3 py-2 min-h-[80px]"
              style={{ textAlignVertical: 'top' }}
            />
          </View>
        </View>

        <SectionHeader title={tr('settings.sectionApp')} />

        <View className="mx-4 rounded-xl overflow-hidden">
          <TouchableOpacity onPress={cycleTheme} activeOpacity={0.7}>
            <View className="flex-row items-center justify-between px-4 py-3.5 bg-surface">
              <View className="flex-row items-center gap-3">
                <Feather name={THEME_ICONS[theme]} size={18} color={t.icon} />
                <Text className="text-text-primary text-base">{tr('settings.theme')}</Text>
              </View>
              <ChevronValue value={themeLabels[theme]} />
            </View>
          </TouchableOpacity>
        </View>

        <View className="mx-4 rounded-xl overflow-hidden mt-4">
          <TouchableOpacity onPress={() => setShowLanguagePicker(true)} activeOpacity={0.7}>
            <View className="flex-row items-center justify-between px-4 py-3.5 bg-surface">
              <View className="flex-row items-center gap-3">
                <Feather name="globe" size={18} color={t.icon} />
                <Text className="text-text-primary text-base">{tr('settings.language')}</Text>
              </View>
              <ChevronValue value={LANGUAGES.find(l => l.code === i18n.language)?.label ?? LANGUAGES[0].label} />
            </View>
          </TouchableOpacity>
        </View>

        <Modal visible={showLanguagePicker} transparent animationType="fade">
          <TouchableOpacity
            className="flex-1 bg-overlay justify-center px-6"
            activeOpacity={1}
            onPress={() => setShowLanguagePicker(false)}
          >
            <View className="bg-surface rounded-2xl overflow-hidden">
              <Text className="text-text-primary text-lg font-semibold text-center py-4 border-b border-border">
                {tr('settings.chooseLanguage')}
              </Text>
              {LANGUAGES.map((lang, i) => (
                <TouchableOpacity
                  key={lang.code}
                  onPress={() => {
                    i18n.changeLanguage(lang.code);
                    setSetting('language', lang.code);
                    setShowLanguagePicker(false);
                  }}
                  className={`flex-row items-center justify-between px-5 py-4 ${i18n.language === lang.code ? 'bg-primary/20' : ''} ${i < LANGUAGES.length - 1 ? 'border-b border-border' : ''}`}
                >
                  <Text className="text-text-primary text-base">{lang.label}</Text>
                  {i18n.language === lang.code && (
                    <Feather name="check" size={18} color={t.info} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </TouchableOpacity>
        </Modal>

        <SectionHeader title={tr('settings.sectionEmbedding')} />

        <View className="mx-4 rounded-xl overflow-hidden">
          <SettingsRow
            label={tr('settings.model')}
            right={<ChevronValue value={getSetting('embedding_model')} />}
          />
          <Divider />
          <SettingsRow
            label={tr('settings.status')}
            right={
              <Text className={embeddingReady ? 'text-primary text-base' : 'text-warning text-base'}>
                {embeddingReady ? tr('settings.ready') : tr('settings.notDownloaded')}
              </Text>
            }
          />
        </View>

        {providerName === 'llama-local' && (
          <>
            <SectionHeader title={tr('settings.sectionLocalLLM')} />
            <View className="mx-4 rounded-xl overflow-hidden">
              <SettingsRow
                label={tr('settings.status')}
                right={
                  <Text className={localLlmReady ? 'text-primary text-base' : 'text-warning text-base'}>
                    {localLlmReady ? tr('settings.ready') : tr('settings.notDownloaded')}
                  </Text>
                }
              />
              {!localLlmReady && (
                <>
                  <Divider />
                  <TouchableOpacity
                    onPress={handleDownloadLlm}
                    disabled={downloadingLlm}
                    activeOpacity={0.7}
                  >
                    <SettingsRow
                      label={downloadingLlm ? tr('settings.downloading') : tr('settings.downloadGemma')}
                      right={
                        downloadingLlm ? (
                          <Text className="text-text-muted text-sm">
                            {Math.round(gemma4Dl.progress * 100)}%
                          </Text>
                        ) : (
                          <Feather name="download" size={18} color={t.icon} />
                        )
                      }
                    />
                  </TouchableOpacity>
                </>
              )}
            </View>

            {localLlmReady && (
              <>
                <SectionHeader title={tr('settings.sectionLLMParams')} />
                <View className="mx-4 rounded-xl overflow-hidden">
                  <View className="px-4 py-2 bg-warning/10">
                    <Text className="text-warning text-xs">
                      {tr('settings.llmParamsWarning')}
                    </Text>
                  </View>
                  <View className="flex-row items-center justify-between px-4 py-3.5 bg-surface">
                    <Text className="text-text-primary text-base">{tr('settings.llmContext')}</Text>
                    <TextInput
                      value={llmNCtx}
                      onChangeText={setLlmNCtx}
                      keyboardType="number-pad"
                      className="text-text-primary text-sm text-right w-24 bg-bg rounded-xl px-3 py-1"
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>
                  <Divider />
                  <View className="flex-row items-center justify-between px-4 py-3.5 bg-surface">
                    <Text className="text-text-primary text-base">{tr('settings.llmGpuLayers')}</Text>
                    <TextInput
                      value={llmNGpuLayers}
                      onChangeText={setLlmNGpuLayers}
                      keyboardType="number-pad"
                      className="text-text-primary text-sm text-right w-24 bg-bg rounded-xl px-3 py-1"
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>
                  <Divider />
                  <View className="flex-row items-center justify-between px-4 py-3.5 bg-surface">
                    <Text className="text-text-primary text-base">{tr('settings.llmBatch')}</Text>
                    <TextInput
                      value={llmNBatch}
                      onChangeText={setLlmNBatch}
                      keyboardType="number-pad"
                      className="text-text-primary text-sm text-right w-24 bg-bg rounded-xl px-3 py-1"
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>
                  <Divider />
                  <View className="flex-row items-center justify-between px-4 py-3.5 bg-surface">
                    <Text className="text-text-primary text-base">{tr('settings.llmThreads')}</Text>
                    <TextInput
                      value={llmNThreads}
                      onChangeText={setLlmNThreads}
                      keyboardType="number-pad"
                      className="text-text-primary text-sm text-right w-24 bg-bg rounded-xl px-3 py-1"
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>
                  <Divider />
                  <SettingsRow
                    label={tr('settings.llmFlashAttention')}
                    right={
                      <Switch
                        value={llmFlashAttn}
                        onValueChange={setLlmFlashAttn}
                        trackColor={{ false: '#525252', true: '#64748B' }}
                        thumbColor="#fff"
                      />
                    }
                  />
                  <TouchableOpacity onPress={handleApplyLlmParams} disabled={reloading} activeOpacity={0.7}>
                    <View className="bg-primary py-3.5 items-center">
                      <Text className="text-white text-base font-semibold">
                        {reloading ? tr('settings.applying') : tr('settings.apply')}
                      </Text>
                    </View>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </>
        )}

        <SectionHeader title={tr('settings.sectionData')} />

        <View className="mx-4 rounded-xl overflow-hidden">
          <DestructiveRow icon="trash-2" label={tr('settings.clearCache')} onPress={handleClearCache} />
          <Divider />
          <DestructiveRow icon="trash-2" label={tr('settings.deleteAllHistory')} onPress={handleDeleteHistory} />
        </View>

        <SectionHeader title={tr('settings.sectionAbout')} />

        <View className="mx-4 rounded-xl overflow-hidden mb-8">
          <SettingsRow label={tr('settings.version')} right={<Text className="text-text-secondary text-base">0.1.0</Text>} />
          <Divider />
          <TouchableOpacity onPress={() => Linking.openURL('https://github.com/Tahsine/oh-matilda')} activeOpacity={0.7}>
            <SettingsRow
              label={tr('settings.github')}
              right={
                <View className="flex-row items-center gap-2">
                  <Feather name="github" size={18} color={t.icon} />
                  <Feather name="external-link" size={16} color={t.icon} />
                </View>
              }
            />
          </TouchableOpacity>
          <Divider />
          <SettingsRow label={tr('settings.license')} right={<Text className="text-text-secondary text-base">MIT</Text>} />
        </View>

        {(reloading || preparingLocal) && (
          <LoadingModal
            visible
            message={reloading ? tr('settings.reloadingModel') : tr('settings.preparingLocal')}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
