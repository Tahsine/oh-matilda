import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Text, TouchableOpacity, View } from 'react-native';
import { useTokens } from '../../lib/theme-tokens';

type ToastData = {
  title: string;
  message: string;
};

let showToastFn: ((data: ToastData) => void) | null = null;

export function showToast(title: string, message: string) {
  showToastFn?.({ title, message });
}

export function Toast() {
  const t = useTokens();
  const [data, setData] = useState<ToastData | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  showToastFn = useCallback((d: ToastData) => {
    setData(d);
    Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
        setData(null);
      });
    }, 2500);
  }, [opacity]);

  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  if (!data) return null;

  return (
    <Animated.View
      style={{ opacity }}
      className="absolute bottom-24 left-4 right-4 z-50"
    >
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => {
          Animated.timing(opacity, { toValue: 0, duration: 150, useNativeDriver: true }).start(() => setData(null));
        }}
        className="bg-surface rounded-xl px-4 py-3 shadow-lg shadow-black/40 border border-border"
      >
        {data.title ? (
          <Text className="text-text-primary text-sm font-semibold">{data.title}</Text>
        ) : null}
        <Text className="text-text-secondary text-xs mt-0.5">{data.message}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}
