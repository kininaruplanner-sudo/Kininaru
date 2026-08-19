'use client';

import { useRef, useEffect } from 'react';
import {
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TextProperties } from '@/lib/journal-studio/types';
import { FONT_FAMILIES } from '@/lib/journal-studio/types';

interface TextEditorProps {
  properties: TextProperties;
  onUpdate: (updates: Partial<TextProperties>) => void;
}

export function TextEditor({ properties, onUpdate }: TextEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  }, []);

  return (
    <div className="flex flex-col gap-2">
      {/* Formatting toolbar */}
      <div className="flex items-center gap-1 p-1 bg-muted rounded-lg">
        {/* Font family */}
        <select
          value={properties.font_family ?? 'Inter'}
          onChange={(e) => onUpdate({ font_family: e.target.value })}
          className="px-2 py-1 rounded-md text-xs bg-background border border-border"
        >
          {FONT_FAMILIES.map((font) => (
            <option key={font.value} value={font.value}>
              {font.label}
            </option>
          ))}
        </select>

        {/* Font size */}
        <input
          type="number"
          value={properties.font_size ?? 16}
          onChange={(e) => onUpdate({ font_size: Number(e.target.value) })}
          className="w-14 px-2 py-1 rounded-md text-xs bg-background border border-border"
          min={8}
          max={72}
        />

        <div className="w-px h-6 bg-border mx-1" />

        {/* Bold */}
        <button
          onClick={() =>
            onUpdate({
              font_weight: properties.font_weight === 'bold' ? 'normal' : 'bold',
            })
          }
          className={cn(
            'p-1.5 rounded-md transition-smooth',
            properties.font_weight === 'bold'
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-muted'
          )}
        >
          <Bold className="w-4 h-4" />
        </button>

        {/* Italic */}
        <button
          onClick={() =>
            onUpdate({
              font_style: properties.font_style === 'italic' ? 'normal' : 'italic',
            })
          }
          className={cn(
            'p-1.5 rounded-md transition-smooth',
            properties.font_style === 'italic'
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-muted'
          )}
        >
          <Italic className="w-4 h-4" />
        </button>

        {/* Underline */}
        <button
          onClick={() =>
            onUpdate({
              text_decoration: properties.text_decoration === 'underline' ? 'none' : 'underline',
            })
          }
          className={cn(
            'p-1.5 rounded-md transition-smooth',
            properties.text_decoration === 'underline'
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-muted'
          )}
        >
          <Underline className="w-4 h-4" />
        </button>

        <div className="w-px h-6 bg-border mx-1" />

        {/* Alignment */}
        <button
          onClick={() => onUpdate({ text_align: 'left' })}
          className={cn(
            'p-1.5 rounded-md transition-smooth',
            properties.text_align === 'left'
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-muted'
          )}
        >
          <AlignLeft className="w-4 h-4" />
        </button>
        <button
          onClick={() => onUpdate({ text_align: 'center' })}
          className={cn(
            'p-1.5 rounded-md transition-smooth',
            properties.text_align === 'center'
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-muted'
          )}
        >
          <AlignCenter className="w-4 h-4" />
        </button>
        <button
          onClick={() => onUpdate({ text_align: 'right' })}
          className={cn(
            'p-1.5 rounded-md transition-smooth',
            properties.text_align === 'right'
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-muted'
          )}
        >
          <AlignRight className="w-4 h-4" />
        </button>
      </div>

      {/* Textarea */}
      <textarea
        ref={textareaRef}
        value={properties.content}
        onChange={(e) => onUpdate({ content: e.target.value })}
        className="w-full h-32 p-3 rounded-xl border border-border bg-background text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary/20"
        style={{
          fontFamily: properties.font_family,
          fontSize: properties.font_size,
          fontWeight: properties.font_weight,
          fontStyle: properties.font_style,
          textDecoration: properties.text_decoration,
          textAlign: properties.text_align,
          color: properties.color,
          lineHeight: properties.line_height,
          letterSpacing: properties.letter_spacing,
        }}
        placeholder="Écris ton texte ici..."
      />
    </div>
  );
}
