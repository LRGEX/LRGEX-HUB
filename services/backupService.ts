import { AppData } from '../types';

// --- Server API Helpers ---

export interface ServerBackupFile {
    name: string;
    created: string;
}

export const saveBackupToServer = async (data: AppData): Promise<{ success: boolean; filename: string }> => {
    try {
        const response = await fetch('/api/backups', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
        });

        if (!response.ok) {
            throw new Error(`Server error: ${response.statusText}`);
        }

        return await response.json();
    } catch (error) {
        console.error("Failed to save backup to server:", error);
        throw error;
    }
};

export const getServerBackups = async (): Promise<ServerBackupFile[]> => {
    try {
        const response = await fetch('/api/backups');
        if (!response.ok) throw new Error(`Failed to fetch backups list: ${response.status}`);
        return await response.json();
    } catch (error) {
        console.error("Failed to list server backups:", error);
        return [];
    }
};

export const fetchServerBackup = async (filename: string): Promise<AppData> => {
    try {
        const response = await fetch(`/api/backups/${filename}`);
        if (!response.ok) throw new Error('Failed to download backup file');
        return await response.json();
    } catch (error) {
        console.error("Failed to fetch backup content:", error);
        throw error;
    }
};

// --- Local Helpers ---

export const downloadBackup = (data: AppData) => {
    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `lrgex_hub_backup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};

export const parseBackupFile = (file: File): Promise<AppData> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                // Robustly get result
                const result = e.target?.result || reader.result;
                if (!result || typeof result !== 'string') {
                    throw new Error("File is empty or unreadable");
                }

                const json = JSON.parse(result);
                
                // Basic validation
                if (!Array.isArray(json.widgets) || !Array.isArray(json.categories)) {
                    reject(new Error("Invalid backup file format: Missing required fields"));
                    return;
                }
                
                resolve(json);
            } catch (err: any) {
                reject(new Error("Failed to parse JSON: " + err.message));
            }
        };
        reader.onerror = () => reject(new Error("Failed to read file"));
        reader.readAsText(file);
    });
};