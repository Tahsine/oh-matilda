import { Feather, Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
import { ActivityIndicator, Image, Keyboard, TextInput, TouchableOpacity, View } from 'react-native';
import { KeyboardStickyView } from 'react-native-keyboard-controller';

type ChatInputProps = {
  onSend: (text: string, image?: string) => void;
  streaming: boolean;
  webSearch?: boolean;
  onToggleWebSearch?: () => void;
};

export function ChatInput({ onSend, streaming, webSearch = false, onToggleWebSearch }: ChatInputProps) {
  const [value, setValue] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const handleSend = () => {
    const text = value.trim();
    if (!text && !selectedImage) return;
    if (streaming) return;
    Keyboard.dismiss();
    onSend(text, selectedImage ?? undefined);
    setValue('');
    setSelectedImage(null);
  };

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
              <Feather name="x" size={12} className="text-white" />
            </TouchableOpacity>
          </View>
        )}

        <TextInput
          value={value}
          onChangeText={setValue}
          placeholder="Message Oh Matilda..."
          placeholderTextColor="#A3A3A3"
          multiline
          editable={!streaming}
          className="text-text-primary text-base max-h-32 min-h-[40px] px-2"
          style={{ textAlignVertical: 'top' }}
        />

        <View className="flex-row justify-between items-center mt-2">
          <View className="flex-row items-center gap-2">
            <TouchableOpacity onPress={handlePickImage} className="p-2" disabled={streaming}>
              <Feather name="plus" size={24} className={streaming ? 'text-text-subtle' : 'text-icon'} />
            </TouchableOpacity>

            <TouchableOpacity onPress={onToggleWebSearch} className="p-2" disabled={streaming}>
              <Ionicons
                name="globe-outline"
                size={22}
                className={webSearch ? 'text-info' : streaming ? 'text-text-subtle' : 'text-icon'}
              />
            </TouchableOpacity>
          </View>

          <View className="flex-row items-center gap-2">
            <TouchableOpacity className="p-2">
              <Feather name="mic" size={20} className="text-icon" />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleSend}
              disabled={(!value.trim() && !selectedImage) || streaming}
              className="bg-primary rounded-full h-10 w-10 items-center justify-center ml-1"
            >
              {streaming ? (
                <ActivityIndicator size="small" className="text-white" />
              ) : (
                <Ionicons name="arrow-up" size={20} className="text-white" />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </KeyboardStickyView>
  );
}
