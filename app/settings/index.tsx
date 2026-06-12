import { Feather } from '@expo/vector-icons';
import React from 'react';
import { ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronValue } from '../../components/ui/ChevronValue';
import { DestructiveRow } from '../../components/ui/DestructiveRow';
import { Divider } from '../../components/ui/Divider';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { SectionHeader } from '../../components/ui/SectionHeader';
import { SettingsRow } from '../../components/ui/SettingsRow';

export default function SettingsScreen() {
  return (
    <SafeAreaView className="flex-1 bg-[#1E1E1E]">
      <ScreenHeader title="Paramètres" />

      <ScrollView className="flex-1">
        <SectionHeader title="Modèle" />

        <View className="mx-4 rounded-xl overflow-hidden">
          <SettingsRow label="Provider" right={<ChevronValue value="llama.cpp" />} />
          <Divider />
          <SettingsRow label="Modèle actif" right={<ChevronValue value="gemma-4-E4B" />} />
          <Divider />
          <SettingsRow
            label="URL Serveur"
            right={
              <TextInput
                value="http://localhost:8080"
                className="text-white text-sm text-right flex-1 ml-4"
                style={{ backgroundColor: '#2A2A2A' }}
              />
            }
          />
          <Divider />
          <SettingsRow
            label="Mode Offline"
            right={<Switch value={true} onValueChange={() => {}} trackColor={{ false: '#525252', true: '#22C55E' }} thumbColor="#fff" />}
          />
        </View>

        <SectionHeader title="Agent" />

        <View className="mx-4 rounded-xl overflow-hidden">
          <SettingsRow label="Température" right={<ChevronValue value="1.0" />} />
          <Divider />
          <SettingsRow
            label="Raisonnement"
            right={<Switch value={false} onValueChange={() => {}} trackColor={{ false: '#525252', true: '#22C55E' }} thumbColor="#fff" />}
          />
          <Divider />
          <SettingsRow
            label="Mémoire"
            right={<Switch value={true} onValueChange={() => {}} trackColor={{ false: '#525252', true: '#22C55E' }} thumbColor="#fff" />}
          />
        </View>

        <SectionHeader title="Embedding" />

        <View className="mx-4 rounded-xl overflow-hidden">
          <SettingsRow
            label="Modèle BGE-M3"
            right={<ChevronValue value="Q4_K_M (438 MB)" />}
          />
        </View>

        <SectionHeader title="Données" />

        <View className="mx-4 rounded-xl overflow-hidden">
          <DestructiveRow icon="trash-2" label="Vider le cache" />
          <Divider />
          <DestructiveRow icon="trash-2" label="Supprimer tout l'historique" />
        </View>

        <SectionHeader title="À Propos" />

        <View className="mx-4 rounded-xl overflow-hidden mb-8">
          <SettingsRow label="Version" right={<Text className="text-neutral-400 text-base">0.1.0</Text>} />
          <Divider />
          <SettingsRow
            label="GitHub"
            right={
              <View className="flex-row items-center gap-2">
                <Feather name="github" size={18} color="#D4D4D4" />
                <Feather name="external-link" size={16} color="#D4D4D4" />
              </View>
            }
          />
          <Divider />
          <SettingsRow label="Licence" right={<Text className="text-neutral-400 text-base">MIT</Text>} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
