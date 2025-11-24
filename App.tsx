
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { WidgetWrapper } from './components/WidgetWrapper';
import { UniversalWidget } from './components/widgets/UniversalWidget';
import { AiWidget } from './components/widgets/GeminiWidget';
import { WeatherWidget } from './components/widgets/WeatherWidget';
import { ProxmoxWidget } from './components/widgets/ProxmoxWidget';
import { SabnzbdWidget } from './components/widgets/SabnzbdWidget';
import { LinkGroup } from './components/LinkGroup';
import { BackupModal } from './components/BackupModal';
import { WebAppCard } from './components/WebAppCard';
import { WebAppModal } from './components/WebAppModal';
import { AppData, WidgetType, WidgetConfig, LinkItem, UniversalWidgetConfig, AiSettings, WidgetTemplate, GeneralSettings, BackupSettings, WebApp } from './types';
import { saveBackupToServer } from './services/backupService';
import { Settings, Check, FolderPlus, X, LayoutTemplate, Trash2, Bot, Save, Clock, Cloud, Database, PanelRightClose, PanelRightOpen, GripVertical, GripHorizontal, AlignLeft, AlignCenter, AlignRight, Eye, EyeOff, Plus, Search, AppWindow, FolderMinus, Star, Minus, Columns } from 'lucide-react';

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
    chatFontSize: 'medium',
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
  webApps: [],
  aiSettings: DEFAULT_AI_SETTINGS,
  templates: [],
  generalSettings: {
    timezone: getBrowserTimezone(),
    aiSidebarOpen: true,
    layoutAlign: 'center',
    defaultWebAppTab: 'All'
  },
  backupSettings: DEFAULT_BACKUP_SETTINGS,
  sectionOrder: ['webApps', 'widgets', 'bookmarks'],
  sectionVisibility: { widgets: true, bookmarks: true, webApps: true }
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
  
  // Web Apps State
  const [activeWebAppTab, setActiveWebAppTab] = useState('All');
  const [webAppSearch, setWebAppSearch] = useState('');
  const [showWebAppModal, setShowWebAppModal] = useState(false);
  const [editingWebApp, setEditingWebApp] = useState<WebApp | undefined>(undefined);
  const [confirmDeleteWebAppCat, setConfirmDeleteWebAppCat] = useState<string | null>(null);

  // Drag state for sections
  const [draggedSection, setDraggedSection] = useState<string | null>(null);
  
  // Clock State
  const [currentTime, setCurrentTime] = useState(new Date());

  // Template Modal State
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [pendingTemplateConfig, setPendingTemplateConfig] = useState<UniversalWidgetConfig | null>(null);
  
  // Template Deletion State
  const [confirmDeleteTemplateId, setConfirmDeleteTemplateId] = useState<string | null>(null);

  // AI Prompt Override (from widget errors)
  const [aiPromptOverride, setAiPromptOverride] = useState<string | null>(null);

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
            const text = await res.text();
            
            if (!res.ok) {
                console.error(`Failed to load config (Status: ${res.status}):`, text);
                throw new Error(`Server returned ${res.status}`);
            }

            let serverData = null;
            try {
                serverData = JSON.parse(text);
            } catch (parseErr) {
                console.error("Failed to parse config JSON. Raw text:", text);
            }

            if (serverData && Object.keys(serverData).length > 0) {
                const cleanWidgets = (serverData.widgets || []).filter((w: any) => w.type !== WidgetType.AI);
                
                const loadedSectionOrder = serverData.sectionOrder || DEFAULT_DATA.sectionOrder;
                if (!loadedSectionOrder.includes('webApps')) {
                    loadedSectionOrder.unshift('webApps');
                }

                const loadedData = {
                    ...DEFAULT_DATA,
                    ...serverData,
                    widgets: cleanWidgets,
                    aiSettings: { ...DEFAULT_AI_SETTINGS, ...(serverData.aiSettings || {}) },
                    templates: serverData.templates || [],
                    generalSettings: { ...DEFAULT_DATA.generalSettings, ...(serverData.generalSettings || {}) },
                    backupSettings: { ...DEFAULT_BACKUP_SETTINGS, ...(serverData.backupSettings || {}) },
                    sectionOrder: loadedSectionOrder,
                    sectionVisibility: { ...DEFAULT_DATA.sectionVisibility, ...(serverData.sectionVisibility || {}) }
                };
                setData(loadedData);
                setSidebarOpen(loadedData.generalSettings.aiSidebarOpen);
                setActiveWebAppTab(loadedData.generalSettings.defaultWebAppTab || 'All');
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

    const timeoutId = setTimeout(saveData, 1000);
    return () => clearTimeout(timeoutId);
  }, [data, isLoaded, sidebarOpen]);

  // --- Actions ---

  const reportWidgetError = useCallback((error: string, code?: string) => {
      let prompt = `I'm getting this error with the custom widget code:\n\n${error}\n\n`;
      if (code) {
          prompt += `Here is the current code:\n\n\`\`\`javascript\n${code}\n\`\`\`\n\n`;
      }
      prompt += `Fix it and recreate the widget.`;
      
      setAiPromptOverride(prompt);
      setSidebarOpen(true);
  }, []);

  const removeWidget = (id: string) => {
    setData(prev => ({ ...prev, widgets: prev.widgets.filter(w => w.id !== id) }));
  };

  const addWidget = (type: WidgetType, config?: UniversalWidgetConfig) => {
    if (type === WidgetType.AI) return;

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

  const handleManualAddWidget = () => {
    addWidget(WidgetType.UNIVERSAL, {
        label: 'New Widget',
        endpoint: '',
        jsonPath: '',
        method: 'GET',
        refreshInterval: 10000
    });
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

  const toggleSectionVisibility = (section: string) => {
      setData(prev => ({
          ...prev,
          sectionVisibility: {
              ...prev.sectionVisibility,
              [section]: !prev.sectionVisibility[section]
          }
      }));
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
              h: 2
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

          return {
              ...prev,
              categories: prev.categories.map(c => {
                  if (c.id === sourceCatId) {
                      return { ...c, links: c.links.filter(l => l.id !== linkId) }
                  }
                  if (c.id === targetCatId) {
                      return { ...c, links: [...c.links, link] }
                  }
                  return c;
              })
          };
      });
  };

  const handleSaveWebApp = (app: Omit<WebApp, 'id'>) => {
    setData(prev => {
        const newApp = { ...app, id: editingWebApp?.id || generateUUID() };
        let newWebApps = [...prev.webApps];
        if (editingWebApp) {
            newWebApps = newWebApps.map(a => a.id === editingWebApp.id ? newApp : a);
        } else {
            newWebApps.push(newApp);
        }
        return { ...prev, webApps: newWebApps };
    });
    setEditingWebApp(undefined);
  };

  const deleteWebApp = (id: string) => {
      setData(prev => ({ ...prev, webApps: prev.webApps.filter(a => a.id !== id) }));
  };

  const moveWebApp = (draggedId: string, targetId: string) => {
    setData(prev => {
        const dragIndex = prev.webApps.findIndex(a => a.id === draggedId);
        const targetIndex = prev.webApps.findIndex(a => a.id === targetId);

        if (dragIndex === -1 || targetIndex === -1 || dragIndex === targetIndex) return prev;

        const newApps = [...prev.webApps];
        const [draggedItem] = newApps.splice(dragIndex, 1);
        newApps.splice(targetIndex, 0, draggedItem);
        
        return { ...prev, webApps: newApps };
    });
  };

  const addWebAppSeparator = (type: 'HORIZONTAL' | 'VERTICAL') => {
      const newSeparator: WebApp = {
          id: generateUUID(),
          type: 'SEPARATOR',
          separatorType: type,
          name: 'Separator',
          url: '#',
          category: activeWebAppTab !== 'All' ? activeWebAppTab : 'Other',
          iconUrl: ''
      };
      setData(prev => ({
          ...prev,
          webApps: [...prev.webApps, newSeparator]
      }));
  };

  const deleteWebAppCategory = (category: string) => {
    setData(prev => ({
        ...prev,
        // Move apps to 'Other' instead of deleting
        webApps: prev.webApps.map(a => 
            a.category === category ? { ...a, category: 'Other' } : a
        )
    }));
    setActiveWebAppTab('All');
    setConfirmDeleteWebAppCat(null);
  };

  const setDefaultWebAppTab = (tab: string) => {
      setData(prev => ({
          ...prev,
          generalSettings: { ...prev.generalSettings, defaultWebAppTab: tab }
      }));
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
      setData(prev => {
          const merged: AppData = {
              ...DEFAULT_DATA,
              ...newData,
              aiSettings: { ...DEFAULT_AI_SETTINGS, ...newData.aiSettings },
              generalSettings: { ...DEFAULT_DATA.generalSettings, ...newData.generalSettings },
              backupSettings: { ...DEFAULT_BACKUP_SETTINGS, ...newData.backupSettings },
              sectionOrder: newData.sectionOrder || DEFAULT_DATA.sectionOrder,
              sectionVisibility: { ...DEFAULT_DATA.sectionVisibility, ...(newData.sectionVisibility || {}) },
              webApps: newData.webApps || []
          };
          if (!merged.sectionOrder.includes('webApps')) merged.sectionOrder.unshift('webApps');
          return merged;
      });
  };

  const handleSectionDragStart = (e: React.DragEvent, sectionId: string) => {
      if (!editMode) return;
      setDraggedSection(sectionId);
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', sectionId); 
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

  const handleAiAddWidget = (type: WidgetType, config?: UniversalWidgetConfig) => addWidget(type, config);
  const handleAiAddBookmark = (categoryName: string, title: string, url: string, iconUrl?: string, categoryIconUrl?: string) => {
    setData(prev => {
      const cleanUrl = url.startsWith('http') ? url : `https://${url}`;
      const normalize = (u: string) => u.replace(/\/$/, '').toLowerCase();
      const normalizedCleanUrl = normalize(cleanUrl);

      let newCategories = prev.categories.map(c => ({
        ...c,
        links: c.links.filter(l => normalize(l.url) !== normalizedCleanUrl)
      }));

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

      newCategories[categoryIndex] = {
        ...newCategories[categoryIndex],
        links: [...newCategories[categoryIndex].links, { id: generateUUID(), title, url: cleanUrl, iconUrl }]
      };

      return { ...prev, categories: newCategories };
    });
  };

  const addWebAppRef = useRef((args: { name: string; url: string; description?: string; category: string; iconUrl?: string }) => {
      setData(prev => {
          // Smart Category Matching
          // Explicitly type the array to avoid 'unknown' inference
          const currentCategories: string[] = Array.from(new Set(prev.webApps.map(a => a.category)));
          let targetCategory = args.category;
          const normalizedTarget = targetCategory.toLowerCase().trim();

          // 1. Check for exact match (case-insensitive)
          const exactMatch = currentCategories.find((c: string) => c.toLowerCase() === normalizedTarget);
          if (exactMatch) {
              targetCategory = exactMatch;
          } else {
              // 2. Check if requested category contains an existing one (e.g. "Productivity/Other" -> "Productivity")
              const partialMatch = currentCategories.find((c: string) => normalizedTarget.includes(c.toLowerCase()));
              if (partialMatch) {
                  targetCategory = partialMatch;
              }
          }

          return {
            ...prev,
            webApps: [...prev.webApps, {
                id: generateUUID(),
                type: 'APP',
                name: args.name,
                url: args.url,
                description: args.description,
                category: targetCategory,
                iconUrl: args.iconUrl
            }]
          };
      });
  });
  
  // Update the ref logic (though useRef for this is a bit tricky with stale closures, 
  // but since we use the function form of setData inside, it's safe)
  const handleAiAddWebApp = (args: { name: string; url: string; description?: string; category: string; iconUrl?: string }) => {
     addWebAppRef.current(args);
  };

  const renderWidgetContent = (widget: WidgetConfig) => {
    switch (widget.type) {
      case WidgetType.UNIVERSAL: 
        return <UniversalWidget 
            config={widget.config} 
            onUpdate={(newConfig) => updateWidgetConfig(widget.id, newConfig)}
            onSaveTemplate={openSaveTemplateModal}
            onReportError={reportWidgetError}
            editMode={editMode}
        />;
      case WidgetType.WEATHER: return <WeatherWidget config={widget.config} />;
      case WidgetType.PROXMOX: return <ProxmoxWidget config={widget.config} />;
      case WidgetType.SABNZBD: return <SabnzbdWidget config={widget.config} />;
      default: return <div className="text-lrgex-muted text-center p-4">Unknown Widget</div>;
    }
  };

  // NEW GRID LOGIC
  // Instead of pixel widths/heights for Flexbox, we use Col/Row spans for CSS Grid
  const getWidgetClasses = (w: number = 1, h: number = 1) => {
    // Columns (Width)
    // Mobile: Always full width (col-span-1 in a 1-col grid, or col-span-2 in 2-col, etc)
    // We define grid-cols-1 (sm) -> 2 (md) -> 3 (lg) -> 4 (xl)
    
    let colSpan = 'col-span-1';
    if (w === 2) colSpan = 'col-span-1 md:col-span-2';
    if (w === 3) colSpan = 'col-span-1 md:col-span-2 lg:col-span-3';
    if (w === 4) colSpan = 'col-span-1 md:col-span-2 lg:col-span-3 xl:col-span-4'; // Full row

    // Rows (Height)
    // Using grid-auto-rows with row-span
    const rowSpan = `row-span-${h}`;

    return `${colSpan} ${rowSpan}`;
  };

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

  // Alignment classes for FLEXBOX web apps (these are cards)
  const alignClass = data.generalSettings.layoutAlign === 'center' ? 'justify-center' : data.generalSettings.layoutAlign === 'end' ? 'justify-end' : 'justify-start';

  const webAppCategories = useMemo(() => {
      // Filter out separators from category list logic
      const cats = new Set(data.webApps.filter(a => a.type !== 'SEPARATOR').map(a => a.category));
      return Array.from(cats).sort();
  }, [data.webApps]);

  const filteredWebApps = useMemo(() => {
      if (data.webApps.length === 0) return []; // Short circuit if empty

      return data.webApps.filter(app => {
          // Separators should show if they match the tab OR if they are generic separators in 'All'
          // For simplicity, we assign separators a category.
          const matchesTab = activeWebAppTab === 'All' || app.category === activeWebAppTab;
          
          if (app.type === 'SEPARATOR') return matchesTab;

          const matchesSearch = app.name.toLowerCase().includes(webAppSearch.toLowerCase()) || 
                               (app.description || '').toLowerCase().includes(webAppSearch.toLowerCase());
          return matchesTab && matchesSearch;
      });
  }, [data.webApps, activeWebAppTab, webAppSearch]);

  const allWebAppCategories = useMemo(() => 
    ['Docker', 'Media', 'AI', 'Servers', 'Trading', 'Web', 'Other', ...webAppCategories], 
    [webAppCategories]
  );

  return (
    <div className="h-screen bg-lrgex-bg text-lrgex-text font-sans selection:bg-lrgex-orange selection:text-white flex flex-col overflow-hidden">
      
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
      
      <WebAppModal 
        isOpen={showWebAppModal}
        onClose={() => { setShowWebAppModal(false); setEditingWebApp(undefined); }}
        onSave={handleSaveWebApp}
        initialData={editingWebApp}
        existingCategories={allWebAppCategories}
      />

      <header className="fixed top-0 left-0 right-0 z-50 bg-lrgex-menu/95 backdrop-blur-lg border-b border-lrgex-border shadow-lg h-20">
        <div className="w-full px-4 sm:px-6 lg:px-8 h-full flex items-center justify-between">
          <div className="flex items-center gap-6">
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
             {editMode && (
                 <div className="hidden lg:flex bg-lrgex-panel border border-lrgex-border rounded-full p-1 mr-2">
                    <button onClick={() => updateLayoutAlign('start')} className={`p-1.5 rounded-full ${data.generalSettings.layoutAlign === 'start' ? 'bg-lrgex-orange text-white' : 'text-lrgex-muted hover:text-white'}`} title="Align Left"><AlignLeft size={14} /></button>
                    <button onClick={() => updateLayoutAlign('center')} className={`p-1.5 rounded-full ${data.generalSettings.layoutAlign === 'center' ? 'bg-lrgex-orange text-white' : 'text-lrgex-muted hover:text-white'}`} title="Align Center"><AlignCenter size={14} /></button>
                    <button onClick={() => updateLayoutAlign('end')} className={`p-1.5 rounded-full ${data.generalSettings.layoutAlign === 'end' ? 'bg-lrgex-orange text-white' : 'text-lrgex-muted hover:text-white'}`} title="Align Right"><AlignRight size={14} /></button>
                 </div>
             )}

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

      <div className="flex flex-1 overflow-hidden relative pt-20">
        
        <div className="flex-1 flex flex-col min-w-0">
            <main className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-6 lg:p-8 flex flex-col">
                <div className="max-w-[1600px] mx-auto w-full space-y-10 flex-1">
                    
                    {data.sectionOrder.map(section => {
                        const isVisible = data.sectionVisibility[section] !== false;

                        if (!isVisible && !editMode) return null;

                        const opacityClass = !isVisible ? 'opacity-50 grayscale' : '';

                        if (section === 'webApps') {
                            return (
                                <section 
                                    key="webApps" 
                                    className={`animate-in fade-in duration-500 ${opacityClass} ${editMode ? 'ring-1 ring-transparent hover:ring-lrgex-border rounded-xl p-2 -m-2 transition-all' : ''}`}
                                    onDragOver={(e) => handleSectionDragOver(e, 'webApps')}
                                    onDrop={(e) => handleSectionDrop(e, 'webApps')}
                                >
                                    <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 border-b border-lrgex-orange pb-2 gap-4">
                                        <div className="flex items-center gap-4">
                                            <h2 className="text-lg font-semibold text-lrgex-text flex items-center gap-2 group cursor-default">
                                                {editMode && (
                                                    <div 
                                                        draggable 
                                                        onDragStart={(e) => handleSectionDragStart(e, 'webApps')}
                                                        className="cursor-move text-lrgex-muted/30 hover:text-lrgex-orange p-1"
                                                    >
                                                        <GripVertical size={18} />
                                                    </div>
                                                )}
                                                Web Apps
                                                {!isVisible && editMode && <span className="text-[10px] font-normal text-lrgex-muted border border-lrgex-muted/30 px-2 py-0.5 rounded ml-2">HIDDEN</span>}
                                            </h2>
                                            
                                            <div className="relative group">
                                                <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-lrgex-muted group-focus-within:text-lrgex-orange" />
                                                <input 
                                                    className="bg-lrgex-bg/50 border border-lrgex-border rounded-full pl-8 pr-3 py-1 text-xs text-lrgex-text focus:border-lrgex-orange outline-none w-48 transition-all"
                                                    placeholder="Search apps..."
                                                    value={webAppSearch}
                                                    onChange={e => setWebAppSearch(e.target.value)}
                                                />
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2 flex-wrap justify-end">
                                            <div className="flex bg-lrgex-bg/30 p-1 rounded-lg border border-lrgex-border overflow-x-auto custom-scrollbar max-w-full items-center">
                                                {['All', ...webAppCategories].map(cat => (
                                                    <div key={cat} className="relative group/tab">
                                                        <button
                                                            onClick={() => setActiveWebAppTab(cat)}
                                                            className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all whitespace-nowrap flex items-center gap-1 ${activeWebAppTab === cat ? 'bg-lrgex-text text-lrgex-bg shadow-sm' : 'text-lrgex-muted hover:text-lrgex-text hover:bg-lrgex-hover'}`}
                                                        >
                                                            {cat}
                                                            {editMode && data.generalSettings.defaultWebAppTab === cat && <Star size={10} className="fill-current" />}
                                                        </button>
                                                        {editMode && activeWebAppTab === cat && data.generalSettings.defaultWebAppTab !== cat && (
                                                             <button 
                                                                onClick={(e) => { e.stopPropagation(); setDefaultWebAppTab(cat); }}
                                                                className="absolute -top-2 -right-1 text-lrgex-muted hover:text-lrgex-orange bg-lrgex-panel rounded-full p-0.5 shadow-sm opacity-0 group-hover/tab:opacity-100 transition-opacity"
                                                                title="Set as Default Tab"
                                                             >
                                                                 <Star size={10} />
                                                             </button>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>

                                            {editMode && activeWebAppTab !== 'All' && (
                                                <div className="flex items-center">
                                                    {confirmDeleteWebAppCat === activeWebAppTab ? (
                                                        <div className="flex gap-1 animate-in fade-in">
                                                            <button 
                                                                onClick={() => deleteWebAppCategory(activeWebAppTab)}
                                                                className="text-xs bg-red-500 hover:bg-red-600 text-white px-2 py-1.5 rounded flex items-center"
                                                            >
                                                                Confirm?
                                                            </button>
                                                            <button 
                                                                onClick={() => setConfirmDeleteWebAppCat(null)}
                                                                className="text-xs bg-lrgex-panel text-lrgex-muted hover:text-white px-2 py-1.5 rounded"
                                                            >
                                                                <X size={12}/>
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <button 
                                                            onClick={() => setConfirmDeleteWebAppCat(activeWebAppTab)}
                                                            className="text-xs bg-lrgex-panel border border-lrgex-border text-lrgex-muted hover:text-red-400 hover:border-red-400/50 px-2 py-1.5 rounded flex items-center gap-1 transition-colors"
                                                            title={`Delete Category "${activeWebAppTab}" and all its apps`}
                                                        >
                                                            <FolderMinus size={14} />
                                                        </button>
                                                    )}
                                                </div>
                                            )}

                                            {editMode && (
                                                <>
                                                    <div className="flex bg-lrgex-panel border border-lrgex-border rounded-lg p-0.5 mx-1">
                                                        <button onClick={() => addWebAppSeparator('HORIZONTAL')} className="p-1 hover:bg-lrgex-hover rounded text-lrgex-muted hover:text-white" title="Add Horizontal Separator"><Minus size={14}/></button>
                                                        <button onClick={() => addWebAppSeparator('VERTICAL')} className="p-1 hover:bg-lrgex-hover rounded text-lrgex-muted hover:text-white" title="Add Vertical Separator"><Columns size={14}/></button>
                                                    </div>

                                                    <button 
                                                        onClick={() => { setEditingWebApp(undefined); setShowWebAppModal(true); }}
                                                        className="text-xs bg-lrgex-orange hover:bg-orange-600 text-white px-3 py-1.5 rounded-full flex items-center gap-1 transition-colors shadow-lg shadow-orange-900/20"
                                                    >
                                                        <AppWindow size={14} /> Add App
                                                    </button>
                                                    <button 
                                                        onClick={() => toggleSectionVisibility('webApps')}
                                                        className={`p-1.5 rounded-full border transition-colors ${isVisible ? 'text-lrgex-muted border-transparent hover:bg-lrgex-panel' : 'text-lrgex-text bg-lrgex-panel border-lrgex-muted'}`}
                                                        title={isVisible ? "Hide Section" : "Show Section"}
                                                    >
                                                        {isVisible ? <Eye size={16} /> : <EyeOff size={16} />}
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                    
                                    {/* Auto Rows to allow separator to be small, but explicit card height */}
                                    <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 grid-flow-dense ${!isVisible ? 'pointer-events-none' : ''}`}>
                                        {filteredWebApps.map(app => {
                                            if (app.type === 'SEPARATOR') {
                                                return (
                                                    <div 
                                                        key={app.id} 
                                                        draggable={editMode}
                                                        onDragStart={(e) => {
                                                            if (editMode) {
                                                                e.dataTransfer.setData('webAppId', app.id);
                                                                e.dataTransfer.effectAllowed = 'move';
                                                            }
                                                        }}
                                                        onDragOver={(e) => editMode && e.preventDefault()}
                                                        onDrop={(e) => {
                                                            if (editMode) {
                                                                e.preventDefault();
                                                                const draggedId = e.dataTransfer.getData('webAppId');
                                                                if (draggedId && draggedId !== app.id) moveWebApp(draggedId, app.id);
                                                            }
                                                        }}
                                                        className={`relative group 
                                                            ${app.separatorType === 'HORIZONTAL' 
                                                                ? 'col-span-1 md:col-span-2 lg:col-span-3 xl:col-span-4 h-4 flex items-center justify-center my-2' 
                                                                : 'h-[160px] flex items-center justify-center w-full' 
                                                            }
                                                            ${editMode ? 'cursor-move hover:bg-lrgex-panel/50 rounded' : ''}
                                                        `}
                                                    >
                                                        {/* The Line */}
                                                        {app.separatorType === 'HORIZONTAL' ? (
                                                            <div className="w-full h-px bg-lrgex-border group-hover:bg-lrgex-orange/50 transition-colors relative">
                                                                 {/* Grip Handle for easier target in edit mode */}
                                                                 {editMode && (
                                                                    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-lrgex-bg px-2 text-lrgex-muted">
                                                                        <GripHorizontal size={12} />
                                                                    </div>
                                                                 )}
                                                            </div>
                                                        ) : (
                                                            <div className={`h-full w-px transition-colors relative
                                                                ${editMode ? 'bg-lrgex-border group-hover:bg-lrgex-orange/50' : 'bg-transparent'}
                                                            `}>
                                                                 {/* Grip Handle */}
                                                                 {editMode && (
                                                                    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-lrgex-bg py-1 text-lrgex-muted">
                                                                        <GripVertical size={12} />
                                                                    </div>
                                                                 )}
                                                            </div>
                                                        )}
                                                        
                                                        {/* Delete Button */}
                                                        {editMode && (
                                                            <button 
                                                                onClick={() => deleteWebApp(app.id)} 
                                                                className="absolute right-0 top-1/2 -translate-y-1/2 p-1 text-lrgex-muted hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                                                                title="Remove Separator"
                                                            >
                                                                <Trash2 size={12}/>
                                                            </button>
                                                        )}
                                                    </div>
                                                );
                                            }

                                            return (
                                                <div key={app.id} className="h-[160px]">
                                                    <WebAppCard 
                                                        app={app} 
                                                        editMode={editMode}
                                                        onEdit={(a) => { setEditingWebApp(a); setShowWebAppModal(true); }}
                                                        onDelete={deleteWebApp}
                                                        onDragStart={(e, id) => {
                                                            e.dataTransfer.setData('webAppId', id);
                                                            e.dataTransfer.effectAllowed = 'move';
                                                        }}
                                                        onDrop={(e, targetId) => {
                                                            const draggedId = e.dataTransfer.getData('webAppId');
                                                            if (draggedId && draggedId !== targetId) moveWebApp(draggedId, targetId);
                                                        }}
                                                    />
                                                </div>
                                            );
                                        })}
                                    </div>
                                </section>
                            );
                        }

                        if (section === 'widgets') {
                            return (
                                <section 
                                    key="widgets" 
                                    className={`animate-in fade-in duration-500 ${opacityClass} ${editMode ? 'ring-1 ring-transparent hover:ring-lrgex-border rounded-xl p-2 -m-2 transition-all' : ''}`}
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
                                            {!isVisible && editMode && <span className="text-[10px] font-normal text-lrgex-muted border border-lrgex-muted/30 px-2 py-0.5 rounded">HIDDEN</span>}
                                        </h2>
                                        {editMode && (
                                            <div className="flex gap-2">
                                                <button 
                                                    onClick={handleManualAddWidget} 
                                                    className="text-xs bg-lrgex-orange hover:bg-orange-600 text-white px-3 py-1.5 rounded-full flex items-center gap-1 transition-colors shadow-lg shadow-orange-900/20"
                                                >
                                                    <Plus size={14} /> New Widget
                                                </button>

                                                <button 
                                                    onClick={() => toggleSectionVisibility('widgets')}
                                                    className={`p-1.5 rounded-full border transition-colors ${isVisible ? 'text-lrgex-muted border-transparent hover:bg-lrgex-panel' : 'text-lrgex-text bg-lrgex-panel border-lrgex-muted'}`}
                                                    title={isVisible ? "Hide Section" : "Show Section"}
                                                >
                                                    {isVisible ? <Eye size={16} /> : <EyeOff size={16} />}
                                                </button>

                                                <div className="w-px h-6 bg-lrgex-border mx-1" />

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
                                    
                                    {/* GRID LAYOUT - Dense Packing for Fluidity */}
                                    <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 auto-rows-[180px] gap-6 grid-flow-dense ${!isVisible ? 'pointer-events-none' : ''}`}>
                                        {data.widgets.map((widget) => {
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
                                                    className={getWidgetClasses(widget.w, widget.h)}
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
                                    className={`flex-1 ${opacityClass} ${editMode ? 'ring-1 ring-transparent hover:ring-lrgex-border rounded-xl p-2 -m-2 transition-all' : ''}`}
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
                                            {!isVisible && editMode && <span className="text-[10px] font-normal text-lrgex-muted border border-lrgex-muted/30 px-2 py-0.5 rounded ml-2">HIDDEN</span>}
                                        </h2>
                                        
                                        {editMode && (
                                            <div className="flex items-center gap-2">
                                                 {!isAddingCategory && (
                                                    <button 
                                                        onClick={() => setIsAddingCategory(true)} 
                                                        className="text-xs bg-lrgex-orange hover:bg-orange-600 text-white px-3 py-1.5 rounded-full flex items-center gap-1 transition-colors shadow-lg shadow-orange-900/20"
                                                    >
                                                        <FolderPlus size={14} /> New Category
                                                    </button>
                                                )}

                                                <button 
                                                    onClick={() => toggleSectionVisibility('bookmarks')}
                                                    className={`p-1.5 rounded-full border transition-colors ${isVisible ? 'text-lrgex-muted border-transparent hover:bg-lrgex-panel' : 'text-lrgex-text bg-lrgex-panel border-lrgex-muted'}`}
                                                    title={isVisible ? "Hide Section" : "Show Section"}
                                                >
                                                    {isVisible ? <Eye size={16} /> : <EyeOff size={16} />}
                                                </button>

                                                {isAddingCategory && (
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
                                        )}
                                    </div>
                                    
                                    {/* GRID LAYOUT - Dense Packing for Bookmarks too */}
                                    <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 auto-rows-[150px] gap-6 grid-flow-dense ${!isVisible ? 'pointer-events-none' : ''}`}>
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
                                                className={getWidgetClasses(category.w, category.h)}
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
            
            <footer className="w-full py-4 border-t border-lrgex-border text-center bg-lrgex-bg shrink-0 z-10">
                <p className="text-xs text-lrgex-muted font-mono">
                Made by LRGEX ver 2.4 {year}
                </p>
            </footer>
        </div>

        <aside className={`${sidebarOpen ? 'w-[400px] border-l' : 'w-0 border-l-0'} transition-[width] duration-300 ease-in-out bg-lrgex-menu/30 border-lrgex-border flex flex-col shrink-0 overflow-hidden relative`}>
             <div className="w-[400px] h-full flex flex-col">
                <AiWidget 
                    settings={data.aiSettings} 
                    onUpdateSettings={updateAiSettings}
                    onAddWidget={handleAiAddWidget} 
                    onAddBookmark={handleAiAddBookmark}
                    onAddWebApp={handleAiAddWebApp}
                    externalPrompt={aiPromptOverride}
                    onClearExternalPrompt={() => setAiPromptOverride(null)}
                />
             </div>
        </aside>

      </div>
    </div>
  );
};

export default App;
