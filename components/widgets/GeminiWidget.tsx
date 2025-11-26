
import React, { useState, useRef, useEffect } from 'react';
import { sendMessageGemini, sendMessageOpenAi, sendMessageOllama, ToolExecutors, generateChatTitle } from '../../services/aiService';
import { ChatMessage, AiSettings, UniversalWidgetConfig, WidgetType, ChatHistory, AiMode, AiProvider, ChatData } from '../../types';
import { Send, Bot, User, Loader2, Settings, ShieldAlert, Cpu, Trash2, Copy, Check, RotateCcw, Paperclip, X, Type, Square, MessageSquare, Plus, Edit2, Save } from 'lucide-react';

interface AiWidgetProps {
  settings: AiSettings;
  onUpdateSettings: (s: AiSettings) => void;
  onAddWidget: (type: WidgetType, config?: UniversalWidgetConfig) => void;
  onAddBookmark: (categoryName: string, title: string, url: string, iconUrl?: string, categoryIconUrl?: string) => void;
  onAddWebApp?: (args: { name: string; url: string; description?: string; category: string; iconUrl?: string }) => void;
  externalPrompt?: string | null;
  onClearExternalPrompt?: () => void;
  chatHistories: ChatHistory[];
  onSaveChat: (id: string | null, name: string, mode: AiMode, provider: AiProvider, messages: ChatMessage[]) => Promise<string>;
  onLoadChatMessages: (id: string) => Promise<ChatMessage[]>;
  onDeleteChat: (id: string) => Promise<void>;
  onRenameChat: (id: string, newName: string) => void;
}

// --- Copy Helper ---
const copyTextToClipboard = async (text: string): Promise<boolean> => {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch (err) {
        // Fallback for non-secure contexts or older browsers
        try {
            const textArea = document.createElement("textarea");
            textArea.value = text;
            
            // Ensure it's not visible but part of DOM
            textArea.style.position = "fixed";
            textArea.style.left = "-9999px";
            textArea.style.top = "0";
            document.body.appendChild(textArea);
            
            textArea.focus();
            textArea.select();
            
            const successful = document.execCommand('copy');
            document.body.removeChild(textArea);
            return successful;
        } catch (err) {
            console.error('Fallback copy failed', err);
            return false;
        }
    }
};

const CopyButton: React.FC<{ text: string; className?: string; size?: number }> = ({ text, className, size = 12 }) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = async (e: React.MouseEvent) => {
        e.stopPropagation();
        const success = await copyTextToClipboard(text);
        if (success) {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    return (
        <button 
            onClick={handleCopy}
            className={className}
            title={copied ? "Copied!" : "Copy"}
        >
            {copied ? <Check size={size} className="text-emerald-400" /> : <Copy size={size} />}
        </button>
    );
};

// --- Simple Markdown Renderer (Zero-Dependency) ---
const MarkdownRenderer: React.FC<{ content: string }> = ({ content }) => {
    const parts = content.split(/(```[\s\S]*?```)/g);

    return (
        <div className="space-y-2 min-w-0">
            {parts.map((part, index) => {
                if (part.startsWith('```') && part.endsWith('```')) {
                    const content = part.slice(3, -3).trim();
                    const match = content.match(/^([a-z0-9]+)\n/i);
                    const lang = match ? match[1] : '';
                    const code = match ? content.slice(match[0].length) : content;
                    
                    return (
                        <div key={index} className="my-2 bg-[#1e1e1e] border border-[#333] rounded-md overflow-hidden font-mono group relative text-xs">
                            {lang && <div className="px-2 py-1 bg-[#252525] text-[10px] text-[#888] border-b border-[#333]">{lang}</div>}
                            <div className="p-2 overflow-x-auto custom-scrollbar text-emerald-300 whitespace-pre">{code}</div>
                            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <CopyButton 
                                    text={code} 
                                    className="p-1 bg-lrgex-panel/80 hover:bg-lrgex-orange text-lrgex-muted hover:text-white rounded transition-colors" 
                                />
                            </div>
                        </div>
                    );
                }

                return (
                    <div key={index} className="whitespace-pre-wrap leading-relaxed break-words">
                         {part.split('\n').map((line, i) => {
                             if (line.startsWith('### ')) return <h4 key={i} className="font-bold text-sm text-lrgex-orange mt-2 mb-1">{parseInline(line.slice(4))}</h4>;
                             if (line.startsWith('## ')) return <h3 key={i} className="font-bold text-sm text-lrgex-text mt-3 mb-1">{parseInline(line.slice(3))}</h3>;

                             if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
                                 return (
                                     <div key={i} className="flex items-start gap-2 pl-1 mb-1">
                                         <div className="w-1 h-1 rounded-full bg-lrgex-muted mt-1.5 shrink-0" />
                                         <span>{parseInline(line.trim().substring(2))}</span>
                                     </div>
                                 );
                             }
                             
                             const numMatch = line.match(/^(\d+)\.\s/);
                             if (numMatch) {
                                return (
                                     <div key={i} className="flex items-start gap-1 pl-1 mb-1">
                                         <span className="text-lrgex-muted font-mono text-[10px] pt-0.5">{numMatch[1]}.</span>
                                         <span>{parseInline(line.substring(numMatch[0].length))}</span>
                                     </div>
                                 );
                             }

                             if (!line.trim()) return <div key={i} className="h-2" />;

                             return <div key={i}>{parseInline(line)}</div>;
                         })}
                    </div>
                );
            })}
        </div>
    );
};

