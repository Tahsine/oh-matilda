import React, { useState, useRef } from 'react';
import { X, Search, SquarePen, Star, Trash2 } from '@/lib/icons';
import { motion, AnimatePresence } from 'motion/react';
import type { ConversationHistoryItem } from '@/types';

interface ConversationListProps {
  isOpen: boolean;
  onClose: () => void;
  conversations: ConversationHistoryItem[];
  activeConvId: string | null;
  onSelectConversation: (conv: ConversationHistoryItem) => void;
  onToggleFav: (convId: string) => void;
  onDeleteConversation?: (convId: string) => void;
  onNewChat: () => void;
}

interface ConversationItemProps {
  conv: ConversationHistoryItem;
  isActive: boolean;
  onSelect: () => void;
  onToggleFav: () => void;
  onRequestDelete: (conv: ConversationHistoryItem) => void;
}

const ConversationItem: React.FC<ConversationItemProps> = ({
  conv,
  isActive,
  onSelect,
  onToggleFav,
  onRequestDelete,
}) => {
  const [isPressing, setIsPressing] = useState<boolean>(false);
  const timerRef = useRef<number | null>(null);
  const startPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const longPressTriggeredRef = useRef<boolean>(false);

  const lastAi = conv.messages.filter((m) => m.sender === 'ai').slice(-1)[0];
  const preview = lastAi
    ? (lastAi.rawText || '').replace(/\*\*|==/g, '').slice(0, 50)
    : '';

  const cancelPress = () => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setIsPressing(false);
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;

    longPressTriggeredRef.current = false;
    startPosRef.current = { x: e.clientX, y: e.clientY };
    setIsPressing(true);

    timerRef.current = window.setTimeout(() => {
      longPressTriggeredRef.current = true;
      setIsPressing(false);
      try {
        navigator.vibrate?.(40);
      } catch {
        // ignore
      }
      onRequestDelete(conv);
    }, 550);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!timerRef.current) return;
    const dist = Math.hypot(
      e.clientX - startPosRef.current.x,
      e.clientY - startPosRef.current.y
    );
    if (dist > 8) {
      cancelPress();
    }
  };

  const handlePointerUp = () => {
    const wasLongPress = longPressTriggeredRef.current;
    cancelPress();
    if (!wasLongPress) {
      onSelect();
    }
  };

  const handlePointerCancel = () => {
    cancelPress();
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    cancelPress();
    onRequestDelete(conv);
  };

  return (
    <div
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onContextMenu={handleContextMenu}
      className={`relative overflow-hidden rounded-[12px] select-none my-0.5 flex items-center gap-1.5 p-2 cursor-pointer transition-all border ${
        isActive
          ? 'border-[var(--card-border)] bg-[var(--hover)]'
          : 'border-transparent'
      } ${isPressing ? 'scale-[0.985] bg-[var(--hover)]' : ''}`}
      style={{
        backgroundColor: isActive || isPressing ? 'var(--hover)' : 'var(--screen-bg)',
      }}
    >
      {/* Animated hold progress bar indicator */}
      {isPressing && (
        <motion.div
          initial={{ width: '0%' }}
          animate={{ width: '100%' }}
          transition={{ duration: 0.55, ease: 'linear' }}
          className="absolute bottom-0 left-0 h-[2.5px] bg-rose-500 rounded-b-[12px] pointer-events-none"
        />
      )}

      <div className="flex-1 min-w-0 pointer-events-none">
        <div
          className="text-[12.5px] font-semibold truncate flex items-center gap-1.5"
          style={{ color: 'var(--text-1)' }}
        >
          <span className="truncate">{conv.title}</span>
        </div>
        <div
          className="text-[10.5px] truncate mt-0.5"
          style={{ color: 'var(--text-3)' }}
        >
          {preview || 'Empty chat'}
        </div>
      </div>

      <div className="flex flex-col items-center gap-1 shrink-0">
        <span className="text-[9.5px]" style={{ color: 'var(--text-3)' }}>
          {conv.time}
        </span>
        <button
          type="button"
          onPointerDown={(e) => {
            e.stopPropagation();
          }}
          onPointerUp={(e) => {
            e.stopPropagation();
          }}
          onPointerMove={(e) => {
            e.stopPropagation();
          }}
          onClick={(e) => {
            e.stopPropagation();
            onToggleFav();
          }}
          className="w-11 h-11 -m-1 rounded-[8px] flex items-center justify-center transition-colors cursor-pointer active:bg-black/5 relative z-10"
          style={{ color: conv.fav ? 'var(--star)' : 'var(--text-3)' }}
          aria-label={conv.fav ? 'Remove from favourites' : 'Add to favourites'}
        >
          <Star className={`w-3.5 h-3.5 ${conv.fav ? 'fill-current' : ''}`} />
        </button>
      </div>
    </div>
  );
};

