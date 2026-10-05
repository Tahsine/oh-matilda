import React from 'react';
import { Settings, Shield } from '@/lib/icons';
import { motion, AnimatePresence } from 'motion/react';

interface KebabMenuProps {
  isOpen: boolean;
  onClose: () => void;
  isDark: boolean;
  onToggleTheme: () => void;
  onOpenSettings: () => void;
  onOpenAccess: () => void;
}

export const KebabMenu: React.FC<KebabMenuProps> = ({
  isOpen,
  onClose,
  isDark,
  onToggleTheme,
  onOpenSettings,
  onOpenAccess,
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="kebab-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-30"
          onClick={onClose}
        />
      )}
      {isOpen && (
        <motion.div
          key="kebab-menu"
          id="kebab-menu"
          initial={{ opacity: 0, scale: 0.95, y: -8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -6 }}
          transition={{ duration: 0.16 }}
          className="fixed top-[calc(var(--sat)+56px)] right-3 z-40 p-1.5 min-w-[190px] select-none"
          style={{
            backgroundColor: 'var(--card-bg)',
            borderColor: 'var(--card-border)',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-md)',
            borderWidth: 1,
            borderStyle: 'solid',
          }}
        >
          {/* Dark theme toggle */}
          <button
            onClick={onToggleTheme}
            className="flex items-center justify-between w-full min-h-[44px] p-2.5 rounded-[8px] text-[13px] font-medium transition-colors active:bg-[var(--hover)] cursor-pointer"
            style={{ color: 'var(--text-1)' }}
          >
            <span>Dark theme</span>
            <div
              className={`w-9 h-[21px] rounded-full relative transition-colors p-[2px] ${
                isDark ? 'bg-[var(--accent)]' : 'bg-[var(--switch-bg)]'
              }`}
            >
              <span
                className={`block w-[17px] h-[17px] rounded-full shadow-xs transition-transform duration-200 ${
                  isDark ? 'translate-x-[15px]' : 'translate-x-0'
                }`}
                style={{ backgroundColor: 'var(--card-bg)' }}
              />
            </div>
          </button>

          {/* Settings */}
          <button
            onClick={() => {
              onClose();
              onOpenSettings();
            }}
            className="flex items-center gap-2.5 w-full min-h-[44px] p-2.5 rounded-[8px] text-[13px] font-medium transition-colors active:bg-[var(--hover)] cursor-pointer text-left"
            style={{ color: 'var(--text-1)' }}
          >
            <Settings className="w-4 h-4 stroke-[2]" style={{ color: 'var(--text-2)' }} />
            <span>Settings</span>
          </button>

          {/* Device access */}
          <button
            onClick={() => {
              onClose();
              onOpenAccess();
            }}
            className="flex items-center gap-2.5 w-full min-h-[44px] p-2.5 rounded-[8px] text-[13px] font-medium transition-colors active:bg-[var(--hover)] cursor-pointer text-left"
            style={{ color: 'var(--text-1)' }}
          >
            <Shield className="w-4 h-4 stroke-[2]" style={{ color: 'var(--text-2)' }} />
            <span>Device access</span>
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
