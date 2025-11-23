
import React, { useEffect, useState } from 'react';
import { ProxmoxData, UniversalWidgetConfig } from '../../types';
import { Server, Cpu, HardDrive, Settings, AlertTriangle } from 'lucide-react';

interface ProxmoxWidgetProps {
    config?: UniversalWidgetConfig;
}

export const ProxmoxWidget: React.FC<ProxmoxWidgetProps> = ({ config }) => {
  const [data, setData] = useState<ProxmoxData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!config?.endpoint) return;

    const controller = new AbortController();
    const loadData = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(config.endpoint, {
            headers: config.headers,
            signal: controller.signal
        });
        if (!res.ok) throw new Error(`Status: ${res.status}`);
        const json = await res.json();
        
        // Mapping logic: Attempt to detect if it's a Node status or Cluster resources
        // This is a best-effort mapping for real data without mock service
        let nodes = [];
        let cpu = 0;
        let ramUsed = 0;
        let ramTotal = 0;
        let uptime = '';

        if (json.data && Array.isArray(json.data)) {
             // Cluster resources type response
             nodes = json.data.filter((r: any) => r.type === 'node').map((n: any) => ({
                 name: n.node,
                 status: n.status
             }));
             // Sum up if multiple nodes or take first
             if (nodes.length > 0) {
                 // Calculate average or sum? Let's take max for now or first
                 cpu = json.data.find((r: any) => r.type === 'node')?.cpu || 0;
                 ramUsed = json.data.find((r: any) => r.type === 'node')?.mem || 0;
                 ramTotal = json.data.find((r: any) => r.type === 'node')?.maxmem || 0;
                 uptime = Math.floor((json.data.find((r: any) => r.type === 'node')?.uptime || 0) / 3600) + 'h';
             }
        } else if (json.data) {
             // Single node status
             cpu = json.data.cpu || 0;
             ramUsed = json.data.memory?.used || 0;
             ramTotal = json.data.memory?.total || 0;
             uptime = Math.floor((json.data.uptime || 0) / 3600) + 'h';
             nodes = [{ name: 'Node', status: 'online' }];
        }

        // Convert bytes to GB for RAM
        const ramUsedGB = ramUsed > 0 ? ramUsed / (1024*1024*1024) : 0;
        const ramTotalGB = ramTotal > 0 ? ramTotal / (1024*1024*1024) : 0;
        
        setData({
            cpuUsage: Math.round(cpu * 100),
            ramUsage: ramUsedGB,
            ramTotal: parseFloat(ramTotalGB.toFixed(1)),
            uptime,
            nodes
        });

      } catch (e: any) {
         if (e.name !== 'AbortError') {
             setError(e.message);
         }
      } finally {
         if (!controller.signal.aborted) setLoading(false);
      }
    };

    loadData();
    const interval = setInterval(loadData, config.refreshInterval || 10000);
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
              <p className="text-[10px] opacity-50">e.g. /api2/json/cluster/resources</p>
          </div>
      );
  }

  if (error) {
      return (
          <div className="flex flex-col items-center justify-center h-full text-red-400 p-4 text-center">
              <AlertTriangle size={24} className="mb-2 opacity-50" />
              <p className="text-xs font-bold">Fetch Error</p>
              <p className="text-[10px] opacity-70">{error}</p>
          </div>
      );
  }

  if (!data || loading && !data) return <div className="animate-pulse flex-1 bg-slate-700/20 rounded-md h-full m-4" />;

  const cpuColor = data.cpuUsage > 80 ? 'text-red-400' : 'text-emerald-400';
  const ramPercent = data.ramTotal > 0 ? (data.ramUsage / data.ramTotal) * 100 : 0;

  return (
    <div className="space-y-4 h-full justify-center flex flex-col p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
            <div className="p-2 bg-orange-500/10 rounded-lg text-orange-500">
                <Server size={20} />
            </div>
            <div>
                <div className="text-sm font-bold text-white">Cluster Status</div>
                <div className="text-xs text-slate-400">Uptime: {data.uptime}</div>
            </div>
        </div>
        <div className="flex gap-1">
            {data.nodes.map((node, i) => (
                <div 
                    key={i} 
                    title={`${node.name}: ${node.status}`}
                    className={`w-3 h-3 rounded-full ${node.status === 'online' ? 'bg-emerald-500' : 'bg-red-500'}`}
                />
            ))}
        </div>
      </div>

      <div className="space-y-3">
        <div>
            <div className="flex justify-between text-xs mb-1 text-slate-300">
                <span className="flex items-center gap-1"><Cpu size={12} /> CPU</span>
                <span className={cpuColor}>{data.cpuUsage}%</span>
            </div>
            <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                <div 
                    className={`h-full transition-all duration-500 ${data.cpuUsage > 80 ? 'bg-red-500' : 'bg-emerald-500'}`} 
                    style={{ width: `${data.cpuUsage}%` }} 
                />
            </div>
        </div>

        <div>
            <div className="flex justify-between text-xs mb-1 text-slate-300">
                <span className="flex items-center gap-1"><HardDrive size={12} /> RAM</span>
                <span>{data.ramUsage.toFixed(1)} / {data.ramTotal} GB</span>
            </div>
            <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                <div 
                    className="h-full bg-blue-500 transition-all duration-500" 
                    style={{ width: `${ramPercent}%` }} 
                />
            </div>
        </div>
      </div>
    </div>
  );
};
