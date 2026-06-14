import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import fr from '../locales/fr.json';
import en from '../locales/en.json';
import { getSetting, setSetting } from './settings';

i18n.use(initReactI18next).init({
  resources: { fr: { translation: fr }, en: { translation: en } },
  lng: 'fr',
  fallbackLng: 'fr',
  interpolation: { escapeValue: false },
});

export function detectLanguage(): void {
  const saved = getSetting('language');
  if (saved) {
    i18n.changeLanguage(saved);
    return;
  }
  const locales = Localization.getLocales();
  const detected = locales[0]?.languageCode || 'fr';
  const lang = ['fr', 'en'].includes(detected) ? detected : 'fr';
  i18n.changeLanguage(lang);
  setSetting('language', lang);
}

export default i18n;
