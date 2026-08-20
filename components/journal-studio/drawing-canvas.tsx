'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface DrawingCanvasProps {
  pageId: string;
  color: string;
  size: number;
  onComplete: (drawing: {
    points: [number, number, number][];
    color: string;
    size: number;
  }) => void;
  onCancel: () => void;
}

type Tool = 'pen' | 'pencil' | 'highlighter' | 'eraser';

export function DrawingCanvas({ pageId: _pageId, color, size, onComplete, onCancel }: DrawingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tool, setTool] = useState<Tool>('pen');
  const [isDrawing, setIsDrawing] = useState(false);
  const [points, setPoints] = useState<[number, number, number][]>([]);
  const lastPoint = useRef<[number, number, number] | null>(null);

  // Get canvas coordinates from pointer event
  const getCanvasPoint = useCallback((e: React.PointerEvent): [number, number, number] => {
    const canvas = canvasRef.current;
    if (!canvas) return [0, 0, 0];

    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height);
    const pressure = e.pressure || 0.5;

    return [x, y, pressure];
  }, []);

  // Draw on canvas
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw all points
    if (points.length < 2) return;

    ctx.beginPath();
    ctx.strokeStyle = tool === 'eraser' ? '#ffffff' : color;
    ctx.lineWidth = tool === 'eraser' ? size * 3 : size;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalAlpha = tool === 'highlighter' ? 0.4 : 1;

    ctx.moveTo(points[0][0], points[0][1]);

    for (let i = 1; i < points.length; i++) {
      const [x, y, pressure] = points[i];
      const [prevX, prevY] = points[i - 1];

      // Use quadratic curve for smoother lines
      const midX = (prevX + x) / 2;
      const midY = (prevY + y) / 2;

      ctx.quadraticCurveTo(prevX, prevY, midX, midY);

      // Adjust width based on pressure (for pen tool)
      if (tool === 'pen' && pressure) {
        ctx.lineWidth = size * (0.5 + pressure * 0.5);
      }
    }

    ctx.stroke();
  }, [points, color, size, tool]);

  useEffect(() => {
    draw();
  }, [draw]);

  // Handle pointer events
  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      setIsDrawing(true);
      const point = getCanvasPoint(e);
      setPoints([point]);
      lastPoint.current = point;
    },
    [getCanvasPoint]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDrawing) return;

      const point = getCanvasPoint(e);
      setPoints((prev) => [...prev, point]);
      lastPoint.current = point;
    },
    [isDrawing, getCanvasPoint]
  );

  const handlePointerUp = useCallback(() => {
    setIsDrawing(false);
    lastPoint.current = null;
  }, []);

  // Complete drawing
  const handleComplete = () => {
    if (points.length < 2) {
      onCancel();
      return;
    }

    onComplete({
      points,
      color,
      size,
    });
  };

  // Clear canvas
  const handleClear = () => {
    setPoints([]);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <h2 className="text-sm font-semibold text-foreground">Mode dessin</h2>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Annuler
          </Button>
          <Button size="sm" onClick={handleComplete}>
            Valider
          </Button>
        </div>
      </div>

      {/* Tools */}
      <div className="flex items-center justify-center gap-2 p-4 border-b border-border">
        <button
          onClick={() => setTool('pen')}
          className={cn(
            'px-4 py-2 rounded-xl text-sm font-medium transition-smooth',
            tool === 'pen'
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground hover:bg-muted/80'
          )}
        >
          ✏️ Stylo
        </button>
        <button
          onClick={() => setTool('pencil')}
          className={cn(
            'px-4 py-2 rounded-xl text-sm font-medium transition-smooth',
            tool === 'pencil'
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground hover:bg-muted/80'
          )}
        >
          🖊️ Crayon
        </button>
        <button
          onClick={() => setTool('highlighter')}
          className={cn(
            'px-4 py-2 rounded-xl text-sm font-medium transition-smooth',
            tool === 'highlighter'
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground hover:bg-muted/80'
          )}
        >
          🖍️ Surligneur
        </button>
        <button
          onClick={() => setTool('eraser')}
          className={cn(
            'px-4 py-2 rounded-xl text-sm font-medium transition-smooth',
            tool === 'eraser'
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground hover:bg-muted/80'
          )}
        >
          🧹 Gomme
        </button>

        <div className="w-px h-8 bg-border mx-2" />

        {/* Color indicator */}
        <div
          className="w-8 h-8 rounded-lg border-2 border-border"
          style={{ backgroundColor: color }}
        />

        {/* Size indicator */}
        <span className="text-xs text-muted-foreground">{size}px</span>

        <div className="w-px h-8 bg-border mx-2" />

        <button
          onClick={handleClear}
          className="px-4 py-2 rounded-xl text-sm font-medium bg-muted text-muted-foreground hover:bg-muted/80 transition-smooth"
        >
          Effacer tout
        </button>
      </div>

      {/* Canvas */}
      <div className="flex-1 overflow-auto flex items-center justify-center p-8 bg-muted/30">
        <canvas
          ref={canvasRef}
          width={595}
          height={842}
          className="bg-white shadow-lg rounded-lg cursor-crosshair"
          style={{ touchAction: 'none' }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        />
      </div>
    </div>
  );
}
