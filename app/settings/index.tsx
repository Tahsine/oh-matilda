import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { ScrollView, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type RowProps = {
  label: string;
  right?: React.ReactNode;
};

function Row({ label, right }: RowProps) {
  return (
    <View className="flex-row items-center justify-between px-4 py-3.5 bg-[#2A2A2A]">
      <Text className="text-white text-base">{label}</Text>
      {right}
    </View>
  );
}

function Divider() {
  return <View className="h-px bg-neutral-800 ml-4" />;
}

function SectionTitle({ title }: { title: string }) {
  return (
    <Text className="text-neutral-500 text-xs font-semibold tracking-wider uppercase px-4 pt-6 pb-2">
      {title}
    </Text>
  );
}

export default function SettingsScreen() {
  const router = useRouter();

  return (
    <SafeAreaView className="flex-1 bg-[#1E1E1E]">
      {/* Header */}
      <View className="flex-row items-center px-4 py-3 border-b border-neutral-800">
        <TouchableOpacity onPress={() => router.back()} className="mr-3">
          <Feather name="arrow-left" size={24} color="#D4D4D4" />
        </TouchableOpacity>
        <Text className="flex-1 text-center text-white text-lg font-semibold">Paramètres</Text>
        <View className="w-7" />
      </View>

      <ScrollView className="flex-1">
        {/* MODÈLE */}
        <SectionTitle title="Modèle" />

        <View className="mx-4 rounded-xl overflow-hidden">
          <Row label="Provider" right={<ChevronValue value="llama.cpp" />} />
          <Divider />
          <Row label="Modèle actif" right={<ChevronValue value="gemma-4-E4B" />} />
          <Divider />
          <Row
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
          <Row label="Mode Offline" right={<Switch value={true} onValueChange={() => {}} trackColor={{ false: '#525252', true: '#22C55E' }} thumbColor="#fff" />} />
        </View>

        {/* AGENT */}
        <SectionTitle title="Agent" />

        <View className="mx-4 rounded-xl overflow-hidden">
          <Row label="Température" right={<ChevronValue value="1.0" />} />
          <Divider />
          <Row label="Raisonnement" right={<Switch value={false} onValueChange={() => {}} trackColor={{ false: '#525252', true: '#22C55E' }} thumbColor="#fff" />} />
          <Divider />
          <Row label="Mémoire" right={<Switch value={true} onValueChange={() => {}} trackColor={{ false: '#525252', true: '#22C55E' }} thumbColor="#fff" />} />
        </View>

        {/* DONNÉES */}
        <SectionTitle title="Données" />

        <View className="mx-4 rounded-xl overflow-hidden">
          <DestructiveRow icon="trash-2" label="Vider le cache" />
          <Divider />
          <DestructiveRow icon="trash-2" label="Supprimer tout l'historique" />
        </View>

        {/* À PROPOS */}
        <SectionTitle title="À Propos" />

        <View className="mx-4 rounded-xl overflow-hidden mb-8">
          <Row label="Version" right={<Text className="text-neutral-400 text-base">0.1.0</Text>} />
          <Divider />
          <Row
            label="GitHub"
            right={
              <View className="flex-row items-center gap-2">
                <Feather name="github" size={18} color="#D4D4D4" />
                <Feather name="external-link" size={16} color="#D4D4D4" />
              </View>
            }
          />
          <Divider />
          <Row label="Licence" right={<Text className="text-neutral-400 text-base">MIT</Text>} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function ChevronValue({ value }: { value: string }) {
  return (
    <View className="flex-row items-center gap-1">
      <Text className="text-neutral-400 text-base">{value}</Text>
      <Feather name="chevron-right" size={18} color="#737373" />
    </View>
  );
}

function DestructiveRow({ icon, label }: { icon: keyof typeof Feather.glyphMap; label: string }) {
  return (
    <TouchableOpacity className="flex-row items-center justify-between px-4 py-3.5 bg-[#2A2A2A]">
      <View className="flex-row items-center gap-3">
        <Feather name={icon} size={18} color="#EF4444" />
        <Text className="text-red-500 text-base">{label}</Text>
      </View>
    </TouchableOpacity>
  );
}
