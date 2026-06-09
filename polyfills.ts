import { Platform } from 'react-native';

if (Platform.OS !== 'web') {
  const g = globalThis as any;
  if (typeof g.crypto === 'undefined') {
    g.crypto = {};
  }
  if (typeof g.crypto.randomUUID !== 'function') {
    g.crypto.randomUUID = () => {
      const hex = '0123456789abcdef';
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = (Math.random() * 16) | 0;
        return c === 'x' ? hex[r] : hex[(r & 0x3) | 0x8];
      });
    };
  }
}

export {};