const parseInline = (text: string): React.ReactNode[] => {
    if (!text) return [];
    const regex = /(\*\*.*?\*\*|`.*?`|\[.*?\]\(.*?\))/g;
    const parts = text.split(regex);

    return parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={i} className="font-bold text-white">{part.slice(2, -2)}</strong>;
        }
        if (part.startsWith('`') && part.endsWith('`')) {
            return <code key={i} className="bg-lrgex-bg border border-lrgex-border px-1 rounded text-lrgex-orange font-mono text-[10px] break-all">{part.slice(1, -1)}</code>;
        }
        const linkMatch = part.match(/^\[(.*?)\]\((.*?)\)$/);
        if (linkMatch) {
            return <a key={i} href={linkMatch[2]} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline break-all">{linkMatch[1]}</a>;
        }
        return part;
    });
};

export const AiWidget: React.FC<AiWidgetProps> = ({ settings, onUpdateSettings, onAddWidget, onAddBookmark, onAddWebApp, externalPrompt, onClearExternalPrompt, chatHistories, onSaveChat, onLoadChatMessages, onDeleteChat, onRenameChat }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showChatList, setShowChatList] = useState(false);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [currentChatName, setCurrentChatName] = useState('New Chat');
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [confirmDeleteChatId, setConfirmDeleteChatId] = useState<string | null>(null);
  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [editingChatName, setEditingChatName] = useState('');
  const abortControllerRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const historyRef = useRef<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const titleGeneratedRef = useRef(false);

  useEffect(() => {
    if (externalPrompt) {
        setInput(externalPrompt);
        if (onClearExternalPrompt) onClearExternalPrompt();
        setTimeout(() => {
             const inputEl = document.querySelector('textarea[placeholder*="Ask"]') as HTMLTextAreaElement;
             if(inputEl) inputEl.focus();
        }, 100);
    }
  }, [externalPrompt, onClearExternalPrompt]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, showSettings, pendingImage]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
    }
  }, [input]);

  const clearChat = () => {
      setMessages([]);
      historyRef.current = [];
      setPendingImage(null);
      titleGeneratedRef.current = false;
      if (abortControllerRef.current) {
          abortControllerRef.current.abort();
          setIsLoading(false);
      }
  };

  // Chat History Functions
  const generateChatNameLocal = (messages: ChatMessage[]): string => {
      if (messages.length === 0) return 'New Chat';
      const firstUserMsg = messages.find(m => m.role === 'user');
      if (firstUserMsg) {
          const preview = firstUserMsg.text.slice(0, 30);
          return preview.length < firstUserMsg.text.length ? `${preview}...` : preview;
      }
      return 'New Chat';
  };

  const handleSaveCurrentChat = async () => {
      if (messages.length > 0) {
          let chatName = currentChatId ? currentChatName : 'New Chat';
          
          // Logic: If it's a new chat OR name is default, and we have enough messages, try to generate a title
          if ((!currentChatId || currentChatName === 'New Chat') && messages.length >= 2) {
              if (!titleGeneratedRef.current) {
                   titleGeneratedRef.current = true;
                   const autoTitle = await generateChatTitle(settings, messages);
                   if (autoTitle && autoTitle !== 'New Chat') {
                       chatName = autoTitle;
                       setCurrentChatName(autoTitle);
                   } else {
                       // Fallback to local gen if AI fails or returns empty
                       if (!currentChatId || currentChatName === 'New Chat') {
                           chatName = generateChatNameLocal(messages);
                           setCurrentChatName(chatName);
                       }
                   }
              }
          } else if (!currentChatId && currentChatName === 'New Chat') {
              // Basic fallback for first save if < 2 messages
              chatName = generateChatNameLocal(messages);
          }

          const savedId = await onSaveChat(currentChatId, chatName, settings.mode, settings.provider, messages);
          if (!currentChatId) {
              setCurrentChatId(savedId);
          }
      }
  };

  const handleLoadChat = async (chat: ChatHistory) => {
      // Save current chat before switching
      if (messages.length > 0 && currentChatId !== chat.id) {
          await handleSaveCurrentChat();
      }

      // Load the selected chat messages
      const loadedMessages = await onLoadChatMessages(chat.id);
      setMessages(loadedMessages);
      setCurrentChatId(chat.id);
      setCurrentChatName(chat.name);
      titleGeneratedRef.current = true; // Assume loaded chats already have titles or don't need regeneration immediately
      setShowChatList(false);

      // Switch mode to match the chat's original mode
      if (settings.mode !== chat.mode) {
          onUpdateSettings({ ...settings, mode: chat.mode });
      }

      // Rebuild history for API
      historyRef.current = loadedMessages.map(msg => ({
          role: msg.role,
          parts: [{ text: msg.text }]
      }));
  };

  const handleNewChat = async () => {
      // Save current chat before creating new one
      if (messages.length > 0) {
          await handleSaveCurrentChat();
      }

      clearChat();
      setCurrentChatId(null);
      setCurrentChatName('New Chat');
      setShowChatList(false);
  };

  const handleDeleteChat = (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      
      if (confirmDeleteChatId === id) {
          onDeleteChat(id);
          if (currentChatId === id) {
              handleNewChat();
          }
          setConfirmDeleteChatId(null);
      } else {
          setConfirmDeleteChatId(id);
          // Increased timeout for better UX
          setTimeout(() => setConfirmDeleteChatId(null), 4000);
      }
  };

  const handleRenameChat = (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      const chat = chatHistories.find(h => h.id === id);
      if (chat) {
          setEditingChatId(id);
          setEditingChatName(chat.name);
      }
  };

  const handleSaveRename = (id: string) => {
      if (editingChatName.trim()) {
          onRenameChat(id, editingChatName.trim());
          if (currentChatId === id) {
              setCurrentChatName(editingChatName.trim());
          }
      }
      setEditingChatId(null);
      setEditingChatName('');
  };

  // Auto-save when messages change
  useEffect(() => {
      if (messages.length > 0) {
          const timeoutId = setTimeout(() => {
              handleSaveCurrentChat();
          }, 2000); // Save 2 seconds after last message
          return () => clearTimeout(timeoutId);
      }
  }, [messages]);

  const toolExecutors: ToolExecutors = {
    addWidget: async (args) => {
        let parsedHeaders: Record<string, string> | undefined = undefined;
        if (args.headers) {
            try {
                parsedHeaders = JSON.parse(args.headers);
            } catch (e) {
                return "Error: Headers provided were not valid JSON.";
            }
        }

        const newConfig: UniversalWidgetConfig = {
            endpoint: args.endpoint || '',
            jsonPath: args.jsonPath || '',
            label: args.title,
            method: 'GET',
            refreshInterval: args.refreshInterval || 10000,
            unit: args.unit,
            headers: parsedHeaders,
            customCode: args.customCode 
        };
        onAddWidget(WidgetType.UNIVERSAL, newConfig);
        return `Created widget "${args.title}"${args.customCode ? ' with custom code' : ''}`;
    },
    addBookmark: async (args) => {
        onAddBookmark(args.categoryName, args.title, args.url, args.iconUrl, args.categoryIconUrl);
        return `Added bookmark ${args.title} to ${args.categoryName}`;
    },
    addWebApp: async (args) => {
        if (onAddWebApp) {
            onAddWebApp(args);
            return `Added Web App "${args.name}" to category "${args.category}"`;
        }
        return "Error: Web App creation not supported in this context.";
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onloadend = () => {
          if (typeof reader.result === 'string') setPendingImage(reader.result);
      };
      reader.readAsDataURL(file);
      e.target.value = '';
  };

  const handlePaste = (e: React.ClipboardEvent) => {
      const items = e.clipboardData.items;
      for (let i = 0; i < items.length; i++) {
          if (items[i].type.indexOf('image') !== -1) {
              const blob = items[i].getAsFile();
              if (blob) {
                  const reader = new FileReader();
                  reader.onload = (event) => {
                      if (typeof event.target?.result === 'string') setPendingImage(event.target.result);
                  };
                  reader.readAsDataURL(blob);
                  e.preventDefault(); 
              }
          }
      }
  };

  const handleStop = () => {
      if (abortControllerRef.current) {
          abortControllerRef.current.abort();
          abortControllerRef.current = null;
          setIsLoading(false);
      }
  };

  const handleSend = async (retryText?: string, retryImage?: string) => {
    if (isLoading) { handleStop(); return; }

    const textToSend = retryText || input;
    const imageToSend = retryImage || (pendingImage || undefined);

    if (!textToSend.trim() && !imageToSend) return;
    
    if (abortControllerRef.current) abortControllerRef.current.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    if (settings.provider === 'GEMINI' && !settings.geminiKey) {
        setMessages(p => [...p, { role: 'system', text: "Please set your Gemini API Key." }]);
        setShowSettings(true);
        return;
    }

    const userMsg: ChatMessage = { role: 'user', text: textToSend, image: imageToSend };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setPendingImage(null); 
    setIsLoading(true);
    
    // Reset textarea height
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    try {
      let responseText = "";
      const history = historyRef.current.map(h => ({
            role: h.role,
            parts: [{ text: (h.text && h.text.trim() !== "") ? h.text : " " }] 
      }));

      let res;
      const providers = {
          'GEMINI': (h:any, m:string, s:any, t:any, i:any, sig:any) => sendMessageGemini(h, m, s, t, i, sig),
          'OPENROUTER': (h:any, m:string, s:any, t:any, i:any, sig:any) => sendMessageOpenAi(h, m, s, t, true, i, sig),
          'OPENAI': (h:any, m:string, s:any, t:any, i:any, sig:any) => sendMessageOpenAi(h, m, s, t, false, i, sig),
          'OLLAMA': (h:any, m:string, s:any, t:any, i:any, sig:any) => sendMessageOllama(h, m, s, t, i, sig)
      };
      
      const selectedProvider = providers[settings.provider];
      if (selectedProvider) {
          res = await selectedProvider(history, userMsg.text, settings, toolExecutors, imageToSend, controller.signal);
      }
      
      if (res && !controller.signal.aborted) {
        responseText = res.text || " ";
        historyRef.current.push({ role: 'user', text: userMsg.text });
        historyRef.current.push({ role: 'model', text: responseText });
        setMessages(prev => [...prev, { role: 'model', text: responseText }]);
      }
      
    } catch (e: any) {
      if (e.message !== 'Aborted by user' && e.message !== 'Request aborted' && !controller.signal.aborted) {
          console.error(e);
          setMessages(prev => [...prev, { role: 'model', text: `Error: ${e.message}` }]);
      }
    } finally {
      if (abortControllerRef.current === controller) {
          setIsLoading(false);
          abortControllerRef.current = null;
      }
    }
  };

  const handleRetry = (index: number) => {
      const previousUserMsg = messages[index - 1];
      if (previousUserMsg && previousUserMsg.role === 'user') {
          setMessages(prev => prev.slice(0, index - 1)); 
          if (historyRef.current.length >= 2) {
              historyRef.current.pop(); 
              historyRef.current.pop(); 
          }
          handleSend(previousUserMsg.text, previousUserMsg.image);
      }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const getMessageFontSize = () => {
      switch(settings.chatFontSize) {
          case 'small': return 'text-xs';
          case 'large': return 'text-base';
          default: return 'text-sm';
      }
  };

  if (showSettings) {
       return (
          <div className="flex flex-col h-full bg-lrgex-bg p-4 overflow-y-auto custom-scrollbar">
              <div className="flex justify-between items-center mb-4 border-b border-lrgex-border pb-2">
                  <h3 className="font-bold text-lrgex-text flex items-center gap-2"><Settings size={16}/> AI Settings</h3>
                  <button onClick={() => setShowSettings(false)} className="text-lrgex-muted hover:text-lrgex-text">Done</button>
              </div>

              <div className="space-y-4 pb-10">
                  <div>
                      <label className="block text-xs text-lrgex-muted mb-2 flex items-center gap-1"><Type size={12}/> Text Size</label>
                      <div className="flex bg-lrgex-panel border border-lrgex-border rounded overflow-hidden">
                          {['small', 'medium', 'large'].map(size => (
                              <button 
                                key={size}
                                onClick={() => onUpdateSettings({ ...settings, chatFontSize: size as any })}
                                className={`flex-1 py-1 text-xs capitalize transition-colors ${settings.chatFontSize === size ? 'bg-lrgex-orange text-white' : 'text-lrgex-muted hover:bg-lrgex-hover'}`}
                              >
                                {size}
                              </button>
                          ))}
                      </div>
                  </div>

                  <div>
                      <label className="block text-xs text-lrgex-muted mb-2">Provider</label>
                      <div className="grid grid-cols-2 gap-2">
                          {['GEMINI', 'OPENROUTER', 'OPENAI', 'OLLAMA'].map(p => (
                             <button 
                                key={p}
                                onClick={() => onUpdateSettings({ ...settings, provider: p as any })}
                                className={`py-2 rounded text-[10px] font-bold border transition-all ${settings.provider === p ? 'bg-lrgex-orange border-lrgex-orange text-white' : 'bg-lrgex-panel border-lrgex-border text-lrgex-muted hover:border-lrgex-muted'}`}
                             >
                                 {p}
                             </button>
                          ))}
                      </div>
                  </div>

                  {settings.provider === 'GEMINI' && (
                       <div className="space-y-2 animate-in fade-in">
                            <div>
                                <label className="block text-xs text-lrgex-muted mb-1">Gemini API Key</label>
                                <input 
                                    type="password"
                                    className="w-full bg-lrgex-panel border border-lrgex-border rounded px-2 py-1 text-sm text-lrgex-text focus:border-lrgex-orange outline-none"
                                    value={settings.geminiKey}
                                    onChange={e => onUpdateSettings({...settings, geminiKey: e.target.value})}
                                    placeholder="AIzaSy..."
                                />
                            </div>
                       </div>
                  )}
                  {settings.provider === 'OPENROUTER' && (
                       <div className="space-y-2 animate-in fade-in">
                            <div>
                                <label className="block text-xs text-lrgex-muted mb-1">OpenRouter Key</label>
                                <input 
                                    type="password"
                                    className="w-full bg-lrgex-panel border border-lrgex-border rounded px-2 py-1 text-sm text-lrgex-text focus:border-lrgex-orange outline-none"
                                    value={settings.openRouterKey}
                                    onChange={e => onUpdateSettings({...settings, openRouterKey: e.target.value})}
                                    placeholder="sk-or-..."
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-lrgex-muted mb-1">Model ID</label>
                                <input 
                                    className="w-full bg-lrgex-panel border border-lrgex-border rounded px-2 py-1 text-sm text-lrgex-text focus:border-lrgex-orange outline-none"
                                    value={settings.openRouterModel}
                                    onChange={e => onUpdateSettings({...settings, openRouterModel: e.target.value})}
                                    placeholder="x-ai/grok-4.1-fast"
                                />
                            </div>
                       </div>
                  )}
                  {settings.provider === 'OPENAI' && (
                       <div className="space-y-2 animate-in fade-in">
                            <div>
                                <label className="block text-xs text-lrgex-muted mb-1">API Key</label>
                                <input 
                                    type="password"
                                    className="w-full bg-lrgex-panel border border-lrgex-border rounded px-2 py-1 text-sm text-lrgex-text focus:border-lrgex-orange outline-none"
                                    value={settings.openAiKey}
                                    onChange={e => onUpdateSettings({...settings, openAiKey: e.target.value})}
                                    placeholder="sk-..."
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-lrgex-muted mb-1">Model ID</label>
                                <input 
                                    className="w-full bg-lrgex-panel border border-lrgex-border rounded px-2 py-1 text-sm text-lrgex-text focus:border-lrgex-orange outline-none"
                                    value={settings.openAiModel}
                                    onChange={e => onUpdateSettings({...settings, openAiModel: e.target.value})}
                                    placeholder="gpt-4o"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-lrgex-muted mb-1">API Endpoint (Optional)</label>
                                <input 
                                    className="w-full bg-lrgex-panel border border-lrgex-border rounded px-2 py-1 text-sm text-lrgex-text focus:border-lrgex-orange outline-none placeholder:text-lrgex-muted/20"
                                    value={settings.openAiUrl}
                                    onChange={e => onUpdateSettings({...settings, openAiUrl: e.target.value})}
                                    placeholder="https://api.openai.com/v1/chat/completions"
                                />
                            </div>
                       </div>
                  )}
                  {settings.provider === 'OLLAMA' && (
                       <div className="space-y-2 animate-in fade-in">
                            <div className="p-2 bg-blue-500/10 border border-blue-500/20 rounded text-[10px] text-blue-300">
                                Note: Ensure Ollama is running with <code>OLLAMA_ORIGINS="*"</code>.
                            </div>
                            <div>
                                <label className="block text-xs text-lrgex-muted mb-1">Ollama URL</label>
                                <input 
                                    className="w-full bg-lrgex-panel border border-lrgex-border rounded px-2 py-1 text-sm text-lrgex-text focus:border-lrgex-orange outline-none"
                                    value={settings.ollamaUrl}
                                    onChange={e => onUpdateSettings({...settings, ollamaUrl: e.target.value})}
                                    placeholder="http://localhost:11434"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-lrgex-muted mb-1">Model Name</label>
                                <input 
                                    className="w-full bg-lrgex-panel border border-lrgex-border rounded px-2 py-1 text-sm text-lrgex-text focus:border-lrgex-orange outline-none"
                                    value={settings.ollamaModel}
                                    onChange={e => onUpdateSettings({...settings, ollamaModel: e.target.value})}
                                    placeholder="llama3"
                                />
                            </div>
                       </div>
                  )}
              </div>
          </div>
      );
  }

  // Render main chat interface
  return (
    <div className="flex flex-col h-full w-full min-h-0 bg-lrgex-panel/30">
      {/* Header Area */}
      <div className="flex items-center justify-between px-3 py-3 border-b border-lrgex-border shrink-0 bg-lrgex-menu/50">
        <div className="flex items-center gap-2">
            <button
                onClick={() => setShowChatList(!showChatList)}
                className={`text-lrgex-muted hover:text-lrgex-text transition-colors ${showChatList ? 'text-lrgex-orange' : ''}`}
                title="Chat History"
            >
                <MessageSquare size={14} />
            </button>
            {settings.mode === 'COMMANDER' ? (
                 <ShieldAlert size={14} className="text-lrgex-orange" />
            ) : (
                 <Bot size={14} className="text-emerald-400" />
            )}
            <span className="text-xs font-medium text-lrgex-text truncate max-w-[150px]">
                {currentChatName}
            </span>
        </div>
        <div className="flex gap-2">
             <button onClick={handleNewChat} className="text-lrgex-muted hover:text-emerald-400 p-0.5" title="New Chat">
                <Plus size={14} />
            </button>
             <button onClick={clearChat} className="text-lrgex-muted hover:text-red-400 p-0.5" title="Clear Chat History">
                <Trash2 size={14} />
            </button>
            <button 
                onClick={() => {
                    onUpdateSettings({...settings, mode: settings.mode === 'COMMANDER' ? 'ASSISTANT' : 'COMMANDER'});
                    clearChat();
                }}
                className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${settings.mode === 'COMMANDER' ? 'bg-lrgex-orange/20 border-lrgex-orange text-lrgex-orange' : 'bg-emerald-500/20 border-emerald-500 text-emerald-300'}`}
                title={settings.mode === 'COMMANDER' ? "Switch to Safe Mode" : "Switch to Admin Mode"}
            >
                {settings.mode}
            </button>
            <button onClick={() => setShowSettings(true)} className="text-lrgex-muted hover:text-lrgex-text">
                <Settings size={14} />
            </button>
        </div>
      </div>

      {/* Chat History Sidebar */}
      {showChatList && (
        <div className="absolute top-[52px] left-0 right-0 bottom-0 bg-lrgex-bg/95 backdrop-blur-sm z-10 flex flex-col">
          <div className="flex items-center justify-between px-3 py-2 border-b border-lrgex-border">
            <h3 className="text-xs font-bold text-lrgex-text">Chat History</h3>
            <button onClick={() => setShowChatList(false)} className="text-lrgex-muted hover:text-lrgex-text">
              <X size={14} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {chatHistories.length === 0 ? (
              <div className="text-center text-lrgex-muted text-xs p-4">
                No saved chats yet
              </div>
            ) : (
              <div className="space-y-1 p-2">
                {chatHistories
                  .sort((a, b) => b.updatedAt - a.updatedAt)
                  .map(chat => (
                    <div
                      key={chat.id}
                      onClick={() => handleLoadChat(chat)}
                      className={`p-2 rounded-lg cursor-pointer transition-all group hover:bg-lrgex-hover ${
                        currentChatId === chat.id ? 'bg-lrgex-orange/20 border border-lrgex-orange/30' : 'border border-transparent'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          {editingChatId === chat.id ? (
                            <input
                              autoFocus
                              type="text"
                              value={editingChatName}
                              onChange={(e) => setEditingChatName(e.target.value)}
                              onBlur={() => handleSaveRename(chat.id)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveRename(chat.id);
                                if (e.key === 'Escape') setEditingChatId(null);
                              }}
                              onClick={(e) => e.stopPropagation()}
                              className="w-full bg-lrgex-bg border border-lrgex-orange rounded px-1 py-0.5 text-xs text-lrgex-text outline-none"
                            />
                          ) : (
                            <div className="text-xs font-medium text-lrgex-text truncate">
                              {chat.name}
                            </div>
                          )}

                          <div className="flex items-center gap-2 mt-1">
                            <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                              chat.mode === 'COMMANDER'
                                ? 'bg-lrgex-orange/20 text-lrgex-orange border border-lrgex-orange/30'
                                : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            }`}>
                              {chat.mode}
                            </span>
                            <span className="text-[9px] text-lrgex-muted">
                              {chat.messageCount} msg{chat.messageCount !== 1 ? 's' : ''}
                            </span>
                            <span className="text-[9px] text-lrgex-muted">
                              {new Date(chat.updatedAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>

                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => handleRenameChat(chat.id, e)}
                            className="p-1.5 hover:bg-lrgex-panel rounded text-lrgex-muted hover:text-blue-400 w-6 h-6 flex items-center justify-center"
                            title="Rename"
                          >
                            <Edit2 size={10} />
                          </button>
                          <button
                            onClick={(e) => handleDeleteChat(chat.id, e)}
                            className={`p-1.5 rounded transition-all duration-200 flex items-center justify-center ${
                              confirmDeleteChatId === chat.id
                                ? 'bg-red-500 text-white w-16'
                                : 'hover:bg-lrgex-panel text-lrgex-muted hover:text-red-400 w-6'
                            }`}
                            title={confirmDeleteChatId === chat.id ? 'Click to Confirm' : 'Delete'}
                          >
                            {confirmDeleteChatId === chat.id ? (
                                <span className="text-[10px] font-bold">Delete</span>
                            ) : (
                                <Trash2 size={10} />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto space-y-4 p-3 custom-scrollbar min-h-0 pb-2">
        {messages.length === 0 && (
            <div className="text-center text-lrgex-muted text-sm mt-8 px-4">
                <Cpu className="mx-auto mb-3 opacity-50 text-lrgex-orange" size={32} />
                <p className="mb-2">
                    Running on <span className="font-semibold text-lrgex-text">{settings.provider}</span>
                </p>
                {settings.mode === 'COMMANDER' ? (
                    <div className="p-2 bg-lrgex-orange/10 border border-lrgex-orange/30 rounded text-xs text-lrgex-orange">
                        Warning: Commander mode is active.
                    </div>
                ) : (
                    <p className="text-xs opacity-70">I can help with coding and questions.</p>
                )}
            </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : ''} group`}>
             {msg.role !== 'system' && (
                <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${msg.role === 'user' ? 'bg-lrgex-orange' : 'bg-lrgex-hover border border-lrgex-border'}`}>
                    {msg.role === 'user' ? <User size={12} className="text-white"/> : <Bot size={12} className="text-lrgex-text"/>}
                </div>
             )}
            <div className={`rounded-lg p-2 ${getMessageFontSize()} max-w-[85%] flex flex-col gap-2 ${
                msg.role === 'user' ? 'bg-lrgex-orange text-white' : 
                msg.role === 'system' ? 'bg-red-500/10 text-red-200 w-full text-center italic border border-red-500/20' :
                'bg-lrgex-menu text-lrgex-text border border-lrgex-border relative'}`}>
              
              {msg.image && (
                  <img src={msg.image} alt="Attachment" className="rounded-md max-h-40 object-contain bg-black/20" />
              )}
              
              {msg.role === 'model' ? (
                  <MarkdownRenderer content={msg.text} />
              ) : (
                  <div className="whitespace-pre-wrap">{msg.text}</div>
              )}

              {/* Action Buttons */}
              <div className={`flex gap-2 pt-1 mt-1 border-t border-lrgex-border/30 opacity-0 group-hover:opacity-100 transition-opacity ${msg.role === 'user' ? 'justify-start border-white/20' : 'justify-end'}`}>
                  <CopyButton 
                    text={msg.text} 
                    size={10}
                    className={`p-1 rounded transition-colors ${msg.role === 'user' ? 'hover:bg-white/20 text-white/70 hover:text-white' : 'hover:bg-lrgex-hover text-lrgex-muted hover:text-white'}`}
                  />
                  
                  {msg.role === 'model' && (
                      <button onClick={() => handleRetry(i)} className="p-1 hover:bg-lrgex-hover rounded text-lrgex-muted hover:text-white transition-colors" title="Retry">
                          <RotateCcw size={10} />
                      </button>
                  )}
              </div>
            </div>
          </div>
        ))}
        {isLoading && (
           <div className="flex gap-2">
              <div className="w-6 h-6 rounded-full bg-lrgex-hover border border-lrgex-border flex items-center justify-center shrink-0">
                <Loader2 size={12} className="animate-spin text-lrgex-muted" />
              </div>
              <div className="bg-lrgex-menu border border-lrgex-border rounded-lg p-2 flex items-center">
                <span className="text-xs text-lrgex-muted">Processing...</span>
              </div>
           </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Floating Input Area */}
      <div className="p-4 pt-0 shrink-0">
        <div className="bg-lrgex-menu rounded-xl border border-lrgex-border shadow-2xl flex flex-col gap-2 p-2">
            {pendingImage && (
                <div className="flex items-center gap-2 p-2 bg-lrgex-panel border border-lrgex-border rounded-lg w-fit">
                    <img src={pendingImage} alt="Preview" className="w-8 h-8 object-cover rounded" />
                    <span className="text-[10px] text-lrgex-muted">Image attached</span>
                    <button onClick={() => setPendingImage(null)} className="ml-2 text-lrgex-muted hover:text-red-400"><X size={12} /></button>
                </div>
            )}

            <div className="flex items-end gap-2">
                <label className="cursor-pointer p-2 hover:bg-lrgex-hover rounded-lg text-lrgex-muted hover:text-lrgex-orange transition-colors shrink-0 mb-0.5">
                    <Paperclip size={18} />
                    <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleImageUpload} />
                </label>

                <textarea
                    ref={textareaRef}
                    className="flex-1 bg-transparent border-none focus:ring-0 text-sm px-2 py-2 text-lrgex-text placeholder-lrgex-muted outline-none resize-none max-h-48 custom-scrollbar"
                    placeholder={settings.mode === 'COMMANDER' ? "Ask AI Commander..." : "Ask AI Assistant..."}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onPaste={handlePaste}
                    rows={1}
                    style={{ minHeight: '44px' }}
                />
                <button 
                    onClick={() => handleSend()} 
                    disabled={(!input.trim() && !pendingImage && !isLoading)}
                    className={`p-2 rounded-lg text-white transition-all shrink-0 mb-0.5 shadow-sm ${isLoading ? 'bg-red-500 hover:bg-red-600' : 'bg-lrgex-orange hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed'}`}
                    title={isLoading ? "Stop" : "Send"}
                >
                {isLoading ? <Square size={18} fill="currentColor" /> : <Send size={18} />}
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};
