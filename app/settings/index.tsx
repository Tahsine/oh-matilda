import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { colorScheme } from 'nativewind';
import React, { useCallback, useState } from 'react';
import { Alert, Linking, Modal, ScrollView, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronValue } from '../../components/ui/ChevronValue';
import { DestructiveRow } from '../../components/ui/DestructiveRow';
import { Divider } from '../../components/ui/Divider';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { SectionHeader } from '../../components/ui/SectionHeader';
import { SettingsRow } from '../../components/ui/SettingsRow';
import { deleteAllConversations, getAllDocuments, deleteDocument } from '../../lib/db';
import { isModelReady } from '../../lib/models';
import { getProviderInfo } from '../../lib/provider';
import { getBoolean, getSetting, setBoolean, setSetting } from '../../lib/settings';
import { getAvailableProviders, getActiveProvider, saveProviderConfig, fetchModels, getAdapter } from '../../lib/providers/registry';
import type { ProviderName } from '../../lib/providers/types';

const THEME_OPTIONS = ['system', 'light', 'dark'] as const;
const THEME_LABELS: Record<string, string> = {
  system: 'Système',
  light: 'Clair',
  dark: 'Sombre',
};

const THEME_ICONS: Record<string, keyof typeof Feather.glyphMap> = {
  system: 'monitor',
  light: 'sun',
  dark: 'moon',
};

