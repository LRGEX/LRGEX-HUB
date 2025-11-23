
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { WidgetWrapper } from './components/WidgetWrapper';
import { UniversalWidget } from './components/widgets/UniversalWidget';
import { AiWidget } from './components/widgets/GeminiWidget';
import { WeatherWidget } from './components/widgets/WeatherWidget';
import { ProxmoxWidget } from './components/widgets/ProxmoxWidget';
import { SabnzbdWidget } from './components/widgets/SabnzbdWidget';
import { LinkGroup } from './components/LinkGroup';
import { BackupModal } from './components/BackupModal';
import { AppData, WidgetType, WidgetConfig, LinkItem, UniversalWidgetConfig, AiSettings, WidgetTemplate, GeneralSettings, BackupSettings } from './types';
import { saveBackupToServer } from './services/backupService';
import { Settings, Check, FolderPlus, X, LayoutTemplate, Trash2, Bot, Save, Clock, Cloud, Database, PanelRightClose, PanelRightOpen, GripVertical, AlignLeft, AlignCenter, AlignRight } from 'lucide-react';

// Helper for generating unique IDs
const generateUUID = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
};

// Helper to get browser timezone
const getBrowserTimezone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch (e) {
    return 'UTC';
  }
};

// Default Configuration
const DEFAULT_AI_SETTINGS: AiSettings = {
    provider: 'GEMINI',
    mode: 'COMMANDER',
    geminiKey: process.env.API_KEY || '',
    openRouterKey: '',
    openRouterModel: 'x-ai/grok-4.1-fast',
    openAiKey: '',
    openAiModel: 'gpt-4o',
    openAiUrl: '',
    ollamaUrl: 'http://localhost:11434',
    ollamaModel: 'llama3'
};

const DEFAULT_BACKUP_SETTINGS: BackupSettings = {
    enabled: false,
    schedule: 'WEEKLY',
    lastBackupAt: null
};

const DEFAULT_DATA: AppData = {
  widgets: [], // Empty by default, AI is now separate
  categories: [],
  aiSettings: DEFAULT_AI_SETTINGS,
  templates: [],
  generalSettings: {
    timezone: getBrowserTimezone(),
    aiSidebarOpen: true,
    layoutAlign: 'center'
  },
  backupSettings: DEFAULT_BACKUP_SETTINGS,
  sectionOrder: ['widgets', 'bookmarks']
};

// --- Modal Component for Templates ---
const SaveTemplateModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onSave: (name: string) => void;
    initialName: string;
}> = ({ isOpen, onClose, onSave, initialName }) => {
    const [name, setName] = useState(initialName);

    useEffect(() => {
        if (isOpen) setName(initialName);
    }, [isOpen, initialName]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-lrgex-panel border border-lrgex-border rounded-xl shadow-2xl w-full max-w-md p-6 animate-in zoom-in-95 duration-200">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <Save size={18} className="text-lrgex-orange" /> Save Template
                </h3>
                <input
                    autoFocus
                    className="w-full bg-lrgex-bg border border-lrgex-border rounded-lg px-4 py-2 text-white focus:border-lrgex-orange outline-none mb-6"
                    placeholder="Template Name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && name && onSave(name)}
                />
                <div className="flex gap-3 justify-end">
                    <button 
                        onClick={onClose}
                        className="px-4 py-2 rounded-lg text-lrgex-muted hover:bg-lrgex-hover transition-colors"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={() => name && onSave(name)}
                        disabled={!name}
                        className="px-4 py-2 rounded-lg bg-lrgex-orange text-white hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        Save Template
                    </button>
                </div>
            </div>
        </div>
    );
};

