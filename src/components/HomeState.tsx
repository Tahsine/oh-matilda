import React, { useState } from 'react';
import { RotateCw, Bot, MessageCircle, Lightbulb } from '@/lib/icons';
import { motion } from 'motion/react';
import { PROMPT_POOL } from '@/constants/prompts';

interface HomeStateProps {
  onSelectPrompt: (prompt: string) => void;
}

const PILL_ICONS = [Bot, MessageCircle, Lightbulb];

export const HomeState: React.FC<HomeStateProps> = ({ onSelectPrompt }) => {
  const [poolIdx, setPoolIdx] = useState<number>(0);
  const [spin, setSpin] = useState<number>(0);

  const hour = new Date().getHours();
  const greeting =
    hour >= 5 && hour < 12
      ? 'Good morning,'
      : hour >= 12 && hour < 18
      ? 'Good afternoon,'
      : 'Good evening,';

  const visiblePrompts = [
    PROMPT_POOL[poolIdx % PROMPT_POOL.length],
    PROMPT_POOL[(poolIdx + 1) % PROMPT_POOL.length],
    PROMPT_POOL[(poolIdx + 2) % PROMPT_POOL.length],
  ];

  const handleRefresh = () => {
    setSpin((s) => s + 360);
    setPoolIdx((prev) => prev + 3);
  };

  return (
    <motion.section
      id="home-screen"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.3 }}
      className="pt-10 px-4 text-center"
    >
      <h1
        id="greet-heading"
        className="text-[20px] font-bold leading-[1.32] tracking-tight"
        style={{ color: 'var(--text-1)' }}
      >
        {greeting}
        <br />
        Can I help you with anything?
      </h1>

      <p
        className="text-[13px] mt-3 leading-[1.55] px-3.5"
        style={{ color: 'var(--text-2)' }}
      >
        Choose a prompt below or write your own to start chatting with Oh-Matilda.
      </p>

      <div className="mt-8 flex flex-col gap-2" id="prompt-pills">
        {visiblePrompts.map((promptText, i) => {
          const Icon = PILL_ICONS[i % PILL_ICONS.length];
          return (
            <motion.button
              key={`${poolIdx}-${i}-${promptText}`}
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.25, delay: i * 0.06 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => onSelectPrompt(promptText)}
              className="flex items-center gap-2.5 text-left text-[13px] font-medium leading-[1.45] py-2.5 px-4 border cursor-pointer"
              style={{
                backgroundColor: 'var(--card-bg)',
                borderColor: 'var(--card-border)',
                color: 'var(--text-1)',
                borderRadius: 'var(--radius-lg)',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              <Icon className="w-4 h-4 shrink-0" style={{ color: 'var(--accent)' }} />
              <span className="truncate">{promptText}</span>
            </motion.button>
          );
        })}
      </div>

      <button
        id="btn-refresh-prompts"
        onClick={handleRefresh}
        className="mt-3.5 mx-auto flex items-center gap-1.5 text-[11px] font-medium py-1.5 px-3 rounded-full transition-colors active:bg-[var(--hover)] cursor-pointer active:scale-95"
        style={{ color: 'var(--text-2)' }}
      >
        <motion.span
          animate={{ rotate: spin }}
          transition={{ duration: 0.55, ease: 'easeOut' }}
          className="inline-flex"
        >
          <RotateCw className="w-3.5 h-3.5 stroke-[2.2]" />
        </motion.span>
        <span>Refresh prompts</span>
      </button>
    </motion.section>
  );
};
