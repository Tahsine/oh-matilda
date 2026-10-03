import React, { useState } from 'react';
import {
  Globe,
  ChevronRight,
  Lightbulb,
  Eye,
  FileText,
  Copy,
  ThumbsUp,
  ThumbsDown,
  RotateCw,
  Loader2,
} from '@/lib/icons';
import { motion } from 'motion/react';
import { SHOW_WEBSEARCH } from '@/lib/flags';
import type { ChatMessage, Scenario } from '@/types';
import { AgentRunCard, type RunDisplay } from './AgentRunCard';
import { SCENARIOS, GENERIC_SCENARIO, getSourcesFor } from '@/constants/scenarios';
import { IMG_DESK } from '@/constants/images';
import { ActionProofCard } from './ActionProofCard';

interface MessageItemProps {
  message: ChatMessage;
  webEnabled?: boolean;
  onToast: (msg: string) => void;
  onOpenFollowUp: (scId?: string) => void;
  onRegenerate: (messageId: string) => void;
  /** Run lié (live ou archive) : carte sous la réponse IA. */
  run?: RunDisplay | null;
  onCancelRun?: () => void;
}

export const MessageItem: React.FC<MessageItemProps> = ({
  message,
  webEnabled = false,
  onToast,
  onRegenerate,
  run,
  onCancelRun,
}) => {
  const [thoughtOpen, setThoughtOpen] = useState<boolean>(false);
  const [liked, setLiked] = useState<boolean>(!!message.liked);
  const [disliked, setDisliked] = useState<boolean>(!!message.disliked);

  const isAi = message.sender === 'ai';
  const sc: Scenario | undefined = message.scId
    ? SCENARIOS[message.scId] || GENERIC_SCENARIO
    : undefined;

  // Format content with tags: **bold**, ==mark==, [[cite:N]]
  const renderFormattedText = (raw?: string) => {
    if (!raw) return null;

    // Split on tags
    const parts = raw.split(/(\*\*[^*]+\*\*|==[^=]+==|\[\[cite:\d+\]\]|\n)/g);

    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={index} className="font-bold">{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith('==') && part.endsWith('==')) {
        return (
          <mark
            key={index}
            className="px-1.5 py-0.5 rounded-md text-inherit"
            style={{ backgroundColor: 'var(--mark-bg)' }}
          >
            {part.slice(2, -2)}
          </mark>
        );
      }
      if (part.startsWith('[[cite:') && part.endsWith(']]')) {
        const citeNum = part.replace('[[cite:', '').replace(']]', '');
        return (
          <button
            key={index}
            onClick={() => {
              const docName = sc?.viewed || 'Reference';
              onToast(`Source [${citeNum}]: ${docName} (simulated)`);
            }}
            className="inline-flex items-center justify-center w-[15px] h-[15px] rounded-full text-[9.5px] font-bold ml-1 align-[1px] transition-transform active:scale-90 cursor-pointer"
            style={{
              backgroundColor: 'var(--accent-soft)',
              color: 'var(--accent)',
            }}
            title={`Citation ${citeNum}`}
          >
            {citeNum}
          </button>
        );
      }
      if (part === '\n') {
        return <br key={index} />;
      }
      return <span key={index}>{part}</span>;
    });
  };

  const handleCopy = () => {
    const textToCopy = (message.rawText || message.text || '')
      .replace(/\[\[cite:\d+\]\]/g, '')
      .replace(/\*\*|==/g, '');

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(textToCopy);
    }
    onToast('Copied to clipboard');
  };

  const handleLike = () => {
    if (liked) {
      setLiked(false);
    } else {
      setLiked(true);
      setDisliked(false);
      onToast('Thanks for your feedback');
    }
  };

  const handleDislike = () => {
    if (disliked) {
      setDisliked(false);
    } else {
      setDisliked(true);
      setLiked(false);
      onToast('Feedback recorded');
    }
  };

  // User message rendering
  if (!isAi) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 7 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="my-3 flex flex-col items-end"
      >
        <div
          className="rounded-[14px] rounded-br-[4px] p-2.5 px-3 max-w-[82%] text-[13.5px] leading-[1.5] text-left shadow-xs"
          style={{
            backgroundColor: 'var(--user-bg)',
            color: 'var(--text-1)',
          }}
        >
          {message.attachments?.photo && (
            <img
              src={IMG_DESK}
              alt="attached photo"
              className="w-full max-h-[150px] object-cover rounded-[10px] mb-1.5 block"
            />
          )}

          {message.attachments?.file && (
            <div
              className="flex items-center gap-1.5 p-2 rounded-[9px] text-[11.5px] font-medium mb-1.5 border"
              style={{
                backgroundColor: 'var(--card-bg)',
                borderColor: 'var(--card-border)',
                color: 'var(--text-1)',
              }}
            >
              <FileText className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--text-2)' }} />
              <span>brief.pdf · 128 KB</span>
            </div>
          )}

          {message.text && <span>{message.text}</span>}
        </div>
      </motion.div>
    );
  }

  // AI message rendering
  const sources = getSourcesFor(message.scId);

  return (
    <motion.div
      initial={{ opacity: 0, y: 7 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="my-3 relative text-[13.5px] leading-[1.58] py-0.5 pb-2"
      style={{ color: 'var(--text-1)' }}
    >
      {/* Meta header block */}
      <div className="flex flex-col gap-1.5 mb-2">
        {/* Thinking spinner if streaming without text yet */}
        {message.isStreaming && !message.rawText && (
          <div
            className="flex items-center gap-2 text-[12px]"
            style={{ color: 'var(--text-3)' }}
          >
            <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: 'var(--accent)' }} />
            <span>Thinking…</span>
          </div>
        )}

        {/* Web Search Sources (masqué : aucun tool réel — voir flags.ts) */}
        {SHOW_WEBSEARCH && webEnabled && (
          <div
            className="flex items-center flex-wrap gap-1.5 text-[12px]"
            style={{ color: 'var(--text-2)' }}
          >
            <div className="flex items-center gap-1">
              <Globe className="w-3.5 h-3.5" />
              <span>Searched the web · 3 sources</span>
            </div>
            <div className="flex items-center gap-1 flex-wrap">
              {sources.map((domain) => (
                <button
                  key={domain}
                  onClick={() => onToast(`Opening ${domain} (simulated)`)}
                  className="inline-flex items-center gap-1 border px-2 py-0.5 rounded-[8px] text-[10.5px] font-semibold transition-colors active:bg-black/5 cursor-pointer"
                  style={{
                    backgroundColor: 'var(--card-bg)',
                    borderColor: 'var(--card-border)',
                    color: 'var(--text-2)',
                  }}
                >
                  {domain}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Expandable Thought Block (mock `sc.thought` ou reasoning réel `message.thinking`) */}
        {(sc?.thought || message.thinking) && (
          <div>
            <button
              onClick={() => setThoughtOpen(!thoughtOpen)}
              className="flex items-center gap-1.5 text-[12px] font-medium py-0.5 px-1 rounded-md transition-colors active:bg-black/5 cursor-pointer"
              style={{ color: 'var(--text-2)' }}
            >
              <ChevronRight
                className={`w-3 h-3 transition-transform duration-200 ${
                  thoughtOpen ? 'rotate-90' : ''
                }`}
              />
              <Lightbulb className="w-3.5 h-3.5" />
              <span>Thought</span>
            </button>

            {thoughtOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="text-[11.5px] italic pl-6 mt-1 overflow-hidden"
                style={{ color: 'var(--text-3)' }}
              >
                {message.thinking || sc?.thought}
              </motion.div>
            )}
          </div>
        )}

        {/* Viewed Document Citation */}
        {sc?.viewed && (
          <div
            className="flex items-center gap-2 text-[12px]"
            style={{ color: 'var(--text-2)' }}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Viewed</span>
            <button
              onClick={() => onToast(`Opening “${sc.viewed}” (simulated)`)}
              className="inline-flex items-center gap-1.5 border px-2 py-0.5 rounded-[8px] text-[11px] font-semibold transition-colors active:bg-black/5 cursor-pointer"
              style={{
                backgroundColor: 'var(--card-bg)',
                borderColor: 'var(--card-border)',
                color: 'var(--text-1)',
              }}
            >
              <FileText className="w-3 h-3" />
              <span>{sc.viewed}</span>
            </button>
          </div>
        )}
      </div>

      {/* Main Text Content */}
      <div className="content break-words min-w-0" style={{ overflowWrap: 'anywhere' }}>
        {renderFormattedText(message.rawText)}
        {message.isStreaming && (
          <span
            className="inline-block w-[2px] h-[1em] ml-0.5 align-[-1px] caret-blink"
            style={{ backgroundColor: 'var(--accent)' }}
          />
        )}

        {/* Embedded Illustration */}
        {sc?.img && !message.isStreaming && (
          <motion.img
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            src={sc.img}
            alt="Visual illustration"
            className="w-full rounded-[14px] border mt-2.5 block"
            style={{ borderColor: 'var(--card-border)' }}
          />
        )}

        {/* Embedded Phone Action Proof Card */}
        {sc?.action && !message.isStreaming && (
          <ActionProofCard action={sc.action} onToast={onToast} />
        )}
      </div>

      {/* Carte run sous la réponse IA, avant la barre d'outils. */}
      {message.sender === 'ai' && run && (
        <AgentRunCard
          run={run}
          onCancel={run.status === 'running' ? onCancelRun : undefined}
          defaultOpen={run.status === 'running'}
        />
      )}

      {/* Actions Toolbar */}
      {!message.isStreaming && message.rawText && (
        <div className="flex items-center gap-0.5 mt-2.5">
          <button
            onClick={handleCopy}
            className="w-11 h-11 rounded-[9px] flex items-center justify-center transition-colors active:bg-black/5 active:scale-95 cursor-pointer"
            style={{ color: 'var(--text-3)' }}
            title="Copy"
            aria-label="Copy message"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={handleLike}
            className={`w-11 h-11 rounded-[9px] flex items-center justify-center transition-colors active:bg-black/5 active:scale-95 cursor-pointer ${
              liked ? 'active' : ''
            }`}
            style={{
              color: liked ? 'var(--accent)' : 'var(--text-3)',
            }}
            title="Good response"
            aria-label="Good response"
          >
            <ThumbsUp className={`w-3.5 h-3.5 ${liked ? 'fill-current' : ''}`} />
          </button>

          <button
            onClick={handleDislike}
            className={`w-11 h-11 rounded-[9px] flex items-center justify-center transition-colors active:bg-black/5 active:scale-95 cursor-pointer ${
              disliked ? 'active' : ''
            }`}
            style={{
              color: disliked ? 'var(--accent)' : 'var(--text-3)',
            }}
            title="Bad response"
            aria-label="Bad response"
          >
            <ThumbsDown className={`w-3.5 h-3.5 ${disliked ? 'fill-current' : ''}`} />
          </button>

          <button
            onClick={() => onRegenerate(message.id)}
            className="w-11 h-11 rounded-[9px] flex items-center justify-center transition-colors active:bg-black/5 active:scale-95 cursor-pointer"
            style={{ color: 'var(--text-3)' }}
            title="Regenerate"
            aria-label="Regenerate response"
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>

          {/* Bouton follow-ups masqué : non implémenté. */}

        </div>
      )}
    </motion.div>
  );
};
