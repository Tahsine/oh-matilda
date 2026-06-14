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
  textPrimary: '#1A1A1A',
  textSecondary: '#525252',
  textMuted: '#737373',
  codeBg: '#F0F0F0',
  link: '#2563EB',
  heading: '#1A1A1A',
  blockquoteBorder: '#D4D4D4',
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
  textPrimary: '#E4E4E7',
  textSecondary: '#D4D4D4',
  textMuted: '#A3A3A3',
  codeBg: '#2A2A2A',
  link: '#60A5FA',
  heading: '#E4E4E7',
  blockquoteBorder: '#525252',
};

export function useTokens() {
  const { colorScheme } = useColorScheme();
  return colorScheme === 'dark' ? DARK : LIGHT;
}
