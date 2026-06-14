import React from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Modal, Text, View } from 'react-native';
import { useTokens } from '../../lib/theme-tokens';

type LoadingModalProps = {
  visible: boolean;
  message?: string;
};

export function LoadingModal({ visible, message }: LoadingModalProps) {
  const { t: tr } = useTranslation();
  const resolvedMessage = message ?? tr('common.loading');
  const t = useTokens();
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View className="flex-1 bg-overlay items-center justify-center px-6">
        <View className="bg-surface rounded-2xl p-8 items-center gap-4">
          <ActivityIndicator size="large" color={t.primary} />
          <Text className="text-text-primary text-base text-center">{resolvedMessage}</Text>
        </View>
      </View>
    </Modal>
  );
}
