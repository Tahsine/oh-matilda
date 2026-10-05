import React, { useState } from 'react';
import { Bot, ChevronRight, Loader2, Square } from '@/lib/icons';
import { motion } from 'motion/react';
import type { AgentStep, RunTraceEvent } from '@/lib/agentRunner';

/** Forme d'affichage : run live (AgentRunState) ou archive (RunRecord). */
export interface RunDisplay {
  id: string;
  prompt: string;
  status: 'running' | 'done' | 'error' | 'cancelled';
  steps: AgentStep[];
  trace?: RunTraceEvent[];
  summary: string;
  error?: string;
}

interface AgentRunCardProps {
  run: RunDisplay;
  onCancel?: () => void;
  /** Historique : replié par défaut. Live : ouvert. */
  defaultOpen?: boolean;
}

export const AgentRunCard: React.FC<AgentRunCardProps> = ({ run, onCancel, defaultOpen = true }) => {
  const running = run.status === 'running';
  // Trace repliable (pattern Thought) : la réponse reste TOUJOURS dehors.
  const [traceOpen, setTraceOpen] = useState<boolean>(defaultOpen);
  const hasTrace = run.steps.length > 0 || (run.trace && run.trace.length > 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-2 p-3 border shadow-xs"
      style={{
        backgroundColor: 'var(--card-bg)',
        borderColor: 'var(--card-border)',
        borderRadius: 'var(--radius-md)',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <div
        className="flex items-center gap-2 text-[12.5px] font-semibold"
        style={{ color: 'var(--text-1)' }}
      >
        <Bot className="w-4 h-4 shrink-0" style={{ color: 'var(--accent)' }} />
        <span className="flex-1 truncate">{run.prompt}</span>
        {running && onCancel && (
          <button
            onClick={onCancel}
            className="w-11 h-11 -m-2 rounded-[10px] flex items-center justify-center transition-colors active:bg-[var(--hover)] cursor-pointer"
            style={{ color: 'var(--text-1)' }}
            aria-label="Stop agent task"
          >
            <Square className="w-3.5 h-3.5 fill-current" />
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
      {hasTrace && (
        <div className="mt-2 pl-6">
          <button
            onClick={() => setTraceOpen(!traceOpen)}
            className="flex items-center gap-1.5 text-[11px] font-semibold py-0.5 px-1 rounded-md transition-colors active:bg-[var(--hover)] cursor-pointer"
            style={{ color: 'var(--text-2)' }}
            aria-label="Toggle run trace details"
          >
            <ChevronRight
              className={`w-3 h-3 transition-transform duration-200 ${
                traceOpen ? 'rotate-90' : ''
              }`}
            />
            <span>Détails · {run.steps.length} étapes</span>
          </button>

          {traceOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              {run.steps.length > 0 && (
                <div className="mt-1 flex flex-col gap-1 max-h-[132px] overflow-y-auto no-scrollbar">
                  {run.steps.map((st, i) => (
                    <div
                      key={`${run.id}-step-${i}`}
                      className="text-[11px] leading-snug break-words min-w-0"
                      style={{ color: 'var(--text-2)', overflowWrap: 'anywhere' }}
                    >
                      <span className="font-semibold" style={{ color: 'var(--text-1)' }}>
                        {i + 1}. {st.label}
                      </span>{' '}
                      <span className="opacity-80">{st.detail}</span>
                    </div>
                  ))}
                </div>
              )}

              {run.trace && run.trace.length > 0 && (
                <div className="mt-1.5 flex flex-col gap-0.5 max-h-[110px] overflow-y-auto no-scrollbar">
                  {run.trace.map((ev) => (
                    <div
                      key={`${run.id}-trace-${ev.seq}`}
                      className="text-[10.5px] leading-snug break-words min-w-0 font-mono"
                      style={{ color: ev.ok ? 'var(--text-3)' : 'var(--danger)', overflowWrap: 'anywhere' }}
                    >
                      #{ev.seq} {ev.tool} {typeof ev.args === 'object' && ev.args !== null ? JSON.stringify(ev.args).slice(0, 90) : ''}{ev.error ? ` → ${ev.error.slice(0, 90)}` : ''}
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </div>
      )}
    </motion.div>
  );
};
