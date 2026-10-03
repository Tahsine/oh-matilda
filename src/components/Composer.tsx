import React, { useRef, useEffect } from 'react';
import { Plus, ArrowUp, FileText, X } from '@/lib/icons';
import { motion } from 'motion/react';
import type { AttachmentState } from '@/types';
import { IMG_DESK } from '@/constants/images';

interface ComposerProps {
  input: string;
  onChangeInput: (val: string) => void;
  attachments: AttachmentState;
  onRemoveAttachment: (type: 'photo' | 'file') => void;
  onOpenSheet: () => void;
  onSend: () => void;
  onStartVoice: () => void;
  agentArmed: boolean;
}

export const Composer: React.FC<ComposerProps> = ({
  input,
  onChangeInput,
  attachments,
  onRemoveAttachment,
  onOpenSheet,
  onSend,
  agentArmed,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Auto-resize textarea height
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 96)}px`;
    }
  }, [input]);

  const hasContent = !!(input.trim() || attachments.photo || attachments.file);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (hasContent) {
        onSend();
      }
    }
  };

  return (
    <div
      id="composer-wrap"
      className="relative px-3 pt-2 pb-[calc(var(--sab)+2px)] select-none shrink-0 z-10"
    >
      <div
        className="rounded-[22px] p-2.5 px-3.5 border shadow-xs transition-all"
        style={{
          backgroundColor: 'var(--composer-bg)',
          borderColor: agentArmed ? 'var(--accent)' : 'var(--composer-border)',
        }}
      >
        {/* Badge mode agent strict */}
        {agentArmed && (
          <div className="flex items-center gap-1.5 pb-1.5">
            <span
              className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-[6px]"
              style={{ backgroundColor: 'var(--accent-soft)', color: 'var(--accent)' }}
            >
              Agent
            </span>
            <span className="text-[10.5px] font-medium" style={{ color: 'var(--text-3)' }}>
              Ce message agira sur ton téléphone
            </span>
          </div>
        )}
        {/* Pending attachments preview */}
        {(attachments.photo || attachments.file) && (
          <div className="flex gap-2 flex-wrap mb-2">
            {attachments.photo && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="relative w-12 h-12"
              >
                <img
                  src={IMG_DESK}
                  alt="attached photo thumbnail"
                  className="w-12 h-12 object-cover rounded-[9px] border"
                  style={{ borderColor: 'var(--card-border)' }}
                />
                <button
                  onClick={() => onRemoveAttachment('photo')}
                  className="absolute -top-1.5 -right-1.5 w-[17px] h-[17px] rounded-full flex items-center justify-center text-[9px] border shadow-xs cursor-pointer active:scale-90"
                  style={{
                    backgroundColor: 'var(--card-bg)',
                    borderColor: 'var(--card-border)',
                    color: 'var(--text-2)',
                  }}
                  aria-label="Remove photo"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </motion.div>
            )}

            {attachments.file && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="flex items-center gap-1.5 px-2 py-1 rounded-[9px] text-[11px] font-medium h-8 border"
                style={{
                  backgroundColor: 'var(--hover)',
                  borderColor: 'var(--card-border)',
                  color: 'var(--text-1)',
                }}
              >
                <FileText className="w-3 h-3 text-current" />
                <span>brief.pdf · 128 KB</span>
                <button
                  onClick={() => onRemoveAttachment('file')}
                  className="ml-1 cursor-pointer active:opacity-70"
                  aria-label="Remove file"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </motion.div>
            )}
          </div>
        )}

        {/* Text Input */}
        <textarea
          ref={textareaRef}
          id="composer-input"
          rows={1}
          enterKeyHint="send"
          value={input}
          onChange={(e) => onChangeInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={agentArmed ? "Describe a task for your phone" : "Ask Oh-Matilda anything"}
          className="w-full bg-transparent border-0 resize-none outline-none text-[13.5px] leading-[1.45] max-h-24 h-5 placeholder:text-[var(--text-3)]"
          style={{ color: 'var(--text-1)' }}
        />

        {/* Controls Bar */}
        <div className="flex items-center justify-between mt-1.5">
          <button
            id="btn-plus-options"
            onClick={onOpenSheet}
            className="w-11 h-11 rounded-xl flex items-center justify-center transition-all active:bg-black/10 active:scale-90 cursor-pointer"
            style={{
              backgroundColor: 'var(--hover)',
              color: 'var(--text-2)',
            }}
            aria-label="More options"
          >
            <Plus className="w-[17px] h-[17px] stroke-[2.3]" />
          </button>

          {/* Send seul : le mode voix n'est pas implémenté (bouton masqué à vide). */}
          {hasContent && (
          <button
            id="btn-send-or-voice"
            onClick={onSend}
            className="w-11 h-11 rounded-full flex items-center justify-center transition-all active:scale-90 cursor-pointer shadow-md text-white"
            style={{
              backgroundColor: 'var(--accent)',
              color: '#ffffff',
              boxShadow: '0 3px 10px var(--accent-soft)',
            }}
            aria-label="Send"
          >
            <ArrowUp className="w-4 h-4 stroke-[2.4]" />
          </button>
          )}
        </div>
      </div>

      <p
        className="text-center text-[10.5px] pt-1.5 pb-0.5 tracking-tight"
        style={{ color: 'var(--text-3)' }}
      >
        Oh-Matilda can make mistakes. Please double-check responses.
      </p>
    </div>
  );
};
