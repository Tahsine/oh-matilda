import React from 'react';
import { Bot, Check, Loader2, Square, TriangleAlert } from '@/lib/icons';
import { motion } from 'motion/react';
import type { AgentRunState } from '@/store/chatStore';

interface AgentRunCardProps {
  run: AgentRunState;
  onCancel: () => void;
  onClose: () => void;
}

export const AgentRunCard: React.FC<AgentRunCardProps> = ({ run, onCancel, onClose }) => {
  const running = run.status === 'running';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-3 p-3 rounded-[13px] border shadow-xs"
      style={{
        backgroundColor: 'var(--card-bg)',
        borderColor: 'var(--card-border)',
      }}
    >
      <div
        className="flex items-center gap-2 text-[12.5px] font-semibold"
        style={{ color: 'var(--text-1)' }}
      >
        <Bot className="w-4 h-4 shrink-0" style={{ color: 'var(--accent)' }} />
        <span className="flex-1 truncate">{run.prompt}</span>
        {running ? (
          <button
            onClick={onCancel}
            className="w-11 h-11 -m-2 rounded-[10px] flex items-center justify-center transition-colors active:bg-black/5 cursor-pointer"
            style={{ color: 'var(--text-1)' }}
            aria-label="Stop agent task"
          >
            <Square className="w-3.5 h-3.5 fill-current" />
          </button>
        ) : (
          <button
            onClick={onClose}
            className="text-[11px] font-bold px-2 min-h-[44px] active:opacity-70 cursor-pointer"
            style={{ color: 'var(--text-3)' }}
          >
            Dismiss
          </button>
        )}
      </div>

      {running && (
        <div
          className="flex items-center gap-2 text-[12px] pl-6 mt-1.5"
          style={{ color: 'var(--text-3)' }}
        >
          <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: 'var(--accent)' }} />
          <span>
            {run.steps.length === 0
              ? 'Starting…'
              : run.steps[run.steps.length - 1].label}
          </span>
        </div>
      )}

      {run.steps.length > 0 && (
        <div className="mt-2 pl-6 flex flex-col gap-1 max-h-[132px] overflow-y-auto no-scrollbar">
          {run.steps.map((st, i) => (
            <div
              key={`${run.id}-step-${i}`}
              className="text-[11.5px] leading-snug"
              style={{ color: 'var(--text-2)' }}
            >
              <span className="font-semibold" style={{ color: 'var(--text-1)' }}>
                {i + 1}. {st.label}
              </span>{' '}
              <span className="opacity-80">{st.detail}</span>
            </div>
          ))}
        </div>
      )}

      {(run.beforeShot || run.afterShot) && (
        <div className="flex gap-2 mt-2.5">
          {run.beforeShot && (
            <div className="flex-1 flex flex-col gap-1">
              <img
                src={run.beforeShot}
                alt="Before task"
                className="w-full rounded-[10px] border block"
                style={{ borderColor: 'var(--card-border)' }}
              />
              <span
                className="text-[10px] font-bold text-center uppercase tracking-wider"
                style={{ color: 'var(--text-3)' }}
              >
                Before
              </span>
            </div>
          )}
          {run.afterShot && (
            <div className="flex-1 flex flex-col gap-1">
              <img
                src={run.afterShot}
                alt="After task"
                className="w-full rounded-[10px] border block"
                style={{ borderColor: 'var(--card-border)' }}
              />
              <span
                className="text-[10px] font-bold text-center uppercase tracking-wider"
                style={{ color: 'var(--text-3)' }}
              >
                After
              </span>
            </div>
          )}
        </div>
      )}

      {run.status === 'done' && (
        <div
          className="flex items-center gap-1.5 text-[11.5px] font-medium mt-2.5"
          style={{ color: 'var(--text-2)' }}
        >
          <Check className="w-3.5 h-3.5 stroke-[2.5]" style={{ color: 'var(--accent)' }} />
          <span>{run.summary}</span>
        </div>
      )}

      {run.status === 'cancelled' && (
        <p
          className="text-[11.5px] italic mt-2"
          style={{ color: 'var(--text-3)' }}
        >
          Task stopped — nothing further will run.
        </p>
      )}

      {run.status === 'error' && (
        <p
          className="text-[11.5px] mt-2 flex items-center gap-1.5"
          style={{ color: '#e5484d' }}
        >
          <TriangleAlert className="w-3.5 h-3.5 shrink-0" />
          <span>{run.error || 'Task failed.'}</span>
        </p>
      )}
    </motion.div>
  );
};
