import { Feather, Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
import { Image, Keyboard, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { KeyboardStickyView } from 'react-native-keyboard-controller';
import { useTokens } from '../../lib/theme-tokens';

type ChatInputProps = {
  onSend: (text: string, image?: string) => void;
  streaming: boolean;
  onStop?: () => void;
  webSearch?: boolean;
  onToggleWebSearch?: () => void;
  editTarget?: { id: string; text: string } | null;
  onEdit?: (msgId: string, newText: string) => void;
  onCancelEdit?: () => void;
};

export function ChatInput({ onSend, streaming, onStop, webSearch = false, onToggleWebSearch, editTarget, onEdit, onCancelEdit }: ChatInputProps) {
  const [value, setValue] = useState(editTarget?.text ?? '');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const t = useTokens();
  const isEditing = !!editTarget;

  const handleSend = () => {
    const text = value.trim();
    if (!text && !selectedImage) return;
    if (streaming) return;
    Keyboard.dismiss();
    if (isEditing && editTarget) {
      onEdit?.(editTarget.id, text);
    } else {
      onSend(text, selectedImage ?? undefined);
    }
    setValue('');
    setSelectedImage(null);
  };

  // Sync value when editTarget changes
  React.useEffect(() => {
    if (editTarget) {
      setValue(editTarget.text);
    }
  }, [editTarget]);

  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setSelectedImage(result.assets[0].uri);
    }
  };

  return (
    <KeyboardStickyView offset={{ closed: 8, opened: 8 }}>
      <View className="bg-surface rounded-[28px] mx-4 mb-5 p-3">
        {selectedImage && (
          <View className="relative mb-2 self-start">
            <Image source={{ uri: selectedImage }} className="w-20 h-20 rounded-xl" resizeMode="cover" />
            <TouchableOpacity
              onPress={() => setSelectedImage(null)}
              className="absolute -top-2 -right-2 bg-surface-hover rounded-full w-5 h-5 items-center justify-center"
            >
              <Feather name="x" size={12} color={t.white} />
            </TouchableOpacity>
          </View>
        )}

        {isEditing && (
          <View className="flex-row items-center gap-2 mb-2 px-2">
            <Feather name="edit-2" size={14} color={t.warning} />
            <Text className="text-warning text-xs flex-1 font-sans">Modification du message...</Text>
            <TouchableOpacity onPress={() => { setValue(''); onCancelEdit?.(); }} className="p-1">
              <Feather name="x" size={14} color={t.icon} />
            </TouchableOpacity>
          </View>
        )}

        <TextInput
          value={value}
          onChangeText={setValue}
          placeholder="Message Oh Matilda..."
          placeholderTextColor={t.inputPlaceholder}
          multiline
          editable={!streaming}
          className="text-text-primary text-base max-h-32 min-h-[40px] px-2"
          style={{ textAlignVertical: 'top' }}
        />

        <View className="flex-row justify-between items-center mt-2">
          <View className="flex-row items-center gap-2">
            <TouchableOpacity onPress={handlePickImage} className="p-2" disabled={streaming}>
              <Feather name="plus" size={24} color={streaming ? t.textSubtle : t.icon} />
            </TouchableOpacity>

            <TouchableOpacity onPress={onToggleWebSearch} className="p-2" disabled={streaming}>
              <Ionicons
                name="globe-outline"
                size={22}
                color={webSearch ? t.info : streaming ? t.textSubtle : t.icon}
              />
            </TouchableOpacity>
          </View>

          <View className="flex-row items-center gap-2">
            <TouchableOpacity
              onPress={streaming ? onStop : handleSend}
              className={`rounded-full h-10 w-10 items-center justify-center ml-1 ${streaming ? 'bg-danger' : 'bg-primary'}`}
            >
              {streaming ? (
                <Feather name="square" size={18} color={t.white} />
              ) : (
                <Ionicons name="arrow-up" size={20} color={t.white} />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </KeyboardStickyView>
  );
}
