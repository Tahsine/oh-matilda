import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, KeyRound, Check, ChevronRight } from '@/lib/icons';
import { getKeyStatus, getKeySuffix } from '@/lib/ollamaKey';
import { ApiKeyCard } from './ApiKeyCard';

interface SettingsSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onToast: (msg: string) => void;
}

export const SettingsSheet: React.FC<SettingsSheetProps> = ({
  isOpen,
  onClose,
  onToast,
}) => {
  const [hasKey, setHasKey] = useState<boolean>(false);
  const [suffix, setSuffix] = useState<string>('');
  const [keyEditorOpen, setKeyEditorOpen] = useState<boolean>(false);

  const refreshStatus = (): void => {
    void getKeyStatus().then(setHasKey).catch(() => setHasKey(false));
    void getKeySuffix().then(setSuffix).catch(() => setSuffix(''));
  };

  useEffect(() => {
    if (!isOpen) return;
    refreshStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const onWipe = (): void => {
    try {
      window.localStorage.clear();
    } catch {
      // ignore
    }
    window.location.reload();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[55] flex items-end justify-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 backdrop-blur-xs cursor-pointer"
            style={{ backgroundColor: 'var(--backdrop)' }}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Settings"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 34 }}
            className="relative w-full p-4 pt-3 pb-[calc(var(--sab)+16px)]"
            style={{
              backgroundColor: 'var(--screen-bg)',
              borderTopLeftRadius: 'var(--radius-lg)',
              borderTopRightRadius: 'var(--radius-lg)',
              boxShadow: 'var(--shadow-md)',
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-[15px] font-bold tracking-tight" style={{ color: 'var(--text-1)' }}>
                Settings
              </span>
              <button
                onClick={onClose}
                className="w-11 h-11 -m-1.5 rounded-[11px] flex items-center justify-center transition-colors active:bg-[var(--hover)] cursor-pointer"
                style={{ color: 'var(--text-2)' }}
                aria-label="Close settings"
              >
                <X className="w-4 h-4 stroke-[2.2]" />
              </button>
            </div>

            <div
              className="text-[11px] font-bold tracking-widest uppercase px-1 mb-1.5"
              style={{ color: 'var(--text-3)' }}
            >
              Ollama API key
            </div>
            <button
              onClick={() => setKeyEditorOpen(true)}
              className="w-full flex items-center gap-2.5 p-3 border mb-4 text-left cursor-pointer"
              style={{
                backgroundColor: 'var(--card-bg)',
                borderColor: 'var(--card-border)',
                borderRadius: 'var(--radius-md)',
                boxShadow: 'var(--shadow-sm)',
              }}
              aria-label="Edit API key"
            >
              <KeyRound className="w-4 h-4 shrink-0" style={{ color: 'var(--text-2)' }} />
              <span className="flex-1 text-[13px] font-medium" style={{ color: 'var(--text-1)' }}>
                {hasKey ? `Configured ••••${suffix}` : 'Not configured'}
              </span>
              {hasKey && <Check className="w-4 h-4 shrink-0" style={{ color: 'var(--accent)' }} />}
              <ChevronRight className="w-4 h-4 shrink-0" style={{ color: 'var(--text-3)' }} />
            </button>

            <div
              className="text-[11px] font-bold tracking-widest uppercase px-1 mb-1.5"
              style={{ color: 'var(--text-3)' }}
            >
              About
            </div>
            <div
              className="p-3 border mb-4 text-[12px]"
              style={{
                backgroundColor: 'var(--card-bg)',
                borderColor: 'var(--card-border)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-2)',
              }}
            >
              Oh-Matilda 0.1.0 · on-device Android agent
            </div>

            <div
              className="text-[11px] font-bold tracking-widest uppercase px-1 mb-1.5"
              style={{ color: 'var(--text-3)' }}
            >
              Danger zone
            </div>
            <button
              onClick={onWipe}
              className="w-full py-2.5 rounded-[10px] text-[13px] font-semibold cursor-pointer border"
              style={{ color: 'var(--danger)', borderColor: 'var(--card-border)', backgroundColor: 'var(--card-bg)' }}
            >
              Erase local data
            </button>
          </motion.div>

          <ApiKeyCard
            isOpen={keyEditorOpen}
            hasKey={hasKey}
            onClose={() => {
              setKeyEditorOpen(false);
              refreshStatus();
            }}
            onToast={onToast}
          />
        </div>
      )}
    </AnimatePresence>
  );
};
