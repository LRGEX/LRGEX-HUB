
export enum WidgetType {
  CLOCK = 'CLOCK',
  UNIVERSAL = 'UNIVERSAL', // Replaces hardcoded Proxmox/Sabnzbd with generic fetcher
  AI = 'AI',
  WEATHER = 'WEATHER',
  PROXMOX = 'PROXMOX',
  SABNZBD = 'SABNZBD'
}

export type AiProvider = 'GEMINI' | 'OPENROUTER' | 'OPENAI' | 'OLLAMA';
export type AiMode = 'COMMANDER' | 'ASSISTANT';

export interface AiSettings {
  provider: AiProvider;
  mode: AiMode;
  chatFontSize: 'small' | 'medium' | 'large';
  
  // Provider Configs
  geminiKey: string;
  
  openRouterKey: string;
  openRouterModel: string;
  
  openAiKey: string;
  openAiModel: string;
  openAiUrl: string; // Custom Base URL (optional)
  
  ollamaUrl: string;
  ollamaModel: string;
}

export interface UniversalWidgetConfig {
  endpoint: string;
  method: 'GET' | 'POST';
  headers?: Record<string, string>;
  jsonPath: string; // path to data e.g. "data.stats.cpu_usage"
  refreshInterval: number;
  label: string;
  unit?: string;
  icon?: string;
  customCode?: string; // Valid Javascript code for React component body
  customData?: Record<string, any>; // Arbitrary data for custom widgets to persist state
}

export interface WidgetTemplate {
  id: string;
  name: string;
  config: UniversalWidgetConfig;
}

export interface WidgetConfig {
  id: string;
  type: WidgetType;
  title?: string;
  w?: number;
  h?: number;
  config?: UniversalWidgetConfig; // Store specific config here
}

export interface LinkItem {
  id: string;
  title: string;
  url: string;
  iconUrl?: string;
}

export interface LinkCategory {
  id: string;
  title: string;
  iconUrl?: string;
  links: LinkItem[];
  w?: number;
  h?: number;
}

export interface WebApp {
  id: string;
  type?: 'APP' | 'SEPARATOR'; // Default is APP
  separatorType?: 'HORIZONTAL' | 'VERTICAL';
  name: string;
  url: string;
  description?: string;
  iconUrl?: string;
  category: string; // Used for tabs
}

export interface GeneralSettings {
  timezone: string;
  aiSidebarOpen: boolean;
  layoutAlign: 'start' | 'center' | 'end';
  defaultWebAppTab: string;
}

export type BackupInterval = 'HOURLY' | 'DAILY' | 'WEEKLY';

export interface BackupSettings {
    enabled: boolean;
    schedule: BackupInterval;
    lastBackupAt: number | null;
}

export interface AppData {
  widgets: WidgetConfig[];
  categories: LinkCategory[];
  webApps: WebApp[];
  aiSettings: AiSettings;
  templates: WidgetTemplate[];
  generalSettings: GeneralSettings;
  backupSettings: BackupSettings;
  sectionOrder: string[]; // 'widgets' | 'bookmarks' | 'webApps'
  sectionVisibility: Record<string, boolean>; // e.g. { 'widgets': true, 'bookmarks': false }
  chatHistories: ChatHistory[]; // Saved AI chat sessions
}

export interface ChatMessage {
  role: 'user' | 'model' | 'system';
  text: string;
  image?: string; // Base64 Data URI
}

export interface ChatHistory {
  id: string;
  name: string;
  mode: AiMode; // COMMANDER or ASSISTANT
  provider: AiProvider; // GEMINI, OPENAI, etc.
  messageCount: number; // Number of messages (for display only)
  createdAt: number;
  updatedAt: number;
}

export interface ChatData {
  id: string;
  messages: ChatMessage[];
}

export interface ProxmoxNode {
  name: string;
  status: string;
}

export interface ProxmoxData {
  cpuUsage: number;
  ramUsage: number;
  ramTotal: number;
  uptime: string;
  nodes: ProxmoxNode[];
}

export interface DownloadClientData {
  status: string;
  speed: string;
  timeLeft: string;
  queueSize: string;
  currentFile: string;
  progress: number;
}