export const ConversationList: React.FC<ConversationListProps> = ({
  isOpen,
  onClose,
  conversations,
  activeConvId,
  onSelectConversation,
  onToggleFav,
  onDeleteConversation,
  onNewChat,
}) => {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [convToDelete, setConvToDelete] = useState<ConversationHistoryItem | null>(null);

  const filtered = conversations.filter((c) =>
    c.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const favList = filtered.filter((c) => c.fav);
  const regularList = filtered.filter((c) => !c.fav);

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              onClick={onClose}
              className="absolute inset-0 z-40 backdrop-blur-xs cursor-pointer"
              style={{ backgroundColor: 'var(--backdrop)' }}
            />

            {/* Drawer */}
            <motion.aside
              id="sidebar-drawer"
              initial={{ x: '-103%' }}
              animate={{ x: 0 }}
              exit={{ x: '-103%' }}
              transition={{ type: 'spring', stiffness: 380, damping: 34 }}
              className="absolute top-0 bottom-0 left-0 w-[84%] max-w-[304px] z-[45] flex flex-col border-r shadow-2xl overflow-hidden"
              style={{
                backgroundColor: 'var(--screen-bg)',
                borderColor: 'var(--card-border)',
              }}
            >
              {/* Drawer Header */}
              <div className="flex items-center justify-between pt-[calc(var(--sat)+12px)] pb-2 px-3">
                <div className="flex items-center gap-2 pl-1.5">
                  <span className="text-[15px] font-bold tracking-tight" style={{ color: 'var(--text-1)' }}>
                    Oh-Matilda
                  </span>
                  <span
                    className="text-[9.5px] font-semibold px-2 py-0.5 rounded-full tracking-wider"
                    style={{
                      backgroundColor: 'var(--accent-soft)',
                      color: 'var(--accent)',
                    }}
                  >
                    BETA
                  </span>
                </div>

                <button
                  onClick={onClose}
                  className="w-11 h-11 -m-1.5 rounded-[11px] flex items-center justify-center transition-colors active:bg-black/5 cursor-pointer"
                  style={{ color: 'var(--text-2)' }}
                  aria-label="Close sidebar"
                >
                  <X className="w-4 h-4 stroke-[2.2]" />
                </button>
              </div>

              {/* Search Input */}
              <div
                className="mx-3 my-2 flex items-center gap-2 px-2.5 py-2 rounded-[11px] border"
                style={{
                  backgroundColor: 'var(--hover)',
                  borderColor: 'var(--card-border)',
                  color: 'var(--text-3)',
                }}
              >
                <Search className="w-3.5 h-3.5 shrink-0 stroke-[2.2]" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search conversations"
                  className="flex-1 bg-transparent border-none outline-none text-[12.5px]"
                  style={{ color: 'var(--text-1)' }}
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="text-[11px] font-semibold opacity-60 min-h-[44px] px-2 active:opacity-100"
                  >
                    Clear
                  </button>
                )}
              </div>

              {/* New Chat Button */}
              <button
                onClick={() => {
                  onNewChat();
                  onClose();
                }}
                className="mx-3 mb-2 flex items-center justify-center gap-2 py-2.5 px-3 rounded-[12px] text-[12.5px] font-semibold text-white shadow-xs transition-all active:scale-[0.98] cursor-pointer"
                style={{ backgroundColor: 'var(--accent)' }}
              >
                <SquarePen className="w-3.5 h-3.5 stroke-[2.2]" />
                <span>New chat</span>
              </button>

              {/* Long-press help hint */}
              <div
                className="px-3 pb-1 text-[10.5px] flex items-center justify-between"
                style={{ color: 'var(--text-3)' }}
              >
                <span className="opacity-80">Hold a conversation to delete</span>
              </div>

              {/* Scrollable list */}
              <div className="flex-1 overflow-y-auto px-2 pb-[calc(var(--sab)+16px)] no-scrollbar">
                {/* Automations section */}
                <div id="secAuto" className="mb-2">
                  <div
                    className="text-[10px] font-bold tracking-widest uppercase px-2 mb-1"
                    style={{ color: 'var(--text-3)' }}
                  >
                    Automations
                  </div>
                  <div
                    id="autoList"
                    className="text-[12px] px-2 pt-1.5 pb-3.5"
                    style={{ color: 'var(--text-3)' }}
                  >
                    Coming soon
                  </div>
                </div>

                {/* Favourites Section */}
                {favList.length > 0 && (
                  <div className="mb-3">
                    <div
                      className="text-[10px] font-bold tracking-widest uppercase px-2 mb-1.5"
                      style={{ color: 'var(--text-3)' }}
                    >
                      Favourites
                    </div>
                    <div className="flex flex-col gap-0.5">
                      {favList.map((c) => (
                        <ConversationItem
                          key={c.id}
                          conv={c}
                          isActive={c.id === activeConvId}
                          onSelect={() => {
                            onSelectConversation(c);
                            onClose();
                          }}
                          onToggleFav={() => onToggleFav(c.id)}
                          onRequestDelete={(item) => setConvToDelete(item)}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* All Conversations */}
                {regularList.length > 0 && (
                  <div className="mb-3">
                    <div
                      className="text-[10px] font-bold tracking-widest uppercase px-2 mb-1.5"
                      style={{ color: 'var(--text-3)' }}
                    >
                      Conversations
                    </div>
                    <div className="flex flex-col gap-0.5">
                      {regularList.map((c) => (
                        <ConversationItem
                          key={c.id}
                          conv={c}
                          isActive={c.id === activeConvId}
                          onSelect={() => {
                            onSelectConversation(c);
                            onClose();
                          }}
                          onToggleFav={() => onToggleFav(c.id)}
                          onRequestDelete={(item) => setConvToDelete(item)}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {filtered.length === 0 && (
                  <div className="text-[11.5px] italic p-3" style={{ color: 'var(--text-3)' }}>
                    No conversations match “{searchTerm}”.
                  </div>
                )}
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Dialog Modal */}
      <AnimatePresence>
        {convToDelete && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setConvToDelete(null)}
              className="absolute inset-0 bg-black/50 backdrop-blur-xs cursor-pointer"
            />

            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="delete-dialog-title"
              initial={{ opacity: 0, scale: 0.92, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 8 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              className="relative w-full max-w-[320px] rounded-[18px] p-5 shadow-2xl border"
              style={{
                backgroundColor: 'var(--screen-bg)',
                borderColor: 'var(--card-border)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex flex-col items-center text-center">
                <div className="w-11 h-11 rounded-full bg-rose-500/12 text-rose-500 flex items-center justify-center mb-3">
                  <Trash2 className="w-5 h-5 stroke-[2.2]" />
                </div>

                <h3
                  id="delete-dialog-title"
                  className="text-[15px] font-bold tracking-tight mb-1"
                  style={{ color: 'var(--text-1)' }}
                >
                  Delete conversation?
                </h3>

                <p
                  className="text-[12px] leading-relaxed mb-5"
                  style={{ color: 'var(--text-2)' }}
                >
                  Are you sure you want to delete{' '}
                  <span className="font-semibold text-[var(--text-1)]">
                    “{convToDelete.title}”
                  </span>
                  ? This conversation and all its messages will be permanently removed.
                </p>

                <div className="flex items-center gap-2.5 w-full">
                  <button
                    type="button"
                    onClick={() => setConvToDelete(null)}
                    className="flex-1 py-2.5 px-3 rounded-[11px] text-[12.5px] font-semibold transition-colors cursor-pointer border"
                    style={{
                      backgroundColor: 'var(--hover)',
                      borderColor: 'var(--card-border)',
                      color: 'var(--text-2)',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const id = convToDelete.id;
                      setConvToDelete(null);
                      if (onDeleteConversation) {
                        onDeleteConversation(id);
                      }
                    }}
                    className="flex-1 py-2.5 px-3 rounded-[11px] text-[12.5px] font-semibold text-white bg-rose-500 active:bg-rose-700 transition-colors shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5 stroke-[2.2]" />
                    <span>Delete</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
