
import React, { useEffect, useState } from 'react';
import { DownloadClientData, UniversalWidgetConfig } from '../../types';
import { Download, PauseCircle, PlayCircle, Settings, AlertTriangle } from 'lucide-react';

interface SabnzbdWidgetProps {
    config?: UniversalWidgetConfig;
}

export const SabnzbdWidget: React.FC<SabnzbdWidgetProps> = ({ config }) => {
  const [data, setData] = useState<DownloadClientData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!config?.endpoint) return;
    
    const controller = new AbortController();
    const loadData = async () => {
      setError(null);
      try {
          const res = await fetch(config.endpoint, { headers: config.headers, signal: controller.signal });
          if(!res.ok) throw new Error(`Status: ${res.status}`);
          const json = await res.json();
          
          // Map Real SABnzbd Queue Data
          // Expected structure: { queue: { status: 'Downloading', speed: '100 K', timeleft: '0:00:00', mbleft: '0', slots: [...] } }
          const q = json.queue || {};
          const currentSlot = q.slots && q.slots.length > 0 ? q.slots[0] : null;
          
          setData({
              status: q.status || 'Idle',
              speed: q.speed || '0 B/s',
              timeLeft: q.timeleft || '-',
              queueSize: q.mbleft ? `${q.mbleft} MB` : '0 MB',
              currentFile: currentSlot ? currentSlot.filename : 'No downloads',
              progress: currentSlot && currentSlot.mb > 0 
                ? Math.round(((currentSlot.mb - currentSlot.mbleft) / currentSlot.mb) * 100) 
                : 0
          });
      } catch (e: any) {
          if (e.name !== 'AbortError') setError(e.message);
      }
    };
    
    loadData();
    const interval = setInterval(loadData, config.refreshInterval || 2000);
    return () => {
        controller.abort();
        clearInterval(interval);
    };
  }, [config]);

  if (!config?.endpoint) {
      return (
          <div className="flex flex-col items-center justify-center h-full text-lrgex-muted p-4 text-center">
              <Settings size={24} className="mb-2 opacity-50" />
              <p className="text-xs">Configure Endpoint</p>
          </div>
      );
  }
  
  if (error) {
      return (
          <div className="flex flex-col items-center justify-center h-full text-red-400 p-4 text-center">
              <AlertTriangle size={24} className="mb-2 opacity-50" />
              <p className="text-xs font-bold">Connection Failed</p>
          </div>
      );
  }

  if (!data) return <div className="animate-pulse flex-1 bg-slate-700/20 rounded-md m-4" />;

  const isDownloading = data.status === 'Downloading';

  return (
    <div className="flex flex-col h-full justify-between p-4">
        <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
                 <div className={`p-2 rounded-lg ${isDownloading ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-700/50 text-slate-400'}`}>
                    <Download size={20} />
                 </div>
                 <div>
                     <div className="text-lg font-bold text-white tracking-tight">{data.speed}</div>
                     <div className="text-xs text-slate-400">{data.status} • {data.timeLeft} left</div>
                 </div>
            </div>
            {isDownloading ? <PlayCircle className="text-emerald-500" /> : <PauseCircle className="text-slate-600" />}
        </div>

        <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/50">
            <div className="flex justify-between text-xs text-slate-300 mb-1 truncate">
                <span className="truncate flex-1 mr-2" title={data.currentFile}>{data.currentFile}</span>
                <span>{data.progress}%</span>
            </div>
            <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                <div 
                    className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500"
                    style={{ width: `${data.progress}%` }}
                />
            </div>
        </div>
    </div>
  );
};
