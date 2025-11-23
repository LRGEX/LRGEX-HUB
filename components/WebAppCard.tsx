
import React from 'react';
import { ExternalLink, Edit2, Trash2, GripHorizontal } from 'lucide-react';
import { WebApp } from '../types';

interface WebAppCardProps {
    app: WebApp;
    editMode: boolean;
    onEdit: (app: WebApp) => void;
    onDelete: (id: string) => void;
    onDragStart?: (e: React.DragEvent, id: string) => void;
    onDrop?: (e: React.DragEvent, targetId: string) => void;
}

export const WebAppCard: React.FC<WebAppCardProps> = ({ app, editMode, onEdit, onDelete, onDragStart, onDrop }) => {
    
    const handleDragStart = (e: React.DragEvent) => {
        if (editMode && onDragStart) {
            onDragStart(e, app.id);
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        if (editMode && onDrop) {
            e.preventDefault(); // Necessary to allow dropping
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        if (editMode && onDrop) {
            e.preventDefault();
            onDrop(e, app.id);
        }
    };

    return (
        <div 
            draggable={editMode}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            className={`bg-lrgex-panel border border-lrgex-border rounded-xl p-4 flex flex-col gap-3 group hover:border-lrgex-hover transition-all relative overflow-hidden h-full ${editMode ? 'cursor-move' : ''}`}
        >
            {editMode && (
                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10 bg-black/50 rounded-lg p-1 backdrop-blur-sm">
                    <button onClick={() => onEdit(app)} className="p-1 text-lrgex-muted hover:text-white hover:bg-lrgex-hover rounded">
                        <Edit2 size={14} />
                    </button>
                    <button onClick={() => onDelete(app.id)} className="p-1 text-lrgex-muted hover:text-red-400 hover:bg-lrgex-hover rounded">
                        <Trash2 size={14} />
                    </button>
                </div>
            )}
            
            {editMode && (
                <div className="absolute top-2 left-2 opacity-0 group-hover:opacity-50 pointer-events-none">
                     <GripHorizontal size={14} className="text-lrgex-muted" />
                </div>
            )}

            <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-black/30 flex items-center justify-center border border-lrgex-border/50 shrink-0">
                        {app.iconUrl ? (
                            <img src={app.iconUrl} alt={app.name} className="w-6 h-6 object-contain" onError={e => e.currentTarget.style.display = 'none'} />
                        ) : (
                            <span className="text-lg font-bold text-lrgex-muted">{app.name.charAt(0)}</span>
                        )}
                    </div>
                    <div>
                        <h3 className="font-bold text-white text-base leading-tight truncate max-w-[150px]" title={app.name}>{app.name}</h3>
                        {/* Removed redundant app name text here */}
                    </div>
                </div>
                <div className="px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-[10px] font-bold text-blue-300">
                    {app.category}
                </div>
            </div>

            {app.description && (
                <p className="text-xs text-lrgex-muted/70 line-clamp-2 min-h-[2.5em]">
                    {app.description}
                </p>
            )}

            <a 
                href={app.url} 
                target="_blank" 
                rel="noopener noreferrer" 
                className={`mt-auto w-full py-2 rounded-lg bg-white text-black font-bold text-sm flex items-center justify-center gap-2 hover:bg-lrgex-orange hover:text-white transition-colors ${editMode ? 'pointer-events-none opacity-50' : ''}`}
            >
                <ExternalLink size={14} /> Open App
            </a>
        </div>
    );
};
