
import React, { useEffect, useState, useRef, useMemo, ReactNode } from 'react';
import * as LucideIcons from 'lucide-react';
import { AlertTriangle, Bot, Ban } from 'lucide-react';

interface CustomCodeWidgetProps {
    code: string;
    customData: Record<string, any>;
    onSetCustomData: (data: Record<string, any>) => void;
    onReportError?: (error: string, code?: string) => void;
    width?: number;
    height?: number;
    title?: string;
}

interface ErrorBoundaryProps {
    onReportError?: (error: string, code?: string) => void;
    children?: ReactNode;
    codeHash: string;
    code: string;
    title?: string;
}

interface ErrorBoundaryState {
    hasError: boolean;
    errorMsg: string;
}

// 1. Robust Error Boundary
class WidgetErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
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
        console.error("WidgetErrorBoundary caught an error:", error, errorInfo);
    }

    componentDidUpdate(prevProps: ErrorBoundaryProps) {
        // Reset error if the code changes (user asks AI to fix it)
        if (prevProps.codeHash !== this.props.codeHash) {
            this.setState({ hasError: false, errorMsg: '' });
        }
    }

    render() {
        if (this.state.hasError) {
            const { onReportError, code, title } = this.props;
            return (
                <div className="absolute inset-0 p-3 text-red-400 text-xs border border-red-500/30 bg-slate-950 rounded flex flex-col gap-2 overflow-hidden z-50 shadow-2xl">
                    <div className="flex items-center gap-2 text-red-500 font-bold border-b border-red-500/20 pb-2 shrink-0">
                        <Ban size={16} />
                        <span>{title || 'Widget'} Crashed</span>
                    </div>
                    <div className="font-mono text-[10px] opacity-90 whitespace-pre-wrap break-words flex-1 overflow-y-auto custom-scrollbar bg-black/20 p-2 rounded border border-white/5">
                        {this.state.errorMsg}
                    </div>
                    {onReportError && (
                        <div className="flex gap-2 shrink-0">
                            <button 
                                onClick={() => onReportError(this.state.errorMsg)}
                                className="flex-1 flex items-center justify-center gap-1 bg-red-500/10 text-red-300 border border-red-500/30 px-2 py-2 rounded text-[10px] hover:bg-red-500/20 transition-colors font-bold"
                                title="Send only the error message to AI"
                            >
                                <AlertTriangle size={12} /> Error Only
                            </button>
                            <button 
                                onClick={() => onReportError(this.state.errorMsg, code)}
                                className="flex-1 flex items-center justify-center gap-1 bg-lrgex-orange text-white px-2 py-2 rounded text-[10px] hover:bg-orange-600 transition-colors font-bold shadow-lg shadow-orange-900/20"
                                title="Send code and error to AI for fixing"
                            >
                                <Bot size={12} /> Fix Code
                            </button>
                        </div>
                    )}
                </div>
            );
        }
        return this.props.children;
    }
}

// 2. Proxy Fetch Helper
const proxyFetch = async (url: string, options: RequestInit = {}) => {
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
    
    if (!response.ok) {
        let errorDetails = `Proxy Error (${response.status})`;
        try {
            const text = await response.text();
            try {
                const errorJson = JSON.parse(text);
                errorDetails = errorJson.details || errorJson.error || errorDetails;
            } catch {
                if (text) errorDetails += `: ${text.substring(0, 100)}`;
            }
        } catch {}
        throw new Error(errorDetails);
    }

    // Cookie handling
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

// 3. Inner Component (The Dangerous Part)
const InnerCustomCodeWidget: React.FC<CustomCodeWidgetProps> = ({ code, customData, onSetCustomData, width, height, onReportError, title }) => {
    
    const GeneratedComponent = useMemo(() => {
        try {
            if (!code || !code.trim()) return null;

            // Create the function from string
            const func = new Function(
                'React', 'useState', 'useEffect', 'useRef', 'Lucide', 'props', 'proxyFetch',
                code
            );

            // Return a wrapped component that injects safety hooks
            return (componentProps: any) => {
                // INTERNAL RENDER GUARD
                // This runs every time the *generated* component renders, catching internal state loops.
                const renderCount = useRef(0);
                const lastRenderTime = useRef(Date.now());
                
                renderCount.current++;
                const now = Date.now();
                
                if (now - lastRenderTime.current > 1000) {
                    renderCount.current = 1;
                    lastRenderTime.current = now;
                } else {
                    // Relaxed settings requested by user (5000 renders/sec).
                    // This practically disables the check for animations but still catches massive infinite loops.
                    if (renderCount.current > 5000) {
                        throw new Error("Infinite Render Loop Detected: The widget is updating its state too frequently.");
                    }
                }

                try {
                    // Execute user code
                    return func(React, useState, useEffect, useRef, LucideIcons, componentProps, proxyFetch);
                } catch (err: any) {
                    throw err; // Throw to ErrorBoundary
                }
            };
        } catch (err: any) {
            // Compilation Error (Syntax)
            return () => (
                <div className="p-4 text-red-400 text-xs border border-red-500/20 bg-red-500/10 rounded h-full overflow-auto flex flex-col gap-2">
                    <div>
                        <strong className="block mb-1">Code Compilation Error:</strong>
                        <pre className="whitespace-pre-wrap font-mono bg-black/30 p-2 rounded border border-white/10">{err.message}</pre>
                    </div>
                    {onReportError && (
                        <div className="flex gap-2 mt-2">
                             <button 
                                onClick={() => onReportError(err.message)}
                                className="flex items-center gap-1 bg-red-500/20 text-red-300 border border-red-500/50 px-2 py-1.5 rounded text-[10px] hover:bg-red-500/30 transition-colors font-bold"
                            >
                                <AlertTriangle size={12} /> Error Only
                            </button>
                            <button 
                                onClick={() => onReportError(err.message, code)}
                                className="flex items-center gap-1 bg-lrgex-orange text-white px-2 py-1.5 rounded text-[10px] hover:bg-orange-600 transition-colors font-bold"
                            >
                                <Bot size={12} /> Fix Code
                            </button>
                        </div>
                    )}
                </div>
            );
        }
    }, [code, onReportError]);

    if (!GeneratedComponent) {
        return <div className="flex items-center justify-center h-full text-lrgex-muted text-xs opacity-50">Empty Widget</div>;
    }

    return (
        <GeneratedComponent 
            width={width} 
            height={height} 
            customData={customData || {}}
            setCustomData={onSetCustomData}
        />
    );
};

// 4. Main Wrapper (The Safety Layer)
export const CustomCodeWidget: React.FC<CustomCodeWidgetProps> = (props) => {
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

    // We purposefully do NOT put RenderGuard here anymore.
    // The Loop usually happens inside InnerCustomCodeWidget due to state updates.
    // The ErrorBoundary here catches errors thrown by the Internal Guard inside InnerCustomCodeWidget.

    return (
        <div ref={containerRef} className="w-full h-full custom-code-container relative overflow-hidden">
             {dimensions.width > 0 && (
                <WidgetErrorBoundary onReportError={props.onReportError} codeHash={props.code} code={props.code} title={props.title}>
                    <InnerCustomCodeWidget 
                        {...props} 
                        width={dimensions.width} 
                        height={dimensions.height} 
                    />
                </WidgetErrorBoundary>
             )}
        </div>
    );
};
