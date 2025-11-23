
import React, { useState, useRef, useEffect } from 'react';
import { LinkCategory, LinkItem } from '../types';
import { ExternalLink, Trash2, Plus, X, Check, Pencil, Image, GripHorizontal, Upload } from 'lucide-react';

interface LinkGroupProps {
  category: LinkCategory;
  editMode: boolean;
  onDeleteCategory: (id: string) => void;
  onAddLink: (categoryId: string, link: LinkItem) => void;
  onRemoveLink: (categoryId: string, linkId: string) => void;
  onUpdateLink: (categoryId: string, linkId: string, title: string, url: string, iconUrl?: string) => void;
  onUpdateCategory: (categoryId: string, title: string, iconUrl?: string) => void;
  onMoveLink: (sourceCatId: string, targetCatId: string, linkId: string) => void;
  w?: number;
  h?: number;
  onResize?: (w: number, h: number) => void;
  onMoveCategory?: (dragId: string, targetId: string) => void;
  className?: string;
}

export const LinkGroup: React.FC<LinkGroupProps> = ({ 
    category, 
    editMode, 
    onDeleteCategory, 
    onAddLink, 
    onRemoveLink,
    onUpdateLink,
    onUpdateCategory,
    onMoveLink,
    w = 1,
    h = 1,
    onResize,
    onMoveCategory,
    className = ''
}) => {
    // State for adding new link
    const [isAdding, setIsAdding] = useState(false);
    const [newLinkTitle, setNewLinkTitle] = useState('');
    const [newLinkUrl, setNewLinkUrl] = useState('');
    const [newLinkIcon, setNewLinkIcon] = useState('');

    // State for deleting category
    const [confirmDelete, setConfirmDelete] = useState(false);

    // State for editing specific link
    const [editingLinkId, setEditingLinkId] = useState<string | null>(null);
    const [editTitle, setEditTitle] = useState('');
    const [editUrl, setEditUrl] = useState('');
    const [editIcon, setEditIcon] = useState('');

    // State for editing category icon
    const [editingCategoryIcon, setEditingCategoryIcon] = useState(false);
    const [newCategoryIcon, setNewCategoryIcon] = useState(category.iconUrl || '');

    // Drag and Drop state
    const [isDragOver, setIsDragOver] = useState(false);

    // Resize State
    const [isResizing, setIsResizing] = useState(false);
    const startPos = useRef({ x: 0, y: 0 });
    const startSize = useRef({ w: 1, h: 1 });

    // Helper: Convert File to Base64
    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, setter: (val: string) => void) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Limit size to avoid massive config files (e.g., 1MB limit recommended)
        if (file.size > 1024 * 1024 * 2) {
            alert("Image is too large. Please choose an image under 2MB.");
            return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
            if (typeof reader.result === 'string') {
                setter(reader.result);
            }
        };
        reader.readAsDataURL(file);
        // Reset input so same file can be selected again if needed
        e.target.value = '';
    };

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
        startSize.current = { w: w, h: h };
        setIsResizing(true);
    };

    const handleAdd = () => {
        if(newLinkTitle && newLinkUrl) {
            onAddLink(category.id, {
                id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString() + Math.random(),
                title: newLinkTitle,
                url: newLinkUrl.startsWith('http') ? newLinkUrl : `https://${newLinkUrl}`,
                iconUrl: newLinkIcon
            });
            setNewLinkTitle('');
            setNewLinkUrl('');
            setNewLinkIcon('');
            setIsAdding(false);
        }
    };

    const startEditingLink = (link: LinkItem) => {
        setEditingLinkId(link.id);
        setEditTitle(link.title);
        setEditUrl(link.url);
        setEditIcon(link.iconUrl || '');
    };

    const saveEditedLink = (linkId: string) => {
        onUpdateLink(category.id, linkId, editTitle, editUrl, editIcon);
        setEditingLinkId(null);
    };

    const saveCategoryIcon = () => {
        onUpdateCategory(category.id, category.title, newCategoryIcon);
        setEditingCategoryIcon(false);
    };

    const handleDeleteClick = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (confirmDelete) {
            onDeleteCategory(category.id);
        } else {
            setConfirmDelete(true);
        }
    };

    const handleCancelDelete = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setConfirmDelete(false);
    };

    // --- Drag Handlers ---
    const handleLinkDragStart = (e: React.DragEvent, linkId: string) => {
        if (!editMode) return;
        e.stopPropagation(); 
        e.dataTransfer.setData('linkId', linkId);
        e.dataTransfer.setData('sourceCatId', category.id);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleCategoryDragStart = (e: React.DragEvent) => {
        if (!editMode || !onMoveCategory) return;
        e.dataTransfer.setData('categoryId', category.id);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e: React.DragEvent) => {
        if (!editMode) return;
        e.preventDefault();
        setIsDragOver(true);
    };

    const handleDragLeave = () => {
        setIsDragOver(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        if (!editMode) return;
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);
        
        const linkId = e.dataTransfer.getData('linkId');
        const sourceCatId = e.dataTransfer.getData('sourceCatId');
        const draggedCatId = e.dataTransfer.getData('categoryId');

        if (linkId && sourceCatId) {
             if (sourceCatId !== category.id) {
                onMoveLink(sourceCatId, category.id, linkId);
             }
        } else if (draggedCatId && onMoveCategory) {
             if (draggedCatId !== category.id) {
                 onMoveCategory(draggedCatId, category.id);
             }
        }
    };

    const getGridClasses = () => {
        switch (w) {
            case 4: return 'grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8';
            case 3: return 'grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6';
            case 2: return 'grid-cols-1 sm:grid-cols-3 md:grid-cols-4';
            default: return 'grid-cols-1 sm:grid-cols-2';
        }
    };

  return (
    <div 
        className={`bg-lrgex-panel border rounded-xl flex flex-col relative transition-all duration-200
            ${className}
            ${isResizing ? 'ring-2 ring-lrgex-orange z-50 shadow-xl' : ''} 
            ${isDragOver ? 'border-lrgex-orange bg-lrgex-orange/5 scale-[1.02] shadow-xl ring-2 ring-lrgex-orange/50' : 'border-lrgex-border hover:bg-lrgex-hover/20'}
        `}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
    >
      
      {/* Category Header - Draggable Area */}
      <div 
        className={`flex justify-between items-center px-5 py-3 border-b border-lrgex-border shrink-0 ${editMode ? 'cursor-move active:cursor-grabbing' : ''}`}
        draggable={editMode}
        onDragStart={handleCategoryDragStart}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0 pointer-events-auto" onMouseDown={e => e.stopPropagation()}>
            {/* Category Icon */}
            {category.iconUrl && !editingCategoryIcon && (
                 <img 
                    src={category.iconUrl} 
                    className="w-[25px] h-[25px] object-contain select-none" 
                    onError={(e) => e.currentTarget.style.display = 'none'}
                    draggable={false}
                />
            )}
            
            {editMode && editingCategoryIcon ? (
                 <div className="flex items-center gap-1 flex-1">
                    <div className="flex-1 flex items-center gap-1 bg-lrgex-bg border border-lrgex-border rounded px-1">
                        <input 
                            className="flex-1 bg-transparent text-xs text-lrgex-text outline-none min-w-0"
                            placeholder="URL or Upload ->"
                            value={newCategoryIcon}
                            onChange={e => setNewCategoryIcon(e.target.value)}
                            autoFocus
                        />
                        <label className="cursor-pointer text-lrgex-muted hover:text-lrgex-orange p-1">
                            <Upload size={12} />
                            <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, setNewCategoryIcon)} />
                        </label>
                    </div>
                    <button onClick={saveCategoryIcon} className="text-emerald-400"><Check size={14}/></button>
                    <button onClick={() => setEditingCategoryIcon(false)} className="text-lrgex-muted"><X size={14}/></button>
                 </div>
            ) : (
                 <h3 className="font-bold text-lrgex-text truncate mr-2 select-none text-[18px]">{category.title}</h3>
            )}
            
            {editMode && !editingCategoryIcon && (
                <button 
                    onClick={() => { setNewCategoryIcon(category.iconUrl || ''); setEditingCategoryIcon(true); }} 
                    className="text-lrgex-muted/30 hover:text-lrgex-text"
                    title="Edit Icon"
                >
                    <Image size={12} />
                </button>
            )}
        </div>

        {/* Category Actions */}
        {editMode && (
          <div className="flex items-center gap-2 z-10 ml-2 shrink-0 pointer-events-auto" onMouseDown={e => e.stopPropagation()}>
              <GripHorizontal size={14} className="text-lrgex-muted/50" />
              {confirmDelete ? (
                  <>
                    <button 
                        type="button"
                        onClick={handleDeleteClick}
                        className="bg-red-500 text-white text-[10px] px-2 py-1 rounded hover:bg-red-600 transition-colors animate-in fade-in duration-200"
                    >
                        Delete?
                    </button>
                    <button 
                        type="button"
                        onClick={handleCancelDelete}
                        className="text-lrgex-muted hover:text-lrgex-text p-1"
                    >
                        <X size={14} />
                    </button>
                  </>
              ) : (
                  <button 
                    type="button"
                    onClick={handleDeleteClick} 
                    className="text-lrgex-muted hover:text-red-400 p-1 hover:bg-lrgex-bg rounded cursor-pointer transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
              )}
          </div>
        )}
      </div>

      {/* Links List - Content */}
      <div className={`grid ${getGridClasses()} gap-2 content-start flex-1 p-2 overflow-y-auto custom-scrollbar`}>
        {category.links.map((link) => {
          const isEditing = editingLinkId === link.id;

          if (isEditing) {
              return (
                <div key={link.id} className="flex flex-col gap-2 p-2 bg-lrgex-bg/50 rounded-lg border border-lrgex-orange/50 z-20 absolute inset-x-2">
                    <input 
                        className="bg-lrgex-panel border border-lrgex-border rounded px-2 py-1 text-xs text-lrgex-text focus:border-lrgex-orange outline-none"
                        placeholder="Title"
                        value={editTitle}
                        onChange={e => setEditTitle(e.target.value)}
                    />
                    <input 
                        className="bg-lrgex-panel border border-lrgex-border rounded px-2 py-1 text-xs text-lrgex-text focus:border-lrgex-orange outline-none"
                        placeholder="URL"
                        value={editUrl}
                        onChange={e => setEditUrl(e.target.value)}
                    />
                    <div className="flex items-center gap-2 bg-lrgex-panel border border-lrgex-border rounded px-2 py-1">
                         <input 
                            className="flex-1 bg-transparent text-xs text-lrgex-text outline-none min-w-0"
                            placeholder="Icon URL"
                            value={editIcon}
                            onChange={e => setEditIcon(e.target.value)}
                        />
                        <label className="cursor-pointer text-lrgex-muted hover:text-lrgex-orange">
                            <Upload size={12} />
                            <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, setEditIcon)} />
                        </label>
                    </div>

                    <div className="flex gap-2 mt-1">
                        <button onClick={() => saveEditedLink(link.id)} className="flex-1 bg-lrgex-orange text-white text-xs py-1 rounded hover:bg-orange-600 flex items-center justify-center gap-1"><Check size={12}/> Save</button>
                        <button onClick={() => setEditingLinkId(null)} className="flex-1 bg-lrgex-hover text-lrgex-text text-xs py-1 rounded hover:bg-lrgex-menu">Cancel</button>
                    </div>
                </div>
              );
          }

          return (
            <div 
                key={link.id} 
                draggable={editMode}
                onDragStart={(e) => handleLinkDragStart(e, link.id)}
                className={`group flex items-center justify-between px-3 py-1 rounded hover:bg-lrgex-hover transition-all border border-transparent hover:border-lrgex-border min-h-[2.5rem] h-auto
                    ${editMode ? 'cursor-grab active:cursor-grabbing' : ''}
                `}
            >
                <a 
                href={link.url} 
                target="_blank" 
                rel="noopener noreferrer" 
                className={`flex items-center gap-3 flex-1 overflow-hidden ${editMode ? 'pointer-events-none' : ''}`}
                >
                    {link.iconUrl ? (
                        <>
                            <img 
                                src={link.iconUrl} 
                                alt="" 
                                className="w-[22px] h-[22px] object-contain shrink-0" 
                                onError={(e) => {
                                    e.currentTarget.style.display = 'none';
                                    e.currentTarget.nextElementSibling?.classList.remove('hidden');
                                }}
                            />
                            <div className="w-1.5 h-1.5 rounded-full bg-lrgex-orange shrink-0 hidden"></div>
                        </>
                    ) : (
                        <div className="w-1.5 h-1.5 rounded-full bg-lrgex-orange shrink-0 group-hover:shadow-[0_0_8px_rgba(247,99,46,0.6)] transition-shadow"></div>
                    )}
                    
                    <span className="text-lrgex-muted group-hover:text-lrgex-text text-[16px] font-medium transition-colors break-words whitespace-normal">{link.title}</span>
                    {!editMode && <ExternalLink size={12} className="opacity-0 group-hover:opacity-100 transition-opacity text-lrgex-muted shrink-0 ml-2" />}
                </a>
                
                {editMode && (
                    <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => startEditingLink(link)} className="text-lrgex-muted hover:text-lrgex-text px-1">
                            <Pencil size={12} />
                        </button>
                        <button onClick={() => onRemoveLink(category.id, link.id)} className="text-lrgex-muted hover:text-red-400 px-1">
                            <Trash2 size={12} />
                        </button>
                    </div>
                )}
            </div>
          );
        })}
        
      </div>

      {/* Footer / Add Button Area */}
      <div className="p-2 mt-auto border-t border-lrgex-border/50 bg-lrgex-panel rounded-b-xl">
        {editMode && !isAdding && (
            <button 
                onClick={() => setIsAdding(true)}
                className="w-full py-1.5 border border-dashed border-lrgex-border text-lrgex-muted rounded hover:border-lrgex-muted hover:text-lrgex-text text-[10px] flex items-center justify-center gap-1 transition-all uppercase tracking-wide"
            >
                <Plus size={12} /> Add Link
            </button>
        )}

        {editMode && isAdding && (
            <div className="bg-lrgex-bg/50 p-2 rounded border border-lrgex-border space-y-2 relative">
                <button onClick={() => setIsAdding(false)} className="absolute -top-2 -right-2 bg-lrgex-panel border border-lrgex-border rounded-full p-0.5 text-lrgex-muted"><X size={10}/></button>
                <input 
                    className="w-full bg-lrgex-panel border border-lrgex-border rounded px-2 py-1 text-xs text-lrgex-text focus:border-lrgex-orange outline-none"
                    placeholder="Title"
                    value={newLinkTitle}
                    onChange={e => setNewLinkTitle(e.target.value)}
                />
                <input 
                    className="w-full bg-lrgex-panel border border-lrgex-border rounded px-2 py-1 text-xs text-lrgex-text focus:border-lrgex-orange outline-none"
                    placeholder="URL"
                    value={newLinkUrl}
                    onChange={e => setNewLinkUrl(e.target.value)}
                />
                <div className="flex items-center gap-2 bg-lrgex-panel border border-lrgex-border rounded px-2 py-1">
                    <input 
                        className="flex-1 bg-transparent text-xs text-lrgex-text outline-none min-w-0"
                        placeholder="Icon URL or Upload"
                        value={newLinkIcon}
                        onChange={e => setNewLinkIcon(e.target.value)}
                    />
                    <label className="cursor-pointer text-lrgex-muted hover:text-lrgex-orange">
                        <Upload size={12} />
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, setNewLinkIcon)} />
                    </label>
                </div>
                <button onClick={handleAdd} className="w-full bg-lrgex-orange text-white text-xs py-1 rounded hover:bg-orange-600">Save Link</button>
            </div>
        )}
      </div>

      {/* Resize Handle */}
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
  );
};
