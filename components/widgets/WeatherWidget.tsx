
import React, { useEffect, useState } from 'react';
import { CloudSun, Loader2 } from 'lucide-react';
import { UniversalWidgetConfig } from '../../types';

interface WeatherWidgetProps {
    config?: UniversalWidgetConfig;
}

export const WeatherWidget: React.FC<WeatherWidgetProps> = ({ config }) => {
    const [data, setData] = useState<{ temp: number; condition: string } | null>(null);
    
    // Default to a central location (e.g. Berlin) if not configured, or use configured Lat/Long if user provides it via config
    // For simplicity, we use a fixed public API which is "Real Data"
    const endpoint = config?.endpoint || 'https://api.open-meteo.com/v1/forecast?latitude=52.52&longitude=13.41&current=temperature_2m,weather_code';

    useEffect(() => {
        const controller = new AbortController();
        const fetchData = async () => {
            try {
                const res = await fetch(endpoint, { signal: controller.signal });
                if (!res.ok) return;
                const json = await res.json();
                
                if (json.current) {
                    // Map WMO codes to simple text
                    const code = json.current.weather_code;
                    let condition = 'Clear';
                    if (code > 0 && code <= 3) condition = 'Cloudy';
                    if (code > 3 && code < 50) condition = 'Fog';
                    if (code >= 50 && code < 80) condition = 'Rain';
                    if (code >= 80) condition = 'Storm';

                    setData({
                        temp: Math.round(json.current.temperature_2m),
                        condition
                    });
                }
            } catch (e) {
                // Ignore errors for weather
            }
        };

        fetchData();
        const interval = setInterval(fetchData, 600000); // 10 mins
        return () => {
            controller.abort();
            clearInterval(interval);
        };
    }, [endpoint]);

    if (!data) return <div className="flex-1 flex items-center justify-center text-lrgex-muted p-4"><Loader2 className="animate-spin" /></div>;

    return (
        <div className="flex items-center justify-between h-full p-4">
            <div className="flex flex-col">
                <span className="text-4xl font-bold text-lrgex-text">{data.temp}°</span>
                <span className="text-sm text-lrgex-muted">{data.condition}</span>
            </div>
            <div className="text-lrgex-orange">
                <CloudSun size={48} />
            </div>
        </div>
    );
};
