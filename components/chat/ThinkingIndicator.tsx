import React, { useEffect, useRef } from 'react';
import { Animated, Text, View } from 'react-native';

const STATUS_LABELS: Record<string, string> = {
  idle: '',
  thinking: 'L\'agent réfléchit',
  searching: 'Recherche dans les documents',
  generating: 'Génération de la réponse',
};

type ThinkingIndicatorProps = {
  status?: string;
};

export function ThinkingIndicator({ status = 'thinking' }: ThinkingIndicatorProps) {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const bounce = (dot: Animated.Value, delay: number) => {
      const anim = Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, { toValue: -6, duration: 300, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0, duration: 300, useNativeDriver: true }),
        ]),
      );
      anim.start();
      return anim;
    };

    const a1 = bounce(dot1, 0);
    const a2 = bounce(dot2, 200);
    const a3 = bounce(dot3, 400);

    return () => { a1.stop(); a2.stop(); a3.stop(); };
  }, []);

  return (
    <View className="px-4 py-2">
      {status !== 'idle' && (
        <Text className="text-neutral-400 text-xs mb-2">{STATUS_LABELS[status] || status}</Text>
      )}
      <View className="flex-row items-center h-4">
        {[dot1, dot2, dot3].map((dot, i) => (
          <Animated.View
            key={i}
            className="w-2 h-2 rounded-full bg-neutral-400 mx-0.5"
            style={{ transform: [{ translateY: dot }] }}
          />
        ))}
      </View>
    </View>
  );
}
