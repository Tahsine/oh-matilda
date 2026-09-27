import React, { useRef, useState } from 'react';
import { ImageIcon, FileText, Globe, Sliders, Check, ChevronDown, Bot } from '@/lib/icons';
import { motion, AnimatePresence } from 'motion/react';
import { SHOW_WEBSEARCH } from '@/lib/flags';
import type { Mode } from '@/types';

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onAttachPhoto: () => void;
  onAttachFile: () => void;
  webEnabled: boolean;
  onToggleWeb: () => void;
  mode: Mode;
  onChangeMode: (mode: Mode) => void;
  onRunAgent: () => void;
}

export const BottomSheet: React.FC<BottomSheetProps> = ({
  isOpen,
  onClose,
  onAttachPhoto,
  onAttachFile,
  webEnabled,
  onToggleWeb,
  mode,
  onChangeMode,
  onRunAgent,
}) => {
  const [showToneOptions, setShowToneOptions] = useState<boolean>(false);
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const startY = useRef(0);
  const dragDelta = useRef(0);
  const dragging = useRef(false);

  const onDragStart = (e: React.PointerEvent) => {
    dragging.current = true;
    startY.current = e.clientY;
    dragDelta.current = 0;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onDragMove = (e: React.PointerEvent) => {
    if (!dragging.current || !sheetRef.current) return;
    const dy = Math.max(0, e.clientY - startY.current);
    dragDelta.current = dy;
    sheetRef.current.style.transform = `translateY(${dy}px)`;
  };
  const onDragEnd = () => {
    if (!dragging.current) return;
    dragging.current = false;
    if (sheetRef.current) sheetRef.current.style.transform = '';
    if (dragDelta.current > 120) onClose();
  };

  const modeLabels: Record<Mode, string> = {
    fast: 'Fast',
    thinking: 'Thinking',
  };

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
            className="absolute inset-0 z-40 cursor-pointer"
            style={{ backgroundColor: 'var(--backdrop)' }}
          />

          {/* Sheet Drawer */}
          <motion.div
            ref={sheetRef}
            id="bottom-sheet"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="absolute left-0 right-0 bottom-0 z-50 rounded-t-[24px] border-t p-2 pb-[calc(var(--sab)+28px)] shadow-2xl"
            style={{
              backgroundColor: 'var(--screen-bg)',
              borderColor: 'var(--card-border)',
            }}
          >
            {/* Grab handle (drag to close) — hit zone élargie 44px */}
            <div
              onPointerDown={onDragStart}
              onPointerMove={onDragMove}
              onPointerUp={onDragEnd}
              onPointerCancel={onDragEnd}
              className="h-11 flex items-start justify-center pt-1.5 mb-2 touch-none cursor-grab select-none"
            >
              <div
                className="w-10 h-1 rounded-full opacity-50"
                style={{ backgroundColor: 'var(--text-3)' }}
              />
            </div>

            <div className="flex flex-col gap-1 px-1">
              {/* Photo */}
              <button
                onClick={onAttachPhoto}
                className="flex items-center gap-3 w-full min-h-[44px] p-2.5 rounded-[12px] text-[13px] font-medium text-left transition-colors active:bg-black/5 active:scale-[0.99] cursor-pointer"
                style={{ color: 'var(--text-1)' }}
              >
                <ImageIcon className="w-4 h-4 stroke-[2]" style={{ color: 'var(--text-2)' }} />
                <span>Photo</span>
              </button>

              {/* File */}
              <button
                onClick={onAttachFile}
                className="flex items-center gap-3 w-full min-h-[44px] p-2.5 rounded-[12px] text-[13px] font-medium text-left transition-colors active:bg-black/5 active:scale-[0.99] cursor-pointer"
                style={{ color: 'var(--text-1)' }}
              >
                <FileText className="w-4 h-4 stroke-[2]" style={{ color: 'var(--text-2)' }} />
                <span>File</span>
              </button>

              {/* Agent task — exécute le texte du composer sur le téléphone */}
              <button
                onClick={onRunAgent}
                className="flex items-center gap-3 w-full min-h-[44px] p-2.5 rounded-[12px] text-[13px] font-medium text-left transition-colors active:bg-black/5 active:scale-[0.99] cursor-pointer"
                style={{ color: 'var(--text-1)' }}
              >
                <Bot className="w-4 h-4 stroke-[2]" style={{ color: 'var(--accent)' }} />
                <span>Agent task</span>
              </button>

              {/* Web Search Toggle (masqué : aucun tool réel — voir flags.ts) */}
              {SHOW_WEBSEARCH && (
              <button
                onClick={onToggleWeb}
                className="flex items-center gap-3 w-full min-h-[44px] p-2.5 rounded-[12px] text-[13px] font-medium text-left transition-colors active:bg-black/5 active:scale-[0.99] cursor-pointer"
                style={{
                  color: webEnabled ? 'var(--accent)' : 'var(--text-1)',
                }}
              >
                <Globe
                  className="w-4 h-4 stroke-[2]"
                  style={{ color: webEnabled ? 'var(--accent)' : 'var(--text-2)' }}
                />
                <span className="flex-1">Web search</span>
                {webEnabled && (
                  <Check className="w-4 h-4 stroke-[2.6]" style={{ color: 'var(--accent)' }} />
                )}
              </button>
              )}

              {/* Tone Option */}
              <button
                onClick={() => setShowToneOptions(!showToneOptions)}
                className="flex items-center gap-3 w-full min-h-[44px] p-2.5 rounded-[12px] text-[13px] font-medium text-left transition-colors active:bg-black/5 active:scale-[0.99] cursor-pointer"
                style={{ color: 'var(--text-1)' }}
              >
                <Sliders className="w-4 h-4 stroke-[2]" style={{ color: 'var(--text-2)' }} />
                <span className="flex-1">Mode</span>
                <span className="text-[11.5px] font-semibold mr-1" style={{ color: 'var(--text-3)' }}>
                  {modeLabels[mode]}
                </span>
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform duration-200 stroke-[2.4] ${
                    showToneOptions ? 'rotate-180' : ''
                  }`}
                  style={{ color: 'var(--text-3)' }}
                />
              </button>

              {/* Expandable Tone Submenu */}
              {showToneOptions && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="pl-7 pr-2 py-1 flex flex-col gap-1 overflow-hidden"
                >
                  {(['fast', 'thinking'] as Mode[]).map((t) => (
                    <button
                      key={t}
                      onClick={() => {
                        onChangeMode(t);
                        setShowToneOptions(false);
                      }}
                      className="flex items-center justify-between py-2 px-2.5 rounded-[8px] text-[12.5px] font-medium transition-colors active:bg-black/5 cursor-pointer"
                      style={{
                        backgroundColor: mode === t ? 'var(--hover)' : 'transparent',
                        color: 'var(--text-1)',
                      }}
                    >
                      <span>{modeLabels[t]}</span>
                      {mode === t && (
                        <Check className="w-3.5 h-3.5 stroke-[2.5]" style={{ color: 'var(--accent)' }} />
                      )}
                    </button>
                  ))}
                </motion.div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
