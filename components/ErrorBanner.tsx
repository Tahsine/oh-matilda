import { Feather } from '@expo/vector-icons';
import React, { useEffect, useRef } from 'react';
import { Animated, Text, TouchableOpacity, View } from 'react-native';
import { dismissError, type AppError } from '../lib/error-handler';

type ErrorBannerProps = {
  error: AppError;
};

export function ErrorBanner({ error }: ErrorBannerProps) {
  const slide = useRef(new Animated.Value(-100)).current;
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    Animated.spring(slide, { toValue: 0, useNativeDriver: true }).start();
    timer.current = setTimeout(() => handleDismiss(), 8000);
    return () => clearTimeout(timer.current);
  }, []);

  const handleDismiss = () => {
    Animated.timing(slide, { toValue: -100, duration: 200, useNativeDriver: true }).start(() => {
      dismissError(error.id);
    });
  };

  return (
    <Animated.View
      style={{ transform: [{ translateY: slide }] }}
      className="absolute top-0 left-0 right-0 z-50 mx-4 mt-2"
    >
      <View className="bg-danger/90 rounded-xl px-4 py-3 flex-row items-center gap-3">
        <Feather name="alert-circle" size={18} color="#FFFFFF" />
        <Text className="text-white text-sm flex-1 font-sans">{error.message}</Text>
        <View className="flex-row items-center gap-2">
          {error.retry && (
            <TouchableOpacity onPress={error.retry} className="bg-surface rounded-lg px-3 py-1">
              <Text className="text-white text-xs font-sans">Réessayer</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={handleDismiss} className="p-1">
            <Feather name="x" size={16} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );
}