const App: React.FC = () => {
  const [editMode, setEditMode] = useState(false);
  const [data, setData] = useState<AppData>(DEFAULT_DATA);
  const [isLoaded, setIsLoaded] = useState(false);
  
  // UI State
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [showTemplates, setShowTemplates] = useState(false);
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  
  // Drag state for sections
  const [draggedSection, setDraggedSection] = useState<string | null>(null);
  
  // Clock State
  const [currentTime, setCurrentTime] = useState(new Date());

  // Template Modal State
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [pendingTemplateConfig, setPendingTemplateConfig] = useState<UniversalWidgetConfig | null>(null);
  
  // Template Deletion State
  const [confirmDeleteTemplateId, setConfirmDeleteTemplateId] = useState<string | null>(null);

  // Available Timezones
  const timezones = useMemo(() => {
    try {
      // @ts-ignore: Intl.supportedValuesOf is not yet in all TS libs
      return (Intl as any).supportedValuesOf('timeZone');
    } catch (e) {
      return ['UTC', 'America/New_York', 'Europe/London', 'Asia/Tokyo'];
    }
  }, []);

  // Clock Timer
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Backup Scheduler (Server Save)
  useEffect(() => {
      if (!isLoaded) return;

      const checkBackup = async () => {
          const { enabled, schedule, lastBackupAt } = data.backupSettings;
          if (!enabled) return;

          const now = Date.now();
          const last = lastBackupAt || 0;
          let intervalMs = 0;

          switch (schedule) {
              case 'HOURLY': intervalMs = 3600000; break;
              case 'DAILY': intervalMs = 86400000; break;
              case 'WEEKLY': intervalMs = 604800000; break;
          }

          if (intervalMs > 0 && (now - last) > intervalMs) {
              console.log("Triggering Scheduled Backup to Server...");
              try {
                await saveBackupToServer(data);
                setData(prev => ({
                    ...prev,
                    backupSettings: { ...prev.backupSettings, lastBackupAt: now }
                }));
                console.log("Backup successful.");
              } catch (e) {
                console.error("Scheduled backup failed:", e);
              }
          }
      };

      const timer = setInterval(checkBackup, 60000); // Check every minute
      return () => clearInterval(timer);
  }, [data, isLoaded]);

  // Initial Load from Server (Persistence)
  useEffect(() => {
    const loadConfig = async () => {
        try {
            const res = await fetch('/api/config');
            
            if (!res.ok) {
                throw new Error(`Server returned ${res.status}`);
            }

            // Consume as text first to avoid stream errors and allow debug logging
            const text = await res.text();
            let serverData = null;
            
            try {
                serverData = JSON.parse(text);
            } catch (parseErr) {
                console.error("Failed to parse config JSON:", text);
            }

            if (serverData && Object.keys(serverData).length > 0) {
                // Migration: Remove old AI widgets from the grid if they exist
                const cleanWidgets = (serverData.widgets || []).filter((w: any) => w.type !== WidgetType.AI);
        
                const loadedData = {
                    ...DEFAULT_DATA,
                    ...serverData,
                    widgets: cleanWidgets,
                    aiSettings: { ...DEFAULT_AI_SETTINGS, ...(serverData.aiSettings || {}) },
                    templates: serverData.templates || [],
                    generalSettings: { ...DEFAULT_DATA.generalSettings, ...(serverData.generalSettings || {}) },
                    backupSettings: { ...DEFAULT_BACKUP_SETTINGS, ...(serverData.backupSettings || {}) },
                    sectionOrder: serverData.sectionOrder || DEFAULT_DATA.sectionOrder
                };
                setData(loadedData);
                setSidebarOpen(loadedData.generalSettings.aiSidebarOpen);
            }
        } catch (e) {
            console.error("Failed to load config from server. Using defaults.", e);
        } finally {
            setIsLoaded(true);
        }
    };
    loadConfig();
  }, []);

  // Auto-Save to Server (Debounced)
  // Replaces localStorage to ensure data persists in Docker volume
  useEffect(() => {
    if (!isLoaded) return;

    const saveData = async () => {
        const dataToSave = {
            ...data,
            generalSettings: {
                ...data.generalSettings,
                aiSidebarOpen: sidebarOpen
            }
        };
        try {
            await fetch('/api/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dataToSave)
            });
        } catch (e) {
            console.error("Failed to auto-save config to server", e);
        }
    };

    const timeoutId = setTimeout(saveData, 1000); // Debounce 1s
    return () => clearTimeout(timeoutId);
  }, [data, isLoaded, sidebarOpen]);

  // --- Actions ---

  const removeWidget = (id: string) => {
    setData(prev => ({ ...prev, widgets: prev.widgets.filter(w => w.id !== id) }));
  };

  const addWidget = (type: WidgetType, config?: UniversalWidgetConfig) => {
    if (type === WidgetType.AI) return; // Prevent AI widget in grid

    const newWidget: WidgetConfig = {
      id: generateUUID(),
      type,
      title: config?.label || type.charAt(0) + type.slice(1).toLowerCase(),
      config: config,
      w: 1,
      h: 1
    };
    setData(prev => ({ ...prev, widgets: [...prev.widgets, newWidget] }));
  };

  const updateWidgetConfig = (id: string, newConfig: UniversalWidgetConfig) => {
    setData(prev => ({
        ...prev,
        widgets: prev.widgets.map(w => w.id === id ? { ...w, config: newConfig, title: newConfig.label } : w)
    }));
  };

  const openSaveTemplateModal = (config: UniversalWidgetConfig) => {
      setPendingTemplateConfig(config);
      setTemplateModalOpen(true);
  };

  const handleSaveTemplate = (name: string) => {
    if (pendingTemplateConfig) {
        const newTemplate: WidgetTemplate = {
            id: generateUUID(),
            name,
            config: { ...pendingTemplateConfig, label: name }
        };
        setData(prev => ({
            ...prev,
            templates: [...prev.templates, newTemplate]
        }));
        setTemplateModalOpen(false);
        setPendingTemplateConfig(null);
    }
  };

  const addWidgetFromTemplate = (template: WidgetTemplate) => {
      addWidget(WidgetType.UNIVERSAL, { ...template.config, label: template.name });
      setShowTemplates(false);
  };

  const deleteTemplate = (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      if (confirmDeleteTemplateId === id) {
          setData(prev => ({
              ...prev,
              templates: prev.templates.filter(t => t.id !== id)
          }));
          setConfirmDeleteTemplateId(null);
      } else {
          setConfirmDeleteTemplateId(id);
          // Reset confirmation after 3 seconds
          setTimeout(() => setConfirmDeleteTemplateId(null), 3000);
      }
  };

  const resizeWidget = (id: string, w: number, h: number) => {
    setData(prev => ({
      ...prev,
      widgets: prev.widgets.map(widget => 
        widget.id === id ? { ...widget, w, h } : widget
      )
    }));
  };

  const moveWidget = (draggedId: string, targetId: string) => {
    const dragIndex = data.widgets.findIndex(w => w.id === draggedId);
    const targetIndex = data.widgets.findIndex(w => w.id === targetId);
    
    if (dragIndex === -1 || targetIndex === -1 || dragIndex === targetIndex) return;

    const newWidgets = [...data.widgets];
    const [draggedItem] = newWidgets.splice(dragIndex, 1);
    newWidgets.splice(targetIndex, 0, draggedItem);

    setData(prev => ({ ...prev, widgets: newWidgets }));
  };

  const confirmAddCategory = () => {
    if (newCategoryName.trim()) {
        setData(prev => ({
            ...prev,
            categories: [...prev.categories, { 
              id: generateUUID(), 
              title: newCategoryName, 
              links: [],
              w: 1,
              h: 2 // Default height for new category
            }]
        }));
        setNewCategoryName('');
        setIsAddingCategory(false);
    }
  };

  const deleteCategory = (id: string) => {
      setData(prev => ({
          ...prev,
          categories: prev.categories.filter(c => c.id !== id)
      }));
  };

  const resizeCategory = (id: string, w: number, h: number) => {
    setData(prev => ({
      ...prev,
      categories: prev.categories.map(c => 
        c.id === id ? { ...c, w, h } : c
      )
    }));
  };

  const moveCategory = (draggedId: string, targetId: string) => {
    const dragIndex = data.categories.findIndex(c => c.id === draggedId);
    const targetIndex = data.categories.findIndex(c => c.id === targetId);
    
    if (dragIndex === -1 || targetIndex === -1 || dragIndex === targetIndex) return;

    const newCats = [...data.categories];
    const [draggedItem] = newCats.splice(dragIndex, 1);
    newCats.splice(targetIndex, 0, draggedItem);

    setData(prev => ({ ...prev, categories: newCats }));
  };

  const updateCategory = (id: string, title: string, iconUrl?: string) => {
      setData(prev => ({
          ...prev,
          categories: prev.categories.map(c => 
            c.id === id ? { ...c, title, iconUrl } : c
          )
      }));
  };

  const addLink = (catId: string, link: LinkItem) => {
      setData(prev => ({
          ...prev,
          categories: prev.categories.map(c => 
             c.id === catId ? { ...c, links: [...c.links, link] } : c
          )
      }));
  };

  const removeLink = (catId: string, linkId: string) => {
    setData(prev => ({
        ...prev,
        categories: prev.categories.map(c => 
           c.id === catId ? { ...c, links: c.links.filter(l => l.id !== linkId) } : c
        )
    }));
  };

  const updateLink = (catId: string, linkId: string, title: string, url: string, iconUrl?: string) => {
      setData(prev => ({
          ...prev,
          categories: prev.categories.map(c => 
             c.id === catId ? {
                 ...c,
                 links: c.links.map(l => l.id === linkId ? { ...l, title, url, iconUrl } : l)
             } : c
          )
      }));
  };

  const moveLink = (sourceCatId: string, targetCatId: string, linkId: string) => {
      setData(prev => {
          const sourceCat = prev.categories.find(c => c.id === sourceCatId);
          if (!sourceCat) return prev;
          
          const link = sourceCat.links.find(l => l.id === linkId);
          if (!link) return prev;

          // Remove from source, add to target
          return {
              ...prev,
              categories: prev.categories.map(c => {
                  if (c.id === sourceCatId) {
                      return { ...c, links: c.links.filter(l => l.id !== linkId) };
                  }
                  if (c.id === targetCatId) {
                      return { ...c, links: [...c.links, link] };
                  }
                  return c;
              })
          };
      });
  };

  const updateAiSettings = (settings: AiSettings) => {
      setData(prev => ({ ...prev, aiSettings: settings }));
  };

  const updateTimezone = (timezone: string) => {
    setData(prev => ({
      ...prev,
      generalSettings: { ...prev.generalSettings, timezone }
    }));
  };

  const updateLayoutAlign = (align: 'start' | 'center' | 'end') => {
      setData(prev => ({
          ...prev,
          generalSettings: { ...prev.generalSettings, layoutAlign: align }
      }));
  };

  const updateBackupSettings = (settings: BackupSettings) => {
      setData(prev => ({ ...prev, backupSettings: settings }));
  };

  const handleRestore = (newData: AppData) => {
      // Ensure safe defaults for new features if restoring old backup
      setData(prev => {
          const merged: AppData = {
              ...DEFAULT_DATA,
              ...newData,
              aiSettings: { ...DEFAULT_AI_SETTINGS, ...newData.aiSettings },
              generalSettings: { ...DEFAULT_DATA.generalSettings, ...newData.generalSettings },
              backupSettings: { ...DEFAULT_BACKUP_SETTINGS, ...newData.backupSettings },
              sectionOrder: newData.sectionOrder || DEFAULT_DATA.sectionOrder
          };
          return merged;
      });
  };

  // Section Reordering Logic
  const handleSectionDragStart = (e: React.DragEvent, sectionId: string) => {
      if (!editMode) return;
      setDraggedSection(sectionId);
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', sectionId); // Firefox requirement
  };

  const handleSectionDragOver = (e: React.DragEvent, targetSectionId: string) => {
      if (!editMode || !draggedSection || draggedSection === targetSectionId) return;
      e.preventDefault();
  };

  const handleSectionDrop = (e: React.DragEvent, targetSectionId: string) => {
      if (!editMode || !draggedSection || draggedSection === targetSectionId) return;
      e.preventDefault();
      
      setData(prev => {
          const newOrder = [...prev.sectionOrder];
          const fromIndex = newOrder.indexOf(draggedSection);
          const toIndex = newOrder.indexOf(targetSectionId);
          
          if (fromIndex !== -1 && toIndex !== -1) {
              newOrder[fromIndex] = targetSectionId;
              newOrder[toIndex] = draggedSection;
          }
          return { ...prev, sectionOrder: newOrder };
      });
      setDraggedSection(null);
  };

  const handleAiAddBookmark = (categoryName: string, title: string, url: string, iconUrl?: string, categoryIconUrl?: string) => {
    setData(prev => {
      const cleanUrl = url.startsWith('http') ? url : `https://${url}`;
      const normalize = (u: string) => u.replace(/\/$/, '').toLowerCase();
      const normalizedCleanUrl = normalize(cleanUrl);

      // 1. Deep copy and remove this URL from ALL existing categories
      let newCategories = prev.categories.map(c => ({
        ...c,
        links: c.links.filter(l => normalize(l.url) !== normalizedCleanUrl)
      }));

      // 2. Find or create the target category
      let categoryIndex = newCategories.findIndex(c => c.title.toLowerCase() === categoryName.toLowerCase());
      
      if (categoryIndex === -1) {
        newCategories.push({
          id: generateUUID(),
          title: categoryName.charAt(0).toUpperCase() + categoryName.slice(1),
          links: [],
          iconUrl: categoryIconUrl,
          w: 1,
          h: 2
        });
        categoryIndex = newCategories.length - 1;
      } else if (categoryIconUrl && !newCategories[categoryIndex].iconUrl) {
          newCategories[categoryIndex] = { ...newCategories[categoryIndex], iconUrl: categoryIconUrl };
      }

      // 3. Add the link
      newCategories[categoryIndex] = {
        ...newCategories[categoryIndex],
        links: [...newCategories[categoryIndex].links, { id: generateUUID(), title, url: cleanUrl, iconUrl }]
      };

      return { ...prev, categories: newCategories };
    });
  };

  const renderWidgetContent = (widget: WidgetConfig) => {
    switch (widget.type) {
      case WidgetType.UNIVERSAL: 
        return <UniversalWidget 
            config={widget.config} 
            onUpdate={(newConfig) => updateWidgetConfig(widget.id, newConfig)}
            onSaveTemplate={openSaveTemplateModal}
            editMode={editMode}
        />;
      case WidgetType.WEATHER: return <WeatherWidget config={widget.config} />;
      case WidgetType.PROXMOX: return <ProxmoxWidget config={widget.config} />;
      case WidgetType.SABNZBD: return <SabnzbdWidget config={widget.config} />;
      default: return <div className="text-lrgex-muted text-center p-4">Unknown Widget</div>;
    }
  };

  const getSizeClasses = (w: number = 1, h: number = 1, baseHeight: number = 180) => {
    let widthClass = 'w-full';
    if (w === 1) widthClass = 'w-full md:w-[calc(50%-0.75rem)] xl:w-[calc(25%-1.125rem)]';
    if (w === 2) widthClass = 'w-full xl:w-[calc(50%-0.75rem)]';
    if (w === 3) widthClass = 'w-full xl:w-[calc(75%-0.375rem)]';
    if (w === 4) widthClass = 'w-full';

    const gap = 24;
    const pxHeight = (h * baseHeight) + ((h - 1) * gap);
    const heightClass = `h-[${pxHeight}px]`;

    return `${widthClass} ${heightClass}`;
  };

  // --- Logo Component ---
  const LrgexLogo = () => (
    <img 
      src="https://download.lrgex.com/logo_Dark.svg" 
      alt="LRGEX" 
      className="h-10 w-auto object-contain" 
    />
  );

  const today = currentTime.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const formattedTime = new Intl.DateTimeFormat('en-US', {
    timeZone: data.generalSettings.timezone,
    hour: 'numeric',
    minute: 'numeric',
    hour12: true
  }).format(currentTime);
  const year = currentTime.getFullYear();

  const hasWidgets = data.widgets.length > 0;
  const alignClass = data.generalSettings.layoutAlign === 'center' ? 'justify-center' : data.generalSettings.layoutAlign === 'end' ? 'justify-end' : 'justify-start';

  return (
    <div className="min-h-screen bg-lrgex-bg text-lrgex-text font-sans selection:bg-lrgex-orange selection:text-white flex flex-col overflow-hidden">
      
      <SaveTemplateModal 
          isOpen={templateModalOpen} 
          onClose={() => { setTemplateModalOpen(false); setPendingTemplateConfig(null); }}
          onSave={handleSaveTemplate}
          initialName={pendingTemplateConfig?.label || ''}
      />

      <BackupModal 
          isOpen={showBackupModal}
          onClose={() => setShowBackupModal(false)}
          data={data}
          onRestore={handleRestore}
          onUpdateSettings={updateBackupSettings}
      />

      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-lrgex-menu/95 backdrop-blur-lg border-b border-lrgex-border shadow-lg h-20">
        <div className="w-full px-4 sm:px-6 lg:px-8 h-full flex items-center justify-between">
          <div className="flex items-center gap-6">
            {/* Logo Area - Fixed Overlap Issue */}
            <div className="flex flex-col items-end leading-none">
                 <LrgexLogo />
                 <span className="text-[21px] font-bold text-lrgex-muted tracking-[0.25em] group-hover:text-lrgex-orange transition-colors -mt-1.5 mr-1 translate-y-[5px]">HUB</span>
            </div>

            <div className="hidden md:block h-8 w-px bg-lrgex-border ml-2"></div>
            <div className="hidden md:flex flex-col items-end">
                <p className="text-[10px] text-lrgex-muted uppercase tracking-widest">{today}</p>
                <div className="flex items-center gap-2">
                    <p className="text-lg font-bold text-lrgex-text tracking-widest leading-none">{formattedTime}</p>
                    {editMode && (
                        <div className="relative flex items-center">
                             <select 
                                value={data.generalSettings.timezone}
                                onChange={(e) => updateTimezone(e.target.value)}
                                className="bg-lrgex-panel border border-lrgex-border text-[10px] rounded px-1 py-0.5 text-lrgex-muted outline-none focus:border-lrgex-orange max-w-[100px] truncate cursor-pointer appearance-none hover:text-lrgex-text"
                             >
                                {timezones.map(tz => (
                                    <option key={tz} value={tz}>{tz}</option>
                                ))}
                             </select>
                             <Clock size={10} className="absolute right-2 text-lrgex-muted pointer-events-none" />
                        </div>
                    )}
                </div>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
             {/* Edit Mode Layout Controls */}
             {editMode && (
                 <div className="hidden lg:flex bg-lrgex-panel border border-lrgex-border rounded-full p-1 mr-2">
                    <button onClick={() => updateLayoutAlign('start')} className={`p-1.5 rounded-full ${data.generalSettings.layoutAlign === 'start' ? 'bg-lrgex-orange text-white' : 'text-lrgex-muted hover:text-white'}`} title="Align Left"><AlignLeft size={14} /></button>
                    <button onClick={() => updateLayoutAlign('center')} className={`p-1.5 rounded-full ${data.generalSettings.layoutAlign === 'center' ? 'bg-lrgex-orange text-white' : 'text-lrgex-muted hover:text-white'}`} title="Align Center"><AlignCenter size={14} /></button>
                    <button onClick={() => updateLayoutAlign('end')} className={`p-1.5 rounded-full ${data.generalSettings.layoutAlign === 'end' ? 'bg-lrgex-orange text-white' : 'text-lrgex-muted hover:text-white'}`} title="Align Right"><AlignRight size={14} /></button>
                 </div>
             )}

             {/* Sidebar Toggle */}
            <button 
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className={`p-2 rounded-full transition-colors border border-transparent ${sidebarOpen ? 'text-lrgex-orange bg-lrgex-orange/10 border-lrgex-orange/20' : 'text-lrgex-muted hover:text-white hover:bg-lrgex-hover'}`}
                title={sidebarOpen ? "Close AI Sidebar" : "Open AI Sidebar"}
            >
                {sidebarOpen ? <PanelRightOpen size={20} /> : <PanelRightClose size={20} />}
            </button>

            <div className="h-6 w-px bg-lrgex-border mx-1"></div>

            <button 
                onClick={() => setShowBackupModal(true)}
                className="p-2 rounded-full bg-lrgex-panel text-lrgex-muted hover:bg-lrgex-hover hover:text-white transition-colors border border-transparent hover:border-lrgex-border"
                title="Backup & Restore"
            >
                <Database size={20} />
            </button>
            
            <button 
                onClick={() => setEditMode(!editMode)}
                className={`p-2 rounded-full transition-all duration-300 shadow-md ${
                    editMode 
                    ? 'bg-lrgex-orange text-white rotate-0' 
                    : 'bg-lrgex-panel text-lrgex-muted hover:bg-lrgex-hover hover:text-white'
                }`}
                title="Edit Mode"
            >
                {editMode ? <Check size={20} /> : <Settings size={20} />}
            </button>
          </div>
        </div>
      </header>

      {/* Main Layout Container */}
      <div className="flex flex-1 overflow-hidden relative pt-20">
        
        {/* Center Content + Footer Wrapper */}
        <div className="flex-1 flex flex-col min-w-0">
            <main className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-6 lg:p-8 flex flex-col">
                <div className="max-w-[1600px] mx-auto w-full space-y-10 flex-1">
                    
                    {data.sectionOrder.map(section => {
                        
                        if (section === 'widgets' && hasWidgets) {
                            return (
                                <section 
                                    key="widgets" 
                                    className={`animate-in fade-in duration-500 ${editMode ? 'ring-1 ring-transparent hover:ring-lrgex-border rounded-xl p-2 -m-2 transition-all' : ''}`}
                                    onDragOver={(e) => handleSectionDragOver(e, 'widgets')}
                                    onDrop={(e) => handleSectionDrop(e, 'widgets')}
                                >
                                    <div className="flex items-center justify-between mb-6 border-b border-lrgex-orange pb-2">
                                        <h2 className="text-lg font-semibold text-lrgex-text flex items-center gap-2 group cursor-default">
                                            {editMode && (
                                                <div 
                                                    draggable 
                                                    onDragStart={(e) => handleSectionDragStart(e, 'widgets')}
                                                    className="cursor-move text-lrgex-muted/30 hover:text-lrgex-orange p-1"
                                                >
                                                    <GripVertical size={18} />
                                                </div>
                                            )}
                                            Widgets
                                            {editMode && <span className="text-[10px] font-normal text-lrgex-orange bg-lrgex-orange/10 px-2 py-0.5 rounded border border-lrgex-orange/20">EDITING</span>}
                                        </h2>
                                        {editMode && (
                                            <div className="flex gap-2">
                                                {/* Template Dropdown */}
                                                {data.templates.length > 0 && (
                                                    <div className="relative">
                                                        <button 
                                                            onClick={() => setShowTemplates(!showTemplates)}
                                                            className="text-xs bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 px-3 py-1.5 rounded-full border border-blue-600/30 flex items-center gap-1 transition-colors"
                                                        >
                                                            <LayoutTemplate size={14} /> Templates
                                                        </button>
                                                        {showTemplates && (
                                                            <div className="absolute top-full mt-2 right-0 w-48 bg-lrgex-panel border border-lrgex-border rounded-lg shadow-xl z-50 overflow-hidden">
                                                                <div className="px-3 py-2 border-b border-lrgex-border text-[10px] font-bold text-lrgex-muted uppercase tracking-wider">Saved Widgets</div>
                                                                {data.templates.map(t => (
                                                                    <div key={t.id} className="flex items-center justify-between p-2 hover:bg-lrgex-hover group">
                                                                        <button 
                                                                            onClick={() => addWidgetFromTemplate(t)}
                                                                            className="text-xs text-lrgex-text text-left flex-1 truncate"
                                                                        >
                                                                            {t.name}
                                                                        </button>
                                                                        <button 
                                                                            onClick={(e) => deleteTemplate(t.id, e)}
                                                                            className={`ml-2 p-1 rounded transition-all duration-200 ${
                                                                                confirmDeleteTemplateId === t.id 
                                                                                ? 'bg-red-500 text-white px-2 opacity-100' 
                                                                                : 'text-lrgex-muted hover:text-red-400 opacity-0 group-hover:opacity-100'
                                                                            }`}
                                                                        >
                                                                            {confirmDeleteTemplateId === t.id ? <span className="text-[10px] font-bold">Confirm</span> : <Trash2 size={12} />}
                                                                        </button>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    <div className={`flex flex-wrap gap-6 ${alignClass}`}>
                                        {data.widgets.map((widget) => {
                                            // Hide title bar for custom widgets in View mode to allow 100% height usage
                                            const hasCustomCode = widget.type === WidgetType.UNIVERSAL && widget.config?.customCode;
                                            const wrapperTitle = hasCustomCode && !editMode ? undefined : widget.title;

                                            return (
                                                <WidgetWrapper 
                                                    key={widget.id}
                                                    id={widget.id}
                                                    title={wrapperTitle} 
                                                    editMode={editMode}
                                                    onRemove={() => removeWidget(widget.id)}
                                                    w={widget.w}
                                                    h={widget.h}
                                                    onResize={(w, h) => resizeWidget(widget.id, w, h)}
                                                    onMove={moveWidget}
                                                    className={getSizeClasses(widget.w, widget.h, 180)}
                                                >
                                                    {renderWidgetContent(widget)}
                                                </WidgetWrapper>
                                            );
                                        })}
                                    </div>
                                </section>
                            );
                        }

                        if (section === 'bookmarks') {
                            return (
                                <section 
                                    key="bookmarks" 
                                    className={`flex-1 ${editMode ? 'ring-1 ring-transparent hover:ring-lrgex-border rounded-xl p-2 -m-2 transition-all' : ''}`}
                                    onDragOver={(e) => handleSectionDragOver(e, 'bookmarks')}
                                    onDrop={(e) => handleSectionDrop(e, 'bookmarks')}
                                >
                                    <div className="flex items-center justify-between mb-6 border-b border-lrgex-orange pb-2 h-10">
                                        <h2 className="text-lg font-semibold text-lrgex-text flex items-center gap-2">
                                            {editMode && (
                                                <div 
                                                    draggable 
                                                    onDragStart={(e) => handleSectionDragStart(e, 'bookmarks')}
                                                    className="cursor-move text-lrgex-muted/30 hover:text-lrgex-orange p-1"
                                                >
                                                    <GripVertical size={18} />
                                                </div>
                                            )}
                                            Bookmarks
                                        </h2>
                                        
                                        {editMode && !isAddingCategory && (
                                            <button 
                                                onClick={() => setIsAddingCategory(true)} 
                                                className="text-xs bg-lrgex-orange hover:bg-orange-600 text-white px-3 py-1.5 rounded-full flex items-center gap-1 transition-colors shadow-lg shadow-orange-900/20"
                                            >
                                                <FolderPlus size={14} /> New Category
                                            </button>
                                        )}

                                        {editMode && isAddingCategory && (
                                            <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-4 duration-300">
                                                <input 
                                                    autoFocus
                                                    placeholder="Category Name..." 
                                                    value={newCategoryName}
                                                    onChange={(e) => setNewCategoryName(e.target.value)}
                                                    onKeyDown={(e) => e.key === 'Enter' && confirmAddCategory()}
                                                    className="bg-lrgex-panel border border-lrgex-border text-xs px-2 py-1 rounded text-lrgex-text focus:border-lrgex-orange outline-none w-40"
                                                />
                                                <button onClick={confirmAddCategory} className="text-emerald-400 hover:text-emerald-300"><Check size={16}/></button>
                                                <button onClick={() => { setIsAddingCategory(false); setNewCategoryName(''); }} className="text-red-400 hover:text-red-300"><X size={16}/></button>
                                            </div>
                                        )}
                                    </div>
                                    
                                    <div className={`flex flex-wrap gap-6 ${alignClass}`}>
                                        {data.categories.map(category => (
                                            <LinkGroup 
                                                key={category.id} 
                                                category={category} 
                                                editMode={editMode}
                                                onDeleteCategory={deleteCategory}
                                                onUpdateCategory={updateCategory}
                                                onAddLink={addLink}
                                                onRemoveLink={removeLink}
                                                onUpdateLink={updateLink}
                                                onMoveLink={moveLink}
                                                w={category.w}
                                                h={category.h}
                                                onResize={(w, h) => resizeCategory(category.id, w, h)}
                                                onMoveCategory={moveCategory}
                                                className={getSizeClasses(category.w, category.h, 150)}
                                            />
                                        ))}
                                    </div>
                                </section>
                            );
                        }
                        return null;
                    })}
                </div>
            </main>
            
            {/* Footer - Fixed at bottom of Main Content Area */}
            <footer className="w-full py-4 border-t border-lrgex-border text-center bg-lrgex-bg shrink-0 z-10">
                <p className="text-xs text-lrgex-muted font-mono">
                Made by LRGEX ver 1.0 {year}
                </p>
            </footer>
        </div>

        {/* Right AI Sidebar */}
        <aside className={`${sidebarOpen ? 'w-[400px] border-l' : 'w-0 border-l-0'} transition-[width] duration-300 ease-in-out bg-lrgex-menu/30 border-lrgex-border flex flex-col shrink-0 overflow-hidden relative`}>
             <div className="w-[400px] h-full flex flex-col">
                <AiWidget 
                    settings={data.aiSettings} 
                    onUpdateSettings={updateAiSettings}
                    onAddWidget={addWidget} 
                    onAddBookmark={handleAiAddBookmark} 
                />
             </div>
        </aside>

      </div>
    </div>
  );
};

export default App;
