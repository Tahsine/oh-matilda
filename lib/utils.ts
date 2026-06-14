import i18n from './i18n';

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return `0 ${i18n.t('fileSize.o')}`;
  const units = ['fileSize.o', 'fileSize.Ko', 'fileSize.Mo', 'fileSize.Go'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const size = bytes / Math.pow(1024, i);
  return `${size.toFixed(i === 0 ? 0 : 1)} ${i18n.t(units[i])}`;
}

export function formatFileDate(timestamp: number): string {
  const locale = i18n.language === 'fr' ? 'fr-FR' : 'en-US';
  return new Date(timestamp).toLocaleDateString(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function formatRelativeDate(date: Date): string {
  const now = Date.now();
  const diff = now - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return i18n.t('dates.justNow');
  if (minutes < 60) return i18n.t('dates.minutesAgo', { minutes });
  if (hours < 24) return i18n.t('dates.hoursAgo', { hours });
  if (days === 1) return i18n.t('dates.yesterday');
  if (days < 7) return i18n.t('dates.daysAgo', { days });
  const locale = i18n.language === 'fr' ? 'fr-FR' : 'en-US';
  return date.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
}
