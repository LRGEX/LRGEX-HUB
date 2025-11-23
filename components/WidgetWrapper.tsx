
import React, { useState, useRef, useEffect } from 'react';
import { X, GripHorizontal } from 'lucide-react';

interface WidgetWrapperProps {
  id?: string;
  title?: string;
  onRemove?: () => void;
  editMode: boolean;
  children: React.ReactNode;
  className?: string;
  w?: number;
  h?: number;
  onResize?: (w: number, h: number) => void;
  onMove?: (dragId: string, targetId: string) => void;
}

export const WidgetWrapper: React.FC<WidgetWrapperProps> = ({ 
  id,
  title, 
  onRemove, 
  editMode, 
  children, 
  className = '',
  w = 1,
  h = 1,
  onResize,
  onMove
}) => {
  const [isResizing, setIsResizing] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const startPos = useRef({ x: 0, y: 0 });
  const startSize = useRef({ w: 1, h: 1 });

  // --- Resize Logic ---
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing || !onResize) return;
      e.preventDefault();
      
      const dx = e.clientX - startPos.current.x;
      const dy = e.clientY - startPos.current.y;
      const colStep = 150;
      const rowStep = 150;
      
      const wChange = Math.round(dx / colStep);
      const hChange = Math.round(dy / rowStep);
      
      const newW = Math.max(1, Math.min(4, startSize.current.w + wChange));
      const newH = Math.max(1, Math.min(4, startSize.current.h + hChange));
      
      if (newW !== w || newH !== h) {
        onResize(newW, newH);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.body.style.cursor = 'default';
    };

    if (isResizing) {
      document.body.style.cursor = 'nwse-resize';
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'default';
    };
  }, [isResizing, w, h, onResize]);

  const onResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    startPos.current = { x: e.clientX, y: e.clientY };
    startSize.current = { w: w || 1, h: h || 1 };
    setIsResizing(true);
  };

  // --- Drag & Drop Logic ---
  const handleDragStart = (e: React.DragEvent) => {
    if (!editMode || !id) return;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('widgetId', id);
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (!editMode || !onMove) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    if (!editMode || !onMove || !id) return;
    e.preventDefault();
    setIsDragOver(false);
    const draggedId = e.dataTransfer.getData('widgetId');
    if (draggedId && draggedId !== id) {
      onMove(draggedId, id);
    }
  };

  return (
    <div 
      ref={wrapperRef}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`relative group bg-lrgex-panel border rounded-xl overflow-hidden shadow-sm flex flex-col transition-all duration-200 
        ${className} 
        ${isResizing ? 'ring-2 ring-lrgex-orange z-50 shadow-xl' : ''} 
        ${isDragOver ? 'border-lrgex-orange ring-2 ring-lrgex-orange/50 scale-[1.02]' : 'border-lrgex-border hover:border-lrgex-hover'}
      `}
    >
      {editMode && (
        <button 
          onClick={onRemove}
          className="absolute top-2 right-2 z-20 p-1 bg-red-500/10 text-red-400 rounded-full hover:bg-red-500 hover:text-white transition-colors opacity-0 group-hover:opacity-100"
        >
          <X size={16} />
        </button>
      )}
      
      {title && (
        <div 
          draggable={editMode}
          onDragStart={handleDragStart}
          className={`px-4 py-3 border-b border-lrgex-border flex items-center justify-between bg-lrgex-menu/30 shrink-0 ${editMode ? 'cursor-move active:cursor-grabbing' : ''}`}
        >
          <h3 className="text-xs font-semibold text-lrgex-muted uppercase tracking-wider truncate pr-6 select-none">{title}</h3>
          {editMode && <GripHorizontal size={14} className="text-lrgex-muted/50" />}
        </div>
      )}
      
      {/* Removed p-4 to allow full-bleed widgets */}
      <div className="flex-1 flex flex-col relative overflow-hidden min-h-0">
        {children}
        
        {editMode && onResize && (
          <div 
            className="absolute bottom-0 right-0 w-6 h-6 cursor-nwse-resize z-30 flex items-end justify-end p-1"
            onMouseDown={onResizeStart}
            title="Drag to resize"
          >
             <div className={`w-3 h-3 border-b-2 border-r-2 ${isResizing ? 'border-lrgex-orange scale-125' : 'border-lrgex-muted hover:border-lrgex-orange'} transition-all`}></div>
          </div>
        )}
      </div>
    </div>
  );
};
