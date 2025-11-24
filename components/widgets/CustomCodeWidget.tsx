
import React, { Component, useEffect, useState, useRef, useMemo, ReactNode } from 'react';
import * as LucideIcons from 'lucide-react';
import { AlertTriangle, Bot, Ban } from 'lucide-react';

interface CustomCodeWidgetProps {
    code: string;
    customData: Record<string, any>;
    onSetCustomData: (data: Record<string, any>) => void;
    onReportError?: (error: string) => void;
    width?: number;
    height?: number;
}

interface ErrorBoundaryProps {
    onReportError?: (error: string) => void;
    children?: ReactNode;
    codeHash: string; // Used to reset error state when code changes
}

interface ErrorBoundaryState {
    hasError: boolean;
    errorMsg: string;
}

// Error Boundary Component to prevent whole app crashes
class WidgetErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = {
            hasError: false,
            errorMsg: ''
        };
    }

    static getDerivedStateFromError(error: any): ErrorBoundaryState {
        return { hasError: true, errorMsg: error.toString() };
    }

    componentDidCatch(error: any, errorInfo: any) {
        console.error("WidgetErrorBoundary caught an error", error, errorInfo);
    }

    // Reset error state if the code (codeHash) changes
    componentDidUpdate(prevProps: ErrorBoundaryProps) {
        if (prevProps.codeHash !== this.props.codeHash) {
            this.setState({ hasError: false, errorMsg: '' });
        }
    }

    render() {
        if (this.state.hasError) {
            const { onReportError } = this.props;
            return (
                <div className="absolute inset-0 p-2 text-red-400 text-xs border border-red-500/20 bg-slate-950/90 rounded flex flex-col gap-2 overflow-hidden z-50">
                    <div className="flex items-center gap-2 text-red-500 font-bold border-b border-red-500/20 pb-1 shrink-0">
                        <Ban size={14} />
                        <span>Widget Crashed</span>
                    </div>
                    <div className="font-mono text-[10px] opacity-80 whitespace-pre-wrap break-words flex-1 overflow-y-auto custom-scrollbar">
                        {this.state.errorMsg}
                    </div>
                    {onReportError && (
                        <button 
                            onClick={() => onReportError(this.state.errorMsg)}
                            className="flex items-center justify-center gap-1 bg-lrgex-orange text-white px-2 py-1.5 rounded text-[10px] w-full hover:bg-orange-600 transition-colors shrink-0 font-bold"
                        >
                            <Bot size={12} /> Fix with AI
                        </button>
                    )}
                </div>
            );
        }
        return this.props.children;
    }
}

// Helper function for Proxy Fetching
const proxyFetch = async (url: string, options: RequestInit = {}) => {
    const response = await fetch('/api/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            url,
            method: options.method || 'GET',
            headers: options.headers || {},
            body: options.body // Pass as is, don't double stringify.
        })
    });
    
    if (!response.ok) {
        try {
            const text = await response.text();
            try {
                const errorJson = JSON.parse(text);
                throw new Error(errorJson.details || errorJson.error || `Proxy Error (${response.status})`);
            } catch (e: any) {
                if (e.message && e.message.includes('Proxy Error')) throw e;
                throw new Error(`Proxy Error (${response.status}): ${text}`);
            }
        } catch (readErr: any) {
             throw new Error(`Proxy Error (${response.status}) - Could not read details`);
        }
    }

    const xSetCookie = response.headers.get('X-Set-Cookie');
    if (xSetCookie) {
        const originalHeaders = response.headers;
        Object.defineProperty(response, 'headers', {
            value: {
                get: (name: string) => {
                    if (name.toLowerCase() === 'set-cookie') return xSetCookie;
                    return originalHeaders.get(name);
                },
                forEach: (callback: any, thisArg: any) => originalHeaders.forEach(callback, thisArg),
            }
        });
    }

    return response;
};

// Component to guard against infinite render loops
const RenderGuard: React.FC<{ children: ReactNode }> = ({ children }) => {
    const renderCount = useRef(0);
    const lastRenderTime = useRef(Date.now());

    // Logic: If we render more than 25 times in 1 second (humanly impossible for valid UI updates), kill it.
    // Lowered from 50 to catch loops faster.
    renderCount.current++;
    const now = Date.now();
    
    if (now - lastRenderTime.current > 1000) {
        renderCount.current = 1;
        lastRenderTime.current = now;
    } else {
        if (renderCount.current > 25) {
            throw new Error("Infinite Render Loop Detected. Widget stopped for safety.");
        }
    }

    return <>{children}</>;
};

export const CustomCodeWidget: React.FC<CustomCodeWidgetProps> = ({ code, customData, onSetCustomData, onReportError }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

    useEffect(() => {
        if (!containerRef.current) return;
        const observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
                setDimensions({
                    width: entry.contentRect.width,
                    height: entry.contentRect.height
                });
            }
        });
        observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, []);

    const GeneratedComponent = useMemo(() => {
        try {
            if (!code || !code.trim()) return null;

            const func = new Function(
                'React', 
                'useState', 
                'useEffect', 
                'useRef', 
                'Lucide', 
                'props',
                'proxyFetch',
                code
            );

            return (componentProps: any) => {
                try {
                    // We execute the user's code here.
                    // If the body throws (syntax error, logic error), catch it immediately
                    // so the ErrorBoundary above handles it.
                    return func(React, useState, useEffect, useRef, LucideIcons, componentProps, proxyFetch);
                } catch (err: any) {
                    throw err; // Propagate to ErrorBoundary
                }
            };
        } catch (err: any) {
            // Compilation error (SyntaxError in code string)
            return () => (
                <div className="p-2 text-red-400 text-xs border border-red-500/20 bg-red-500/10 rounded h-full overflow-auto flex flex-col gap-2">
                    <div>
                        <strong>Compilation Error:</strong>
                        <pre className="mt-1 whitespace-pre-wrap font-mono">{err.message}</pre>
                    </div>
                    {onReportError && (
                        <button 
                            onClick={() => onReportError(err.message)}
                            className="flex items-center gap-1 bg-lrgex-orange text-white px-2 py-1 rounded text-[10px] w-fit hover:bg-orange-600 transition-colors"
                        >
                            <Bot size={12} /> Fix with AI
                        </button>
                    )}
                </div>
            );
        }
    }, [code, onReportError]);

    if (!GeneratedComponent) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-lrgex-muted p-4 text-center opacity-50">
                <AlertTriangle size={24} className="mb-2" />
                <p className="text-xs">No valid code provided.</p>
            </div>
        );
    }

    return (
        <div ref={containerRef} className="w-full h-full custom-code-container relative overflow-hidden">
             {dimensions.width > 0 && (
                <WidgetErrorBoundary onReportError={onReportError} codeHash={code.length + code.substring(0, 20)}>
                    <RenderGuard>
                        <GeneratedComponent 
                            width={dimensions.width} 
                            height={dimensions.height} 
                            customData={customData || {}}
                            setCustomData={onSetCustomData}
                        />
                    </RenderGuard>
                </WidgetErrorBoundary>
             )}
        </div>
    );
};
