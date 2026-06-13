import { useColorScheme } from 'nativewind';

export const LIGHT = {
  icon: '#525252',
  chevron: '#A3A3A3',
  danger: '#EF4444',
  warning: '#F97316',
  info: '#3B82F6',
  primary: '#64748B',
  inputPlaceholder: '#A3A3A3',
  white: '#FFFFFF',
  textSubtle: '#A3A3A3',
};

export const DARK = {
  icon: '#D4D4D4',
  chevron: '#737373',
  danger: '#EF4444',
  warning: '#F97316',
  info: '#3B82F6',
  primary: '#64748B',
  inputPlaceholder: '#525252',
  white: '#FFFFFF',
  textSubtle: '#525252',
};

export function useTokens() {
  const { colorScheme } = useColorScheme();
  return colorScheme === 'dark' ? DARK : LIGHT;
}
