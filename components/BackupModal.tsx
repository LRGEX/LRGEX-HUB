
import React, { useState, useRef, useEffect } from 'react';
import { AppData, BackupSettings, BackupInterval } from '../types';
import { downloadBackup, parseBackupFile, getServerBackups, fetchServerBackup, ServerBackupFile } from '../services/backupService';
import { Upload, Download, Check, AlertTriangle, X, Database, Clock, Calendar, Server, HardDrive } from 'lucide-react';

interface BackupModalProps {
    isOpen: boolean;
    onClose: () => void;
    data: AppData;
    onRestore: (newData: AppData) => void;
    onUpdateSettings: (settings: BackupSettings) => void;
}

const INTERVALS: { id: BackupInterval; name: string }[] = [
    { id: 'HOURLY', name: 'Every Hour' },
    { id: 'DAILY', name: 'Every Day' },
    { id: 'WEEKLY', name: 'Every Week' },
];

export const BackupModal: React.FC<BackupModalProps> = ({ isOpen, onClose, data, onRestore, onUpdateSettings }) => {
    const [statusMsg, setStatusMsg] = useState<string | null>(null);
    const [statusType, setStatusType] = useState<'SUCCESS' | 'ERROR' | null>(null);
    
    // Server Backups State
    const [serverBackups, setServerBackups] = useState<ServerBackupFile[]>([]);
    const [loadingBackups, setLoadingBackups] = useState(false);

    // Confirmation State
    const [pendingData, setPendingData] = useState<AppData | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen) {
            loadServerBackups();
        }
    }, [isOpen]);

    const loadServerBackups = async () => {
        setLoadingBackups(true);
        try {
            const backups = await getServerBackups();
            setServerBackups(backups);
        } catch (e) {
            console.error("Failed to load server backups");
        } finally {
            setLoadingBackups(false);
        }
    };

    if (!isOpen) return null;

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            const newData = await parseBackupFile(file);
            setPendingData(newData); // Switch to confirmation view
            setStatusMsg(null);
        } catch (err: any) {
            setStatusMsg(err.message);
            setStatusType('ERROR');
        }
        
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleServerRestore = async (filename: string) => {
        try {
            const newData = await fetchServerBackup(filename);
            setPendingData(newData);
            setStatusMsg(null);
        } catch (e: any) {
            setStatusMsg("Failed to fetch backup from server");
            setStatusType('ERROR');
        }
    };

    const confirmRestore = () => {
        if (pendingData) {
            onRestore(pendingData);
            setPendingData(null);
            setStatusMsg("Backup restored successfully!");
            setStatusType('SUCCESS');
            setTimeout(() => {
                setStatusMsg(null);
                onClose();
            }, 1500);
        }
    };

    const cancelRestore = () => {
        setPendingData(null);
        setStatusMsg(null);
    };

    const updateSetting = (key: keyof BackupSettings, value: any) => {
        onUpdateSettings({
            ...data.backupSettings,
            [key]: value
        });
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="bg-lrgex-panel border border-lrgex-border rounded-xl shadow-2xl w-full max-w-xl flex flex-col animate-in zoom-in-95 duration-200 max-h-[85vh] overflow-hidden">
                
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-lrgex-border shrink-0">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <Database className="text-lrgex-orange" /> Backup & Restore
                    </h2>
                    <button onClick={onClose} className="text-lrgex-muted hover:text-white"><X size={24}/></button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto custom-scrollbar">
                    
                    {/* Status Banner */}
                    {statusMsg && (
                        <div className={`mb-6 p-3 rounded-lg border flex items-center gap-2 ${statusType === 'SUCCESS' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
                            {statusType === 'SUCCESS' ? <Check size={16}/> : <AlertTriangle size={16}/>}
                            <span className="text-sm">{statusMsg}</span>
                        </div>
                    )}

                    {pendingData ? (
                        // CONFIRMATION SCREEN
                        <div className="space-y-6 animate-in slide-in-from-right-4 fade-in duration-200">
                             <div className="bg-lrgex-bg/50 border border-lrgex-orange/50 rounded-xl p-4 text-center">
                                <AlertTriangle className="mx-auto text-lrgex-orange mb-2" size={32} />
                                <h3 className="text-lg font-bold text-white mb-1">Confirm Restore?</h3>
                                <p className="text-sm text-lrgex-muted">This will overwrite your current configuration.</p>
                             </div>

                             <div className="grid grid-cols-2 gap-4">
                                 <div className="bg-lrgex-bg p-3 rounded-lg border border-lrgex-border">
                                     <div className="text-xs text-lrgex-muted uppercase">Widgets</div>
                                     <div className="text-xl font-bold text-white">{pendingData.widgets.length}</div>
                                 </div>
                                 <div className="bg-lrgex-bg p-3 rounded-lg border border-lrgex-border">
                                     <div className="text-xs text-lrgex-muted uppercase">Categories</div>
                                     <div className="text-xl font-bold text-white">{pendingData.categories.length}</div>
                                 </div>
                             </div>

                             <div className="flex gap-3 pt-2">
                                 <button 
                                    onClick={confirmRestore}
                                    className="flex-1 bg-lrgex-orange text-white py-2 rounded-lg font-semibold hover:bg-orange-600 transition-colors"
                                 >
                                    Yes, Restore Backup
                                 </button>
                                 <button 
                                    onClick={cancelRestore}
                                    className="flex-1 bg-lrgex-panel border border-lrgex-border text-lrgex-muted py-2 rounded-lg hover:bg-lrgex-hover hover:text-white transition-colors"
                                 >
                                    Cancel
                                 </button>
                             </div>
                        </div>
                    ) : (
                        // MAIN SCREEN
                        <div className="space-y-8">
                            <div className="space-y-4">
                                <h3 className="text-xs font-bold text-lrgex-muted uppercase tracking-wider">Manual Actions</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="bg-lrgex-bg/50 p-4 rounded-xl border border-lrgex-border hover:border-lrgex-orange/50 transition-colors group cursor-pointer" onClick={() => downloadBackup(data)}>
                                        <div className="flex items-center gap-3 mb-3">
                                            <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400 group-hover:bg-emerald-500 group-hover:text-white transition-colors">
                                                <Download size={20} />
                                            </div>
                                            <div className="font-semibold text-white text-sm">Local Export</div>
                                        </div>
                                        <p className="text-[10px] text-lrgex-muted">Download .json to computer</p>
                                    </div>

                                    <label className="bg-lrgex-bg/50 p-4 rounded-xl border border-lrgex-border hover:border-lrgex-orange/50 transition-colors group cursor-pointer block">
                                        <div className="flex items-center gap-3 mb-3">
                                            <div className="p-2 bg-blue-500/10 rounded-lg text-blue-400 group-hover:bg-blue-500 group-hover:text-white transition-colors">
                                                <Upload size={20} />
                                            </div>
                                            <div className="font-semibold text-white text-sm">Local Import</div>
                                        </div>
                                        <p className="text-[10px] text-lrgex-muted">Restore .json from computer</p>
                                        <input 
                                            ref={fileInputRef}
                                            type="file" 
                                            accept=".json" 
                                            onChange={handleFileUpload} 
                                            className="hidden" 
                                        />
                                    </label>
                                </div>
                            </div>

                            <div className="space-y-4 pt-4 border-t border-lrgex-border">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h3 className="text-xs font-bold text-lrgex-muted uppercase tracking-wider flex items-center gap-2">
                                            <Server size={12} /> Config Backup Schedule
                                        </h3>
                                        <p className="text-[10px] text-lrgex-muted mt-1 max-w-[250px]">
                                            Backups are saved to <code>/config/backups</code> in the container.
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className={`text-xs ${data.backupSettings.enabled ? 'text-emerald-400' : 'text-lrgex-muted'}`}>
                                            {data.backupSettings.enabled ? 'Active' : 'Disabled'}
                                        </span>
                                        <button 
                                            onClick={() => updateSetting('enabled', !data.backupSettings.enabled)}
                                            className={`w-8 h-4 rounded-full transition-colors relative ${data.backupSettings.enabled ? 'bg-emerald-500' : 'bg-lrgex-border'}`}
                                        >
                                            <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-transform ${data.backupSettings.enabled ? 'left-4.5' : 'left-0.5'}`} style={{ transform: data.backupSettings.enabled ? 'translateX(100%)' : 'translateX(0)' }} />
                                        </button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-3 gap-2">
                                    {INTERVALS.map(int => (
                                        <button
                                            key={int.id}
                                            onClick={() => updateSetting('schedule', int.id)}
                                            disabled={!data.backupSettings.enabled}
                                            className={`py-2 rounded-lg border text-xs transition-all flex flex-col items-center gap-1 ${
                                                data.backupSettings.schedule === int.id 
                                                    ? 'bg-lrgex-hover border-lrgex-orange text-white shadow-sm' 
                                                    : 'bg-lrgex-bg border-lrgex-border text-lrgex-muted'
                                            } ${!data.backupSettings.enabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-lrgex-muted'}`}
                                        >
                                            <Calendar size={12} className="opacity-50"/>
                                            {int.name}
                                        </button>
                                    ))}
                                </div>

                                {/* Server File List */}
                                {serverBackups.length > 0 && (
                                    <div className="mt-4 space-y-2">
                                        <h4 className="text-xs font-bold text-lrgex-muted uppercase flex items-center gap-1">
                                            <HardDrive size={10}/> Server Storage ({serverBackups.length})
                                        </h4>
                                        <div className="bg-lrgex-bg rounded-lg border border-lrgex-border max-h-32 overflow-y-auto custom-scrollbar">
                                            {serverBackups.map((file, idx) => (
                                                <div key={idx} className="flex items-center justify-between p-2 border-b border-lrgex-border/50 last:border-0 hover:bg-lrgex-hover/50">
                                                    <div className="flex flex-col min-w-0 flex-1 mr-2">
                                                        <span className="text-xs text-lrgex-text truncate" title={file.name}>{file.name}</span>
                                                        <span className="text-[10px] text-lrgex-muted">{new Date(file.created).toLocaleString()}</span>
                                                    </div>
                                                    <button 
                                                        onClick={() => handleServerRestore(file.name)}
                                                        className="text-[10px] bg-lrgex-panel hover:bg-lrgex-orange text-lrgex-muted hover:text-white px-2 py-1 rounded transition-colors"
                                                    >
                                                        Restore
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {loadingBackups && <div className="text-center text-xs text-lrgex-muted py-2">Checking server storage...</div>}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
