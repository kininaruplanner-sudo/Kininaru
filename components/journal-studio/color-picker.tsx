'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { COLOR_PALETTES } from '@/lib/journal-studio/colors';

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  onClose: () => void;
}

export function ColorPicker({ value, onChange, onClose }: ColorPickerProps) {
  const [selectedPalette, setSelectedPalette] = useState<string>('Neutre');
  const [customColor, setCustomColor] = useState(value);

  const currentPalette = COLOR_PALETTES.find((p) => p.name === selectedPalette);

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
            <h2 className="text-sm font-semibold text-foreground">Choisir une couleur</h2>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Palettes */}
          <div className="flex gap-2 p-4 pb-2 overflow-x-auto">
            {COLOR_PALETTES.map((palette) => (
              <button
                key={palette.name}
                onClick={() => setSelectedPalette(palette.name)}
                className={cn(
                  'px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-smooth',
                  selectedPalette === palette.name
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                )}
              >
                {palette.name}
              </button>
            ))}
          </div>

          {/* Colors grid */}
          <div className="p-4 pt-2">
            <div className="grid grid-cols-8 gap-2">
              {currentPalette?.colors.map((color) => (
                <button
                  key={color}
                  onClick={() => {
                    onChange(color);
                    onClose();
                  }}
                  className={cn(
                    'w-8 h-8 rounded-lg transition-smooth hover:scale-110',
                    value === color && 'ring-2 ring-primary ring-offset-2'
                  )}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>

          {/* Custom color */}
          <div className="p-4 pt-2 border-t border-border">
            <p className="text-xs text-muted-foreground mb-2">Couleur personnalisée</p>
            <div className="flex gap-2">
              <input
                type="color"
                value={customColor}
                onChange={(e) => setCustomColor(e.target.value)}
                className="w-10 h-10 rounded-lg cursor-pointer"
              />
              <input
                type="text"
                value={customColor}
                onChange={(e) => setCustomColor(e.target.value)}
                className="flex-1 px-3 py-2 rounded-lg border border-border bg-background text-sm font-mono"
                placeholder="#000000"
              />
              <button
                onClick={() => {
                  onChange(customColor);
                  onClose();
                }}
                className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium"
              >
                OK
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
