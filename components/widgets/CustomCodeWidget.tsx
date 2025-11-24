
import React, { Component, useEffect, useState, useRef, useMemo, ReactNode } from 'react';
import * as LucideIcons from 'lucide-react';
import { AlertTriangle, Bot } from 'lucide-react';

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

    render() {
        if (this.state.hasError) {
            const { onReportError } = this.props;
            return (
                <div className="p-2 text-red-400 text-xs border border-red-500/20 bg-red-500/10 rounded h-full overflow-auto flex flex-col gap-2">
                    <div>
                        <strong>Render Error:</strong>
                        <pre className="mt-1 whitespace-pre-wrap">{this.state.errorMsg}</pre>
                    </div>
                    {onReportError && (
                        <button 
                            onClick={() => onReportError(this.state.errorMsg)}
                            className="flex items-center gap-1 bg-lrgex-orange text-white px-2 py-1 rounded text-[10px] w-fit hover:bg-orange-600 transition-colors"
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
            body: options.body // Pass as is, don't double stringify. The server will handle it.
        })
    });
    
    if (!response.ok) {
        // Robustly handle error reading
        const text = await response.text();
        try {
            const errorJson = JSON.parse(text);
            throw new Error(errorJson.details || errorJson.error || `Proxy Error (${response.status})`);
        } catch (e: any) {
            // If the error thrown was the one above, rethrow
            if (e.message && e.message.includes('Proxy Error')) throw e;
            
            // Otherwise it was a JSON parse error, meaning the server sent back raw text (HTML or plain text error)
            throw new Error(`Proxy Error (${response.status}): ${text}`);
        }
    }
    return response;
};

export const CustomCodeWidget: React.FC<CustomCodeWidgetProps> = ({ code, customData, onSetCustomData, onReportError }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

    // Track container size for responsive logic
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

    // Safe execution engine for "Headless" React Components
    const GeneratedComponent = useMemo(() => {
        try {
            if (!code || !code.trim()) return null;

            // Construct the function body. 
            // We expose React, hooks, Lucide icons, PROPS, and proxyFetch to the scope.
            // The code string is expected to be the BODY of a function, returning React.createElement(...)
            const func = new Function(
                'React', 
                'useState', 
                'useEffect', 
                'useRef', 
                'Lucide', 
                'props',
                'proxyFetch', // Inject Proxy Fetcher
                code
            );

            // Return a wrapper component that executes the function
            return (componentProps: any) => {
                try {
                    return func(React, useState, useEffect, useRef, LucideIcons, componentProps, proxyFetch);
                } catch (err: any) {
                    // Logic errors during execution (before render)
                    throw new Error(err.message); 
                }
            };
        } catch (err: any) {
            console.error("Custom Code Compilation Error:", err);
            return () => (
                <div className="p-2 text-red-400 text-xs border border-red-500/20 bg-red-500/10 rounded h-full overflow-auto flex flex-col gap-2">
                    <div>
                        <strong>Compilation Error:</strong>
                        <pre className="mt-1 whitespace-pre-wrap">{err.message}</pre>
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
             {/* Only render if we have dimensions to prevent initial 0-size glitches */}
             {dimensions.width > 0 && (
                <WidgetErrorBoundary onReportError={onReportError}>
                    <GeneratedComponent 
                        width={dimensions.width} 
                        height={dimensions.height} 
                        customData={customData || {}}
                        setCustomData={onSetCustomData}
                    />
                </WidgetErrorBoundary>
             )}
        </div>
    );
};
