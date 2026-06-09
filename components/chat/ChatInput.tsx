import { Feather, Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Keyboard, TextInput, TouchableOpacity, View } from 'react-native';
import { KeyboardStickyView } from 'react-native-keyboard-controller';

type ChatInputProps = {
  onSend: (text: string) => void;
  streaming: boolean;
};

export function ChatInput({ onSend, streaming }: ChatInputProps) {
  const [value, setValue] = useState('');

  const handleSend = () => {
    const text = value.trim();
    if (!text || streaming) return;
    Keyboard.dismiss();
    onSend(text);
    setValue('');
  };

  return (
    <KeyboardStickyView offset={{ closed: 8, opened: 8 }}>
      <View className="bg-[#2A2A2A] rounded-[28px] mx-4 mb-2 p-3">
        <TextInput
          value={value}
          onChangeText={setValue}
          placeholder="Message Oh Matilda..."
          placeholderTextColor="#A3A3A3"
          multiline
          className="text-white text-base max-h-32 min-h-[40px] px-2"
          style={{ textAlignVertical: 'top' }}
        />

        <View className="flex-row justify-between items-center mt-2">
          <TouchableOpacity className="p-2">
            <Feather name="plus" size={24} color="#D4D4D4" />
          </TouchableOpacity>

          <View className="flex-row items-center gap-2">
            <TouchableOpacity className="p-2">
              <Feather name="mic" size={20} color="#D4D4D4" />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleSend}
              disabled={!value.trim() || streaming}
              className="bg-slate-500 rounded-full h-10 w-10 items-center justify-center ml-1"
            >
              <Ionicons name="arrow-up" size={20} color="white" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </KeyboardStickyView>
  );
}
