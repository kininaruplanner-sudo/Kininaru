'use client';

import { useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Copy, Trash2, Lock, Unlock, ArrowUp, ArrowDown,
  ChevronsUp, ChevronsDown, CopyPlus,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { JournalElement } from '@/lib/journal-studio/types';
import { devLog } from '@/lib/journal-studio/sync/indexed-db';

interface ContextMenuProps {
  element: JournalElement | null;
  elements: JournalElement[];
  x: number;
  y: number;
  onClose: () => void;
  onDuplicate: (id: string) => void;
  onCopy: (id: string) => void;
  onDelete: (id: string) => void;
  onLock: (id: string, locked: boolean) => void;
  onBringForward: (id: string) => void;
  onSendBackward: (id: string) => void;
  onBringToFront: (id: string) => void;
  onSendToBack: (id: string) => void;
}

export function ContextMenu({
  element, elements, x, y, onClose,
  onDuplicate, onCopy, onDelete, onLock,
  onBringForward, onSendBackward, onBringToFront, onSendToBack,
}: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', keyHandler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', keyHandler);
    };
  }, [onClose]);

  // Clamp menu position to viewport
  useEffect(() => {
    if (!menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (rect.right > vw) menuRef.current.style.left = `${Math.max(0, x - rect.width)}px`;
    if (rect.bottom > vh) menuRef.current.style.top = `${Math.max(0, y - rect.height)}px`;
  }, [x, y]);

  if (!element) return null;

  const isLocked = element.is_locked ?? false;
  const maxZ = Math.max(...elements.map((e) => e.z_index));
  const minZ = Math.min(...elements.map((e) => e.z_index));

  const items = [
    { label: 'Dupliquer', icon: CopyPlus, action: () => onDuplicate(element.id), shortcut: '⌘D' },
    { label: 'Copier', icon: Copy, action: () => onCopy(element.id), shortcut: '⌘C' },
    { divider: true as const },
    { label: isLocked ? 'Déverrouiller' : 'Verrouiller', icon: isLocked ? Unlock : Lock, action: () => onLock(element.id, !isLocked) },
    { divider: true as const },
    { label: 'Mettre devant', icon: ChevronsUp, action: () => onBringToFront(element.id), disabled: element.z_index === maxZ },
    { label: 'Avancer', icon: ArrowUp, action: () => onBringForward(element.id), disabled: element.z_index === maxZ },
    { label: 'Reculer', icon: ArrowDown, action: () => onSendBackward(element.id), disabled: element.z_index === minZ },
    { label: 'Mettre derrière', icon: ChevronsDown, action: () => onSendToBack(element.id), disabled: element.z_index === minZ },
    { divider: true as const },
    { label: 'Supprimer', icon: Trash2, action: () => onDelete(element.id), danger: true, shortcut: 'Suppr' },
  ];

  return (
    <AnimatePresence>
      <motion.div
        ref={menuRef}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.12 }}
        className="fixed z-[200] min-w-[180px] rounded-xl border border-border bg-card shadow-xl p-1"
        style={{ left: x, top: y }}
      >
        {items.map((item, i) => {
          if ('divider' in item) {
            return <div key={`d${i}`} className="my-1 h-px bg-border" />;
          }
          const Icon = item.icon;
          return (
            <button
              key={item.label}
              onClick={() => { item.action(); onClose(); }}
              disabled={item.disabled}
              className={cn(
                'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-smooth text-left',
                item.disabled && 'opacity-40 cursor-not-allowed',
                item.danger ? 'text-destructive hover:bg-destructive/10' : 'text-foreground hover:bg-muted',
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="flex-1">{item.label}</span>
              {item.shortcut && <span className="text-[10px] text-muted-foreground">{item.shortcut}</span>}
            </button>
          );
        })}
      </motion.div>
    </AnimatePresence>
  );
}

/**
 * Hook to handle right-click on canvas elements.
 */
export function useContextMenu(
  _onContextMenuAction?: (action: string, elementId: string) => void
) {
  const handleContextMenu = useCallback((e: React.MouseEvent, elementId: string) => {
    e.preventDefault();
    e.stopPropagation();
    devLog('CONTEXT', `Right-click on element ${elementId}`);
    // The parent will manage the context menu state
  }, []);

  return { handleContextMenu };
}
