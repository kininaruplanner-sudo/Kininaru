'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { SHAPES } from '@/lib/journal-studio/types';

interface ShapePickerProps {
  onSelect: (shape: { type: string }) => void;
  onClose: () => void;
}

export function ShapePicker({ onSelect, onClose }: ShapePickerProps) {
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
      >
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/50" onClick={onClose} />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.2 }}
          className="relative w-full max-w-sm bg-card rounded-2xl border border-border shadow-lg overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border">
            <h2 className="text-sm font-semibold text-foreground">Choisir une forme</h2>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Shapes grid */}
          <div className="p-4 grid grid-cols-5 gap-2">
            {SHAPES.map((shape) => (
              <button
                key={shape.type}
                onClick={() => onSelect(shape)}
                className="aspect-square flex flex-col items-center justify-center gap-1 rounded-xl hover:bg-muted transition-smooth hover:scale-105"
                title={shape.name}
              >
                <span className="text-2xl">{shape.icon}</span>
                <span className="text-[10px] text-muted-foreground">{shape.name}</span>
              </button>
            ))}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
