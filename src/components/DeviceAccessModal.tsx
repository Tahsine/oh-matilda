import React from 'react';
import { X, MousePointerClick, ImageIcon } from '@/lib/icons';
import { motion, AnimatePresence } from 'motion/react';
import type { DevicePerms } from '@/types';

interface DeviceAccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  perms: DevicePerms;
  onEnablePerm: (perm: keyof DevicePerms) => void;
  onCaptureScreen: () => void;
  screenshotPreview: string | null;
  isCapturing: boolean;
  onContinue: () => void;
}

export const DeviceAccessModal: React.FC<DeviceAccessModalProps> = ({
  isOpen,
  onClose,
  perms,
  onEnablePerm,
  onCaptureScreen,
  screenshotPreview,
  isCapturing,
  onContinue,
}) => {
  const canContinue = perms.a11y && perms.capture;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            onClick={onClose}
            className="absolute inset-0 z-[55] cursor-pointer"
            style={{ backgroundColor: 'var(--backdrop)' }}
          />

          {/* Modal Container */}
          <motion.div
            id="device-access-screen"
            initial={{ opacity: 0, y: 18, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 14, scale: 0.96 }}
            transition={{ type: 'spring', damping: 25, stiffness: 320 }}
            className="absolute left-2.5 right-2.5 top-[calc(var(--sat)+56px)] bottom-[calc(var(--sab)+56px)] z-[56] rounded-[20px] border shadow-2xl flex flex-col overflow-hidden backdrop-blur-md"
            style={{
              backgroundColor: 'var(--panel-bg)',
              borderColor: 'var(--panel-border)',
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 pb-2 shrink-0">
              <span className="text-[14px] font-bold tracking-tight" style={{ color: 'var(--text-1)' }}>
                Device access
              </span>
              <button
                onClick={onClose}
                className="w-11 h-11 -m-2 rounded-lg flex items-center justify-center transition-colors active:bg-black/5 cursor-pointer"
                style={{ color: 'var(--text-2)' }}
                aria-label="Close device access"
              >
                <X className="w-4 h-4 stroke-[2.2]" />
              </button>
            </div>

            {/* Content Body */}
            <div className="flex-1 overflow-y-auto px-4.5 py-2 no-scrollbar">
              <h2 className="text-[16.5px] font-bold leading-snug mb-1.5" style={{ color: 'var(--text-1)' }}>
                Let Oh-Matilda act on your phone
              </h2>
              <p className="text-[12px] leading-[1.55] mb-4" style={{ color: 'var(--text-2)' }}>
                To open apps and tap or swipe for you, Oh-Matilda needs two permissions. Accessibility stays granted until you revoke it in Android Settings. Screen capture is asked again each time Oh-Matilda needs to act, to stay compliant with Android's privacy rules.
              </p>

              {/* Permission 1: Accessibility */}
              <div
                className="flex items-start gap-2.5 py-3 border-t"
                style={{ borderColor: 'var(--card-border)' }}
              >
                <div
                  className="w-8 h-8 rounded-[10px] flex items-center justify-center shrink-0 mt-0.5"
                  style={{
                    backgroundColor: 'var(--accent-soft)',
                    color: 'var(--accent)',
                  }}
                >
                  <MousePointerClick className="w-4 h-4 stroke-[2]" />
                </div>
                <div className="flex-1">
                  <div className="text-[13px] font-semibold mb-0.5" style={{ color: 'var(--text-1)' }}>
                    Accessibility
                  </div>
                  <div className="text-[11.5px] leading-[1.45] mb-2" style={{ color: 'var(--text-2)' }}>
                    Reads what's on screen and taps or swipes on your behalf.
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10.5px] font-bold px-2.5 py-0.5 rounded-full ${
                        perms.a11y ? 'text-[var(--accent)] bg-[var(--accent-soft)]' : 'text-[var(--text-3)] bg-[var(--hover)]'
                      }`}
                    >
                      {perms.a11y ? 'Granted' : 'Not granted'}
                    </span>
                    {!perms.a11y && (
                      <button
                        onClick={() => onEnablePerm('a11y')}
                        className="text-[12px] font-bold cursor-pointer min-h-[40px] active:opacity-70"
                        style={{ color: 'var(--accent)' }}
                      >
                        Enable in Android Settings
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Permission 2: Screen capture */}
              <div
                className="flex items-start gap-2.5 py-3 border-t"
                style={{ borderColor: 'var(--card-border)' }}
              >
                <div
                  className="w-8 h-8 rounded-[10px] flex items-center justify-center shrink-0 mt-0.5"
                  style={{
                    backgroundColor: 'var(--accent-soft)',
                    color: 'var(--accent)',
                  }}
                >
                  <ImageIcon className="w-4 h-4 stroke-[2]" />
                </div>
                <div className="flex-1">
                  <div className="text-[13px] font-semibold mb-0.5" style={{ color: 'var(--text-1)' }}>
                    Screen capture
                  </div>
                  <div className="text-[11.5px] leading-[1.45] mb-2" style={{ color: 'var(--text-2)' }}>
                    Takes a screenshot right before and after an action, so you can check what happened.
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10.5px] font-bold px-2.5 py-0.5 rounded-full ${
                        perms.capture ? 'text-[var(--accent)] bg-[var(--accent-soft)]' : 'text-[var(--text-3)] bg-[var(--hover)]'
                      }`}
                    >
                      {perms.capture ? 'Granted' : 'Not granted'}
                    </span>
                    {!perms.capture && (
                      <button
                        onClick={onCaptureScreen}
                        disabled={isCapturing}
                        className="text-[12px] font-bold cursor-pointer min-h-[44px] active:opacity-70 disabled:opacity-50"
                        style={{ color: 'var(--accent)' }}
                      >
                        {isCapturing ? 'Capturing…' : 'Test capture'}
                      </button>
                    )}
                  </div>
                  {screenshotPreview && (
                    <img
                      src={screenshotPreview}
                      alt="Last screenshot preview"
                      className="w-full rounded-[10px] border mt-2 block"
                      style={{ borderColor: 'var(--card-border)' }}
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div
              className="p-4 pt-3 border-t shrink-0"
              style={{ borderColor: 'var(--card-border)' }}
            >
              <button
                disabled={!canContinue}
                onClick={onContinue}
                className="w-full py-3 rounded-[12px] text-[13.5px] font-bold text-center text-white transition-opacity disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                style={{ backgroundColor: 'var(--accent)' }}
              >
                Continue
              </button>
              <p className="text-[10.5px] text-center mt-2.5 leading-snug" style={{ color: 'var(--text-3)' }}>
                You're always asked to confirm before Oh-Matilda taps or swipes anything.
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
