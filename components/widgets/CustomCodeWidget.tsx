import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { AlertTriangle, Bot, Loader2 } from 'lucide-react';

interface CustomCodeWidgetProps {
    code: string;
    customData: Record<string, any>;
    onSetCustomData: (data: Record<string, any>) => void;
    onReportError?: (error: string, code?: string) => void;
    width?: number;
    height?: number;
    title?: string;
}

// Helper: Proxy Fetch (Executed in Parent)
const performProxyFetch = async (url: string, options: any = {}) => {
    const response = await fetch('/api/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            url,
            method: options.method || 'GET',
            headers: options.headers || {},
            body: options.body
        })
    });
    
    // Cookie handling (X-Set-Cookie -> Set-Cookie emulation if needed)
    const xSetCookie = response.headers.get('X-Set-Cookie');
    const text = await response.text();
    const headers: [string, string][] = [];
    response.headers.forEach((v, k) => headers.push([k, v]));

    return {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
        headers,
        body: text,
        xSetCookie
    };
};

// Iframe HTML Content
// Uses esm.sh for React 19 and Lucide to ensure compatibility inside the sandboxed environment
const IFRAME_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="color-scheme" content="dark">
    <script src="https://cdn.tailwindcss.com"></script>
    <script>
      tailwind.config = {
        theme: {
          extend: {
            colors: {
              lrgex: {
                bg: '#121212',
                panel: '#1e1e1e',
                menu: '#191919',
                hover: '#282828',
                text: '#f0f0f0',
                muted: '#aaaaaa',
                orange: '#cd7f32',
                border: '#333333',
              }
            }
          }
        }
      }
    </script>
    <script type="importmap">
    {
      "imports": {
        "react": "https://esm.sh/react@19.0.0",
        "react-dom/client": "https://esm.sh/react-dom@19.0.0/client",
        "lucide-react": "https://esm.sh/lucide-react@0.475.0"
      }
    }
    </script>
    <script>
        // Console Proxy: Forwards console logs from iframe to parent window for debugging
        ['log', 'warn', 'error', 'info', 'debug'].forEach(method => {
            const original = console[method];
            console[method] = (...args) => {
                original.apply(console, args); 
                try {
                    const serialized = args.map(arg => {
                        if (arg instanceof Error) return arg.message;
                        if (typeof arg === 'object') {
                            try { return JSON.stringify(arg); } catch(e) { return '[Circular/Unserializable]'; }
                        }
                        return String(arg);
                    });
                    window.parent.postMessage({
                        type: 'CONSOLE',
                        method,
                        args: serialized
                    }, '*');
                } catch (e) {
                    // Ignore messaging errors
                }
            };
        });
    </script>
    <style>
        body, html { 
            margin: 0; 
            padding: 0; 
            width: 100%; 
            height: 100%; 
            overflow: hidden; 
            background-color: transparent !important;
            color: #f0f0f0; 
            /* Fix for canvas artifacts in some games */
            image-rendering: pixelated;
        }
        #root { 
            width: 100%; 
            height: 100%; 
            display: flex; 
            flex-direction: column; 
        }
        /* Custom scrollbars to match app */
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #333; border-radius: 2px; }
        ::-webkit-scrollbar-thumb:hover { background: #cd7f32; }
    </style>
</head>
<body>
    <div id="root"></div>
    <script type="module">
        import React, { useState, useEffect, useRef, useMemo } from 'react';
        import { createRoot } from 'react-dom/client';
        import * as Lucide from 'lucide-react';

        // Internal Error Boundary to catch render crashes inside the iframe
        class ErrorBoundary extends React.Component {
            constructor(props) {
                super(props);
                this.state = { hasError: false, error: null };
            }
            static getDerivedStateFromError(error) {
                return { hasError: true, error };
            }
            componentDidCatch(error, errorInfo) {
                console.error("Widget Crash:", error);
                window.parent.postMessage({ type: 'REPORT_ERROR', error: error.message }, '*');
            }
            render() {
                if (this.state.hasError) {
                    return React.createElement('div', { className: 'flex flex-col items-center justify-center h-full p-4 text-center' },
                        React.createElement('div', { className: 'text-red-500 font-bold mb-2 flex items-center gap-2' },
                            React.createElement(Lucide.AlertTriangle, { size: 20 }),
                            'Widget Crashed'
                        ),
                        React.createElement('pre', { className: 'text-[10px] text-red-400/80 font-mono whitespace-pre-wrap bg-black/20 p-2 rounded max-w-full overflow-hidden' }, 
                            this.state.error.message
                        )
                    );
                }
                return this.props.children;
            }
        }

        const WidgetRunner = () => {
            const [props, setProps] = useState({ width: 0, height: 0, customData: {} });
            const [code, setCode] = useState('');
            const [compileError, setCompileError] = useState(null);

            useEffect(() => {
                const handler = (event) => {
                    const data = event.data;
                    if (!data) return;

                    if (data.type === 'INIT' || data.type === 'UPDATE_CODE') {
                        setCode(data.code);
                        setProps(prev => ({ ...prev, ...data.props }));
                        setCompileError(null);
                    }
                    if (data.type === 'UPDATE_PROPS') {
                        setProps(prev => ({ ...prev, ...data.props }));
                    }
                    if (data.type === 'FETCH_RESULT') {
                        if (window.pendingFetches && window.pendingFetches[data.id]) {
                            if (data.error) {
                                window.pendingFetches[data.id].reject(new Error(data.error));
                            } else {
                                const init = {
                                    status: data.response.status,
                                    statusText: data.response.statusText,
                                    headers: new Headers(data.response.headers)
                                };
                                const res = new Response(data.response.body, init);
                                
                                // Restore X-Set-Cookie behavior for emulation
                                if (data.response.xSetCookie) {
                                    Object.defineProperty(res, 'headers', {
                                        value: {
                                            get: (name) => {
                                                if (name.toLowerCase() === 'set-cookie') return data.response.xSetCookie;
                                                return init.headers.get(name);
                                            },
                                            forEach: (cb) => init.headers.forEach(cb)
                                        }
                                    });
                                }
                                
                                window.pendingFetches[data.id].resolve(res);
                            }
                            delete window.pendingFetches[data.id];
                        }
                    }
                };
                window.addEventListener('message', handler);
                window.parent.postMessage({ type: 'READY' }, '*');
                return () => window.removeEventListener('message', handler);
            }, []);

            // Bridge functions exposed to User Code
            const proxyFetch = useMemo(() => (url, options = {}) => {
                return new Promise((resolve, reject) => {
                    const id = Math.random().toString(36).substr(2, 9);
                    
                    // Handle AbortSignal locally inside iframe because it's not cloneable via postMessage
                    if (options.signal) {
                        if (options.signal.aborted) {
                            return reject(new DOMException('Aborted', 'AbortError'));
                        }
                        options.signal.addEventListener('abort', () => {
                            if (window.pendingFetches && window.pendingFetches[id]) {
                                delete window.pendingFetches[id];
                                reject(new DOMException('Aborted', 'AbortError'));
                            }
                        });
                    }

                    if (!window.pendingFetches) window.pendingFetches = {};
                    window.pendingFetches[id] = { resolve, reject };
                    
                    // Sanitize options to prevent DataCloneError
                    const safeOptions = { ...options };
                    delete safeOptions.signal;
                    
                    // Normalize headers to plain object if needed
                    if (safeOptions.headers && safeOptions.headers instanceof Headers) {
                        safeOptions.headers = Object.fromEntries(safeOptions.headers.entries());
                    }

                    window.parent.postMessage({ type: 'PROXY_FETCH', id, url, options: safeOptions }, '*');
                });
            }, []);

            const setCustomData = useMemo(() => (newData) => {
                window.parent.postMessage({ type: 'SET_CUSTOM_DATA', data: newData }, '*');
            }, []);

            // Code Compilation
            const GeneratedComponent = useMemo(() => {
                if (!code) return null;
                try {
                    // Safe evaluation inside module scope using Function constructor
                    const func = new Function('React', 'useState', 'useEffect', 'useRef', 'Lucide', 'props', 'proxyFetch', code);
                    return (componentProps) => func(React, useState, useEffect, useRef, Lucide, componentProps, proxyFetch);
                } catch (e) {
                    setCompileError(e.message);
                    window.parent.postMessage({ type: 'REPORT_ERROR', error: e.message }, '*');
                    return null;
                }
            }, [code]);

            if (compileError) {
                return React.createElement('div', { className: 'h-full flex flex-col items-center justify-center text-center p-4' },
                    React.createElement('div', { className: 'text-lrgex-orange font-bold text-xs mb-2' }, 'Compilation Error'),
                    React.createElement('pre', { className: 'text-[10px] text-red-400 bg-red-900/10 border border-red-500/20 p-2 rounded whitespace-pre-wrap' }, compileError)
                );
            }

            if (!GeneratedComponent) return React.createElement('div', { className: 'h-full flex items-center justify-center text-lrgex-muted text-xs' }, 'Initializing...');

            // Pass real-time dimensions to widget
            return React.createElement(GeneratedComponent, {
                width: props.width,
                height: props.height,
                customData: props.customData,
                setCustomData: setCustomData
            });
        };

        const root = createRoot(document.getElementById('root'));
        root.render(React.createElement(ErrorBoundary, null, React.createElement(WidgetRunner)));
    </script>
</body>
</html>`;

export const CustomCodeWidget: React.FC<CustomCodeWidgetProps> = ({ 
    code, 
    customData, 
    onSetCustomData, 
    onReportError, 
    title 
}) => {
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const [isReady, setIsReady] = useState(false);
    const [crashError, setCrashError] = useState<string | null>(null);
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

    // Track dimensions for reactivity with throttling
    useEffect(() => {
        if (!iframeRef.current) return;
        
        let rafId: number;
        const observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
                // Use Math.floor to ensure integer dimensions, preventing canvas sub-pixel artifacts
                const width = Math.floor(entry.contentRect.width);
                const height = Math.floor(entry.contentRect.height);

                // Debounce/Throttle via RAF
                cancelAnimationFrame(rafId);
                rafId = requestAnimationFrame(() => {
                    setDimensions({ width, height });
                });
            }
        });
        
        observer.observe(iframeRef.current);
        return () => {
            observer.disconnect();
            cancelAnimationFrame(rafId);
        };
    }, []);

    // Message Handler
    const handleMessage = useCallback(async (event: MessageEvent) => {
        // SECURITY CRITICAL: Only accept messages from our own iframe
        // This prevents cross-widget data corruption
        if (event.source !== iframeRef.current?.contentWindow) {
            return;
        }

        const data = event.data;
        if (!data) return;

        switch (data.type) {
            case 'READY':
                setIsReady(true);
                // Send initial data
                iframeRef.current?.contentWindow?.postMessage({
                    type: 'INIT',
                    code,
                    props: { 
                        width: iframeRef.current?.offsetWidth || 0, 
                        height: iframeRef.current?.offsetHeight || 0, 
                        customData 
                    }
                }, '*');
                break;
            
            case 'SET_CUSTOM_DATA':
                onSetCustomData(data.data);
                break;

            case 'REPORT_ERROR':
                setCrashError(data.error);
                break;

            case 'CONSOLE':
                console.log(`%c[Widget] ${data.method.toUpperCase()}:`, 'color: #cd7f32; font-weight: bold;', ...(data.args || []));
                break;

            case 'PROXY_FETCH':
                try {
                    const result = await performProxyFetch(data.url, data.options);
                    iframeRef.current?.contentWindow?.postMessage({
                        type: 'FETCH_RESULT',
                        id: data.id,
                        response: result
                    }, '*');
                } catch (e: any) {
                    iframeRef.current?.contentWindow?.postMessage({
                        type: 'FETCH_RESULT',
                        id: data.id,
                        error: e.message || 'Fetch Failed'
                    }, '*');
                }
                break;
        }
    }, [code, customData, onSetCustomData]);

    useEffect(() => {
        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, [handleMessage]);

    // Update props when dimensions or data change
    useEffect(() => {
        if (isReady && iframeRef.current) {
            iframeRef.current.contentWindow?.postMessage({
                type: 'UPDATE_PROPS',
                props: { width: dimensions.width, height: dimensions.height, customData }
            }, '*');
        }
    }, [dimensions, customData, isReady]);

    // Update code when it changes
    useEffect(() => {
        if (isReady && iframeRef.current) {
            setCrashError(null);
            iframeRef.current.contentWindow?.postMessage({
                type: 'UPDATE_CODE',
                code,
                props: { width: dimensions.width, height: dimensions.height, customData }
            }, '*');
        }
    }, [code, isReady]);

    return (
        <div className="w-full h-full relative group">
            <iframe
                ref={iframeRef}
                srcDoc={IFRAME_HTML}
                className="w-full h-full border-none bg-transparent block"
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                title={title || "Custom Widget"}
                allowTransparency
            />
            
            {!isReady && (
                <div className="absolute inset-0 flex items-center justify-center bg-lrgex-panel/50 backdrop-blur-sm z-10 pointer-events-none">
                    <Loader2 className="animate-spin text-lrgex-orange" size={20} />
                </div>
            )}

            {crashError && onReportError && (
                <div className="absolute bottom-2 right-2 z-20 flex gap-2 animate-in fade-in slide-in-from-bottom-2">
                    <button 
                        onClick={() => onReportError(crashError)}
                        className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 px-2 py-1 rounded text-[10px] font-bold flex items-center gap-1 shadow-lg backdrop-blur-md transition-colors"
                        title="Report error to AI"
                    >
                        <AlertTriangle size={12} /> Error
                    </button>
                    <button 
                        onClick={() => onReportError(crashError, code)}
                        className="bg-lrgex-orange text-white px-2 py-1 rounded text-[10px] font-bold flex items-center gap-1 shadow-lg shadow-orange-900/20 hover:bg-orange-600 transition-colors"
                        title="Fix code with AI"
                    >
                        <Bot size={12} /> Fix
                    </button>
                </div>
            )}
        </div>
    );
};