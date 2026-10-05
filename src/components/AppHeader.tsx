import React from 'react';
import { Menu, MoreVertical } from '@/lib/icons';

interface AppHeaderProps {
  onOpenSidebar: () => void;
  onToggleKebab: () => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  onOpenSidebar,
  onToggleKebab,
}) => {
  return (
    <header
      id="app-header"
      className="px-3 py-1.5 pt-[calc(var(--sat)+6px)] pb-2 flex items-center justify-between shrink-0 select-none z-10"
    >
      <button
        id="btn-sidebar"
        onClick={onOpenSidebar}
        className="w-11 h-11 rounded-xl flex items-center justify-center transition-colors active:bg-[var(--hover)] active:scale-95"
        style={{ color: 'var(--text-2)' }}
        aria-label="Open sidebar"
      >
        <Menu className="w-5 h-5 stroke-[2]" />
      </button>

      <span
        className="text-xs font-semibold tracking-wider uppercase opacity-40"
        style={{ color: 'var(--text-3)' }}
      >
        Oh-Matilda
      </span>

      <button
        id="btn-kebab"
        onClick={onToggleKebab}
        className="w-11 h-11 rounded-xl flex items-center justify-center transition-colors active:bg-[var(--hover)] active:scale-95"
        style={{ color: 'var(--text-2)' }}
        aria-label="More options"
      >
        <MoreVertical className="w-4 h-4" />
      </button>
    </header>
  );
};
