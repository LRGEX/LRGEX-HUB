
import React, { useEffect, useState, useRef, useMemo } from 'react';
import * as LucideIcons from 'lucide-react';
import { AlertTriangle } from 'lucide-react';

interface CustomCodeWidgetProps {
    code: string;
}

export const CustomCodeWidget: React.FC<CustomCodeWidgetProps> = ({ code }) => {
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
            // We expose React, hooks, Lucide icons, and PROPS to the scope.
            // The code string is expected to be the BODY of a function, returning React.createElement(...)
            const func = new Function(
                'React', 
                'useState', 
                'useEffect', 
                'useRef', 
                'Lucide',
                'props',
                code
            );

            // Return a wrapper component that executes the function
            return (componentProps: any) => {
                try {
                    return func(React, useState, useEffect, useRef, LucideIcons, componentProps);
                } catch (err: any) {
                    console.error("Custom Code Runtime Error:", err);
                    return (
                        <div className="p-2 text-red-400 text-xs border border-red-500/20 bg-red-500/10 rounded h-full overflow-auto">
                            <strong>Runtime Error:</strong>
                            <pre className="mt-1 whitespace-pre-wrap">{err.message}</pre>
                        </div>
                    );
                }
            };
        } catch (err: any) {
            console.error("Custom Code Compilation Error:", err);
            return () => (
                <div className="p-2 text-red-400 text-xs border border-red-500/20 bg-red-500/10 rounded h-full overflow-auto">
                    <strong>Compilation Error:</strong>
                    <pre className="mt-1 whitespace-pre-wrap">{err.message}</pre>
                </div>
            );
        }
    }, [code]);

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
                <GeneratedComponent width={dimensions.width} height={dimensions.height} />
             )}
        </div>
    );
};
