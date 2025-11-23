import { ProxmoxData, DownloadClientData } from '../types';

// Simulates fetching data from a Proxmox Node
export const fetchProxmoxData = async (): Promise<ProxmoxData> => {
  // In a real app, this would be a fetch() to your proxmox API proxy
  await new Promise(resolve => setTimeout(resolve, 500)); // Simulate network latency
  
  return {
    cpuUsage: Math.floor(Math.random() * 30) + 5, // 5-35%
    ramUsage: 16 + Math.random() * 4, // 16-20GB used
    ramTotal: 64,
    uptime: '14d 03h 22m',
    nodes: [
      { name: 'pve-01', status: 'online' },
      { name: 'pve-02', status: 'online' },
      { name: 'pve-backup', status: 'offline' },
    ]
  };
};

// Simulates fetching data from SABnzbd or NZBGet
export const fetchDownloadData = async (): Promise<DownloadClientData> => {
  await new Promise(resolve => setTimeout(resolve, 500));

  const isDownloading = Math.random() > 0.3;

  if (!isDownloading) {
    return {
      status: 'Idle',
      speed: '0 MB/s',
      timeLeft: '-',
      queueSize: '0 GB',
      currentFile: 'No downloads',
      progress: 0
    };
  }

  return {
    status: 'Downloading',
    speed: `${(Math.random() * 50 + 10).toFixed(1)} MB/s`,
    timeLeft: '04m 20s',
    queueSize: '4.2 GB',
    currentFile: 'Linux_ISO_Debian_12.iso',
    progress: Math.floor(Math.random() * 100)
  };
};

export const fetchWeather = async (): Promise<{ temp: number; condition: string }> => {
  // Mock weather
  return {
    temp: 22,
    condition: 'Partly Cloudy'
  };
};