
import React, { useEffect, useState } from 'react';
import { UniversalWidgetConfig } from '../../types';
import { Activity, AlertTriangle, Check, Wifi, Globe, Server, Database, Edit2, Save, Upload, Code } from 'lucide-react';
import { CustomCodeWidget } from './CustomCodeWidget';

// Helper to safely get value from nested object using string path "a.b.c"
const getNestedValue = (obj: any, path: string) => {
  if (!path) return obj;
  return path.split('.').reduce((acc, part) => (acc && acc[part] !== undefined) ? acc[part] : undefined, obj);
};

const Icons: Record<string, any> = {
    'activity': Activity,
    'wifi': Wifi,
    'globe': Globe,
    'server': Server,
    'db': Database
};

interface UniversalWidgetProps {
  config?: UniversalWidgetConfig;
  onUpdate?: (newConfig: UniversalWidgetConfig) => void;
  onSaveTemplate?: (config: UniversalWidgetConfig) => void;
  onReportError?: (error: string) => void;
  editMode?: boolean;
}

export const UniversalWidget: React.FC<UniversalWidgetProps> = ({ config, onUpdate, onSaveTemplate, onReportError, editMode = false }) => {
  const [value, setValue] = useState<string | number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Edit State
  const [isEditing, setIsEditing] = useState(false);
  const [editEndpoint, setEditEndpoint] = useState('');
  const [editPath, setEditPath] = useState('');
  const [editLabel, setEditLabel] = useState('');
  const [editHeaders, setEditHeaders] = useState('');
  const [editIcon, setEditIcon] = useState('');
  const [editCustomCode, setEditCustomCode] = useState('');

  useEffect(() => {
    if (!config) return;
    setEditEndpoint(config.endpoint || '');
    setEditPath(config.jsonPath || '');
    setEditLabel(config.label || '');
    setEditHeaders(config.headers ? JSON.stringify(config.headers) : '');
    setEditIcon(config.icon || '');
    setEditCustomCode(config.customCode || '');

    // If we have custom code, we don't fetch data automatically
    if (config.customCode) {
        return;
    }

    const controller = new AbortController();
    const signal = controller.signal;

    const fetchData = async () => {
      if (!config.endpoint) return;
      
      setLoading(true);
      setError(null);
      
      try {
        const res = await fetch(config.endpoint, {
          method: config.method || 'GET',
          headers: config.headers,
          signal
        });
        
        if (!res.ok) throw new Error(`Status: ${res.status}`);
        
        const json = await res.json();
        const extracted = getNestedValue(json, config.jsonPath);
        
        if (!signal.aborted) {
            if (extracted === undefined) {
                 setValue(null);
                 setError("Path not found");
            } else if (extracted === null) {
                 setValue("null");
            } else if (typeof extracted === 'object') {
                 setValue("Obj");
            } else {
                 setValue(extracted);
            }
        }
      } catch (e: any) {
        if (signal.aborted) return;
        if (e.name === 'AbortError') return;
        console.debug("Widget Fetch Error:", e.message);
        if (e.message.includes('Failed to fetch')) setError("Network/CORS");
        else if (e.message.includes('Status:')) setError(e.message);
        else setError("Error");
        
        if (value === null && !isEditing) setIsEditing(true);
      } finally {
        if (!signal.aborted) setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, config.refreshInterval || 10000);
    return () => {
        controller.abort();
        clearInterval(interval);
    };
  }, [config]);

  const parseHeaders = () => {
      if (!editHeaders.trim()) return undefined;
      try { return JSON.parse(editHeaders); } catch (e) { return null; }
  };

  const handleSave = () => {
      if (onUpdate && config) {
          const parsedHeaders = parseHeaders();
          if (parsedHeaders === null) {
              setError("Invalid JSON Headers");
              return;
          }

          onUpdate({
              ...config,
              endpoint: editEndpoint,
              jsonPath: editPath,
              label: editLabel,
              headers: parsedHeaders,
              icon: editIcon,
              customCode: editCustomCode
          });
          setIsEditing(false);
          setError(null);
          setValue(null); 
      }
  };

  const handleTemplateSave = (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation(); 
      if (onSaveTemplate && config) {
          const parsedHeaders = parseHeaders();
          if (parsedHeaders === null) return;
          
          onSaveTemplate({
              ...config,
              endpoint: editEndpoint,
              jsonPath: editPath,
              label: editLabel,
              headers: parsedHeaders,
              icon: editIcon,
              customCode: editCustomCode,
              customData: config.customData
          });
      }
  };

  const handleCustomDataUpdate = (newData: Record<string, any>) => {
      if (onUpdate && config) {
          onUpdate({
              ...config,
              customData: newData
          });
      }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1024 * 1024 * 2) return alert("Image too large (<2MB)");

    const reader = new FileReader();
    reader.onloadend = () => {
        if (typeof reader.result === 'string') setEditIcon(reader.result);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  if (!config) return <div className="text-red-400 p-2">Invalid Config</div>;

  const isCustomIcon = config.icon && (config.icon.startsWith('http') || config.icon.startsWith('data:'));
  const LucideIcon = Icons[config.icon || 'activity'] || Activity;
  // Show edit if manually toggled, or if error AND no custom code
  const showEdit = isEditing || (value === null && !!error && !config.customCode);
  const hasCustomCode = !!config.customCode && config.customCode.trim().length > 0;
  
  // Floating Header Visibility: Only visible in Edit Mode (global or local)
  const showHeader = editMode || isEditing;

  return (
    <div className="flex flex-col h-full justify-between relative group/widget">
        {/* Header - Floating for ALL widgets, visible only in Edit Mode */}
        <div className={`flex items-center gap-2 z-20 absolute top-0 left-0 w-full p-2 transition-all duration-200
            ${showHeader 
                ? 'opacity-100 bg-gradient-to-b from-black/80 to-transparent pointer-events-auto' 
                : 'opacity-0 pointer-events-none'
            }`}
        >
            <div className="p-2 bg-lrgex-menu rounded-lg text-lrgex-orange border border-lrgex-border w-[38px] h-[38px] flex items-center justify-center shrink-0 overflow-hidden">
                {isCustomIcon ? (
                    <img src={config.icon} alt="icon" className="w-full h-full object-contain" />
                ) : (
                    <LucideIcon size={20} />
                )}
            </div>
            <div className="flex-1 min-w-0">
                 <div className={`text-xs uppercase tracking-wider font-semibold truncate text-white shadow-black drop-shadow-md`}>
                    {config.label}
                 </div>
                 {!hasCustomCode && <div className="text-[10px] text-lrgex-text/70 truncate w-full shadow-black drop-shadow-md" title={config.endpoint}>{config.endpoint}</div>}
                 {hasCustomCode && <div className="text-[10px] text-emerald-400/80 flex items-center gap-1 shadow-black drop-shadow-md"><Code size={8}/> Custom Widget</div>}
            </div>
            <button onClick={() => setIsEditing(!isEditing)} className="text-lrgex-muted hover:text-lrgex-text transition-opacity">
                <Edit2 size={12} />
            </button>
        </div>

        {/* Content - Full Bleed */}
        <div className={`flex-1 flex items-center justify-center w-full relative min-h-0 overflow-hidden absolute inset-0`}>
            {showEdit ? (
                <div className="w-full h-full absolute inset-0 bg-lrgex-bg/95 p-2 rounded border border-lrgex-border z-50 backdrop-blur-sm flex flex-col justify-between overflow-y-auto custom-scrollbar m-1">
                    <div className="space-y-2">
                        {error && <div className="text-[10px] text-red-400 flex items-center gap-1 font-bold"><AlertTriangle size={10}/> {error}</div>}
                        <input 
                            className="w-full bg-lrgex-panel border border-lrgex-border rounded px-1 py-1 text-[10px] text-lrgex-text outline-none focus:border-lrgex-orange font-bold"
                            placeholder="Widget Title"
                            value={editLabel}
                            onChange={e => setEditLabel(e.target.value)}
                        />
                        
                        <div className="text-[9px] text-lrgex-muted uppercase font-bold mt-2">Data Source</div>
                        <input 
                            className="w-full bg-lrgex-panel border border-lrgex-border rounded px-1 py-1 text-[10px] text-lrgex-text outline-none focus:border-lrgex-orange"
                            placeholder="API URL (Optional)"
                            value={editEndpoint}
                            onChange={e => setEditEndpoint(e.target.value)}
                        />
                        <input 
                            className="w-full bg-lrgex-panel border border-lrgex-border rounded px-1 py-1 text-[10px] text-lrgex-text outline-none focus:border-lrgex-orange"
                            placeholder="Path (e.g. data.cpu)"
                            value={editPath}
                            onChange={e => setEditPath(e.target.value)}
                        />
                        
                        <div className="text-[9px] text-lrgex-muted uppercase font-bold mt-2">Advanced</div>
                        <textarea 
                            className="w-full h-20 bg-lrgex-panel border border-lrgex-border rounded px-1 py-1 text-[10px] text-emerald-300 font-mono outline-none focus:border-lrgex-orange resize-none"
                            placeholder="// Custom React Code Body..."
                            value={editCustomCode}
                            onChange={e => setEditCustomCode(e.target.value)}
                        />
                        
                        <div className="flex items-center gap-1 bg-lrgex-panel border border-lrgex-border rounded px-1 py-1">
                            <input 
                                className="flex-1 bg-transparent text-[10px] text-lrgex-text outline-none min-w-0"
                                placeholder="Icon URL"
                                value={editIcon}
                                onChange={e => setEditIcon(e.target.value)}
                            />
                            <label className="cursor-pointer text-lrgex-muted hover:text-lrgex-orange">
                                <Upload size={10} />
                                <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                            </label>
                        </div>
                    </div>
                    <div className="flex gap-1 mt-2">
                         <button type="button" onClick={handleSave} className="flex-1 bg-lrgex-orange text-white text-[10px] py-1 rounded hover:bg-orange-600 flex items-center justify-center gap-1"><Check size={10} /> Apply</button>
                        {onSaveTemplate && (
                            <button type="button" onClick={handleTemplateSave} className="flex-1 bg-blue-600 text-white text-[10px] py-1 rounded hover:bg-blue-500 flex items-center justify-center gap-1"><Save size={10} /> Template</button>
                        )}
                        <button type="button" onClick={() => setIsEditing(false)} className="px-2 bg-lrgex-panel text-lrgex-muted text-[10px] py-1 rounded hover:bg-lrgex-hover">Cancel</button>
                    </div>
                </div>
            ) : hasCustomCode ? (
                <CustomCodeWidget 
                    code={config.customCode!} 
                    customData={config.customData || {}}
                    onSetCustomData={handleCustomDataUpdate}
                    onReportError={onReportError} 
                />
            ) : (
                <div className="text-center w-full">
                    <div className="text-3xl font-bold text-lrgex-text tracking-tight flex items-baseline justify-center gap-1 truncate px-1">
                        {loading && value === null ? (
                            <div className="animate-spin w-5 h-5 border-2 border-lrgex-muted border-t-lrgex-orange rounded-full"></div>
                        ) : (
                            value
                        )}
                        {config.unit && value !== null && <span className="text-sm text-lrgex-muted font-normal">{config.unit}</span>}
                    </div>
                </div>
            )}
        </div>
        
        {/* Status Indicator (Only visible in Edit Mode now, to keep View mode clean?) */}
        {/* Actually, users might want to see error dots in View Mode. Let's keep it, but move it to bottom right absolute */}
        {!showEdit && !hasCustomCode && (
            <div className="absolute bottom-2 right-2 flex justify-between items-center z-10 pointer-events-none">
                <div className={`w-2 h-2 rounded-full shadow-sm ${error ? 'bg-red-500' : 'bg-lrgex-orange/50'} ${loading ? 'animate-pulse' : ''}`} title={error || 'Active'} />
            </div>
        )}
    </div>
  );
};