export default function SettingsScreen() {
  const [offline, setOffline] = useState(false);
  const [reasoning, setReasoning] = useState(false);
  const [memory, setMemory] = useState(true);
  const [temperature, setTemperature] = useState('1.0');
  const [serverUrl, setServerUrl] = useState('');
  const [embeddingReady, setEmbeddingReady] = useState(false);
  const [theme, setTheme] = useState('system');
  const [, forceUpdate] = useState(0);

  const [providerName, setProviderName] = useState('ollama-cloud');
  const [apiKey, setApiKey] = useState('');
  const [apiKeyFromSettings, setApiKeyFromSettings] = useState(false);
  const [activeModel, setActiveModel] = useState('');

  const [showProviderPicker, setShowProviderPicker] = useState(false);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);

  const { provider: providerLabel } = getProviderInfo();

  const load = useCallback(async () => {
    setOffline(getBoolean('offline_mode'));
    setReasoning(getBoolean('reasoning'));
    setMemory(getBoolean('memory'));
    setTemperature(getSetting('temperature'));
    setTheme(getSetting('theme'));
    setEmbeddingReady(await isModelReady());

    const config = getActiveProvider();
    setProviderName(config.provider);
    setApiKey(config.apiKey);
    const settingsKey = getSetting('api_key');
    setApiKeyFromSettings(!!settingsKey);
    setActiveModel(config.activeModel);
    setServerUrl(getSetting('server_url') || config.baseUrl);
  }, []);

  useFocusEffect(useCallback(() => { load(); return undefined; }, [load]));

  const cycleTheme = () => {
    const idx = THEME_OPTIONS.indexOf(theme as typeof THEME_OPTIONS[number]);
    const next = THEME_OPTIONS[(idx + 1) % THEME_OPTIONS.length];
    setTheme(next);
    setSetting('theme', next);
    colorScheme.set(next);
  };

  const handleClearCache = () => {
    Alert.alert(
      'Vider le cache',
      'Supprime tous les documents, chunks et embeddings. Les conversations sont conservées.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Vider',
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
      "Supprimer tout l'historique",
      'Toutes les conversations seront supprimées définitivement.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: () => {
            deleteAllConversations();
            forceUpdate(n => n + 1);
          },
        },
      ],
    );
  };

  const handleSelectProvider = (name: string) => {
    setProviderName(name);
    const adapter = getAdapter(name);
    saveProviderConfig({ provider: name as any, activeModel: adapter.defaultModel });
    setActiveModel(adapter.defaultModel);
    if (name !== 'ollama-cloud') {
      setShowApiKeyModal(true);
    }
    setShowProviderPicker(false);
    load();
  };

  const handleSaveApiKey = () => {
    saveProviderConfig({ apiKey });
    setShowApiKeyModal(false);
    load();
  };

  const handleFetchModels = async () => {
    setLoadingModels(true);
    try {
      const models = await fetchModels(providerName);
      setAvailableModels(models);
      setShowModelPicker(true);
    } catch {
      Alert.alert('Erreur', 'Impossible de charger les modèles.');
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
      <ScreenHeader title="Paramètres" />

      {/* Provider Picker Modal */}
      <Modal visible={showProviderPicker} transparent animationType="fade">
        <TouchableOpacity
          className="flex-1 bg-overlay justify-center px-6"
          activeOpacity={1}
          onPress={() => setShowProviderPicker(false)}
        >
          <View className="bg-surface rounded-2xl overflow-hidden">
            <Text className="text-text-primary text-lg font-semibold text-center py-4 border-b border-border">
              Choisir un provider
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
                  <Feather name="check" size={18} className="text-info" />
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
              Clé API
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
            <View className="flex-row gap-3">
              {apiKeyFromSettings ? (
                <TouchableOpacity
                  onPress={() => { setApiKey(''); setApiKeyFromSettings(false); saveProviderConfig({ apiKey: '' }); setShowApiKeyModal(false); load(); }}
                  className="py-3 px-4 rounded-xl bg-danger/20 items-center"
                >
                  <Text className="text-danger text-base">Supprimer</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity
                onPress={() => setShowApiKeyModal(false)}
                className="flex-1 py-3 rounded-xl bg-surface items-center"
              >
                <Text className="text-text-primary text-base">Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSaveApiKey}
                className="flex-1 py-3 rounded-xl bg-primary items-center"
              >
                <Text className="text-white text-base font-semibold">Sauvegarder</Text>
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
                    <Feather name="check" size={18} className="text-info" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      <ScrollView className="flex-1">
        <SectionHeader title="Modèle" />

        <View className="mx-4 rounded-xl overflow-hidden">
          <TouchableOpacity onPress={() => setShowProviderPicker(true)} activeOpacity={0.7}>
            <SettingsRow label="Provider" right={<ChevronValue value={providerLabel} />} />
          </TouchableOpacity>
          <Divider />
          <TouchableOpacity onPress={handleFetchModels} activeOpacity={0.7} disabled={loadingModels}>
            <SettingsRow
              label="Modèle actif"
              right={
                loadingModels ? (
                  <Text className="text-text-secondary text-sm">Chargement...</Text>
                ) : (
                  <ChevronValue value={activeModel} />
                )
              }
            />
          </TouchableOpacity>
          <Divider />
          <SettingsRow
            label="URL Serveur"
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
                  {serverUrl || 'N/A (non modifiable)'}
                </Text>
              )
            }
          />
          <Divider />
          <TouchableOpacity onPress={() => setShowApiKeyModal(true)} activeOpacity={0.7}>
            <SettingsRow
              label="Clé API"
              right={
                <Text className={`text-sm ${apiKeyFromSettings ? 'text-primary' : apiKey ? 'text-info' : 'text-warning'}`}>
                  {apiKeyFromSettings ? 'Configurée' : apiKey ? '.env' : 'Non définie'}
                </Text>
              }
            />
          </TouchableOpacity>
          <Divider />
          <SettingsRow
            label="Mode Offline"
            right={
              <Switch
                value={offline}
                onValueChange={(v) => { setOffline(v); setBoolean('offline_mode', v); }}
                trackColor={{ false: '#525252', true: '#22C55E' }}
                thumbColor="#fff"
              />
            }
          />
        </View>

        <SectionHeader title="Agent" />

        <View className="mx-4 rounded-xl overflow-hidden">
          <SettingsRow
            label="Température"
            right={<ChevronValue value={temperature} />}
          />
          <Divider />
          <SettingsRow
            label="Raisonnement"
            right={
              <Switch
                value={reasoning}
                onValueChange={(v) => { setReasoning(v); setBoolean('reasoning', v); }}
                trackColor={{ false: '#525252', true: '#22C55E' }}
                thumbColor="#fff"
              />
            }
          />
          <Divider />
          <SettingsRow
            label="Mémoire"
            right={
              <Switch
                value={memory}
                onValueChange={(v) => { setMemory(v); setBoolean('memory', v); }}
                trackColor={{ false: '#525252', true: '#22C55E' }}
                thumbColor="#fff"
              />
            }
          />
        </View>

        <SectionHeader title="Application" />

        <View className="mx-4 rounded-xl overflow-hidden">
          <TouchableOpacity onPress={cycleTheme} activeOpacity={0.7}>
            <View className="flex-row items-center justify-between px-4 py-3.5 bg-surface">
              <View className="flex-row items-center gap-3">
                <Feather name={THEME_ICONS[theme]} size={18} className="text-icon" />
                <Text className="text-text-primary text-base">Thème</Text>
              </View>
              <ChevronValue value={THEME_LABELS[theme]} />
            </View>
          </TouchableOpacity>
        </View>

        <SectionHeader title="Embedding" />

        <View className="mx-4 rounded-xl overflow-hidden">
          <SettingsRow
            label="Modèle"
            right={<ChevronValue value={getSetting('embedding_model')} />}
          />
          <Divider />
          <SettingsRow
            label="Statut"
            right={
              <Text className={embeddingReady ? 'text-primary text-base' : 'text-warning text-base'}>
                {embeddingReady ? 'Prêt' : 'Non téléchargé'}
              </Text>
            }
          />
        </View>

        <SectionHeader title="Données" />

        <View className="mx-4 rounded-xl overflow-hidden">
          <DestructiveRow icon="trash-2" label="Vider le cache" onPress={handleClearCache} />
          <Divider />
          <DestructiveRow icon="trash-2" label="Supprimer tout l'historique" onPress={handleDeleteHistory} />
        </View>

        <SectionHeader title="À Propos" />

        <View className="mx-4 rounded-xl overflow-hidden mb-8">
          <SettingsRow label="Version" right={<Text className="text-text-secondary text-base">0.1.0</Text>} />
          <Divider />
          <TouchableOpacity onPress={() => Linking.openURL('https://github.com/Tahsine/oh-matilda')} activeOpacity={0.7}>
            <SettingsRow
              label="GitHub"
              right={
                <View className="flex-row items-center gap-2">
                  <Feather name="github" size={18} className="text-icon" />
                  <Feather name="external-link" size={16} className="text-icon" />
                </View>
              }
            />
          </TouchableOpacity>
          <Divider />
          <SettingsRow label="Licence" right={<Text className="text-text-secondary text-base">MIT</Text>} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
