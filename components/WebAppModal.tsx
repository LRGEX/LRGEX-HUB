
import React, { useState, useEffect } from 'react';
import { WebApp } from '../types';
import { X, Upload, Check } from 'lucide-react';

interface WebAppModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (app: Omit<WebApp, 'id'>) => void;
    initialData?: WebApp;
    existingCategories: string[];
}

export const WebAppModal: React.FC<WebAppModalProps> = ({ isOpen, onClose, onSave, initialData, existingCategories }) => {
    const [name, setName] = useState('');
    const [url, setUrl] = useState('');
    const [description, setDescription] = useState('');
    const [iconUrl, setIconUrl] = useState('');
    const [category, setCategory] = useState('');
    const [newCategory, setNewCategory] = useState('');
    const [isCustomCategory, setIsCustomCategory] = useState(false);

    useEffect(() => {
        if (isOpen) {
            if (initialData) {
                setName(initialData.name);
                setUrl(initialData.url);
                setDescription(initialData.description || '');
                setIconUrl(initialData.iconUrl || '');
                setCategory(initialData.category);
                setIsCustomCategory(false);
            } else {
                setName('');
                setUrl('');
                setDescription('');
                setIconUrl('');
                // Default to first category if available
                setCategory(existingCategories.length > 0 ? existingCategories[0] : 'Other');
                setIsCustomCategory(false);
            }
        }
    }, [isOpen, initialData]); // Removed existingCategories to prevent reset loops

    if (!isOpen) return null;

    const handleSave = () => {
        if (!name || !url) return;
        
        onSave({
            name,
            url,
            description,
            iconUrl,
            category: isCustomCategory ? newCategory : category
        });
        onClose();
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 1024 * 1024 * 2) {
            alert("Image is too large. Please choose an image under 2MB.");
            return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
            if (typeof reader.result === 'string') {
                setIconUrl(reader.result);
            }
        };
        reader.readAsDataURL(file);
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-lrgex-panel border border-lrgex-border rounded-xl shadow-2xl w-full max-w-lg p-6 animate-in zoom-in-95 duration-200">
                <div className="flex justify-between items-center mb-6 border-b border-lrgex-border pb-2">
                    <h2 className="text-xl font-bold text-white">{initialData ? 'Edit Web App' : 'Add New App'}</h2>
                    <button onClick={onClose} className="text-lrgex-muted hover:text-white"><X size={20}/></button>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-white mb-1">App Name *</label>
                        <input 
                            className="w-full bg-lrgex-bg border border-lrgex-border rounded-lg px-3 py-2 text-sm text-lrgex-text focus:border-lrgex-orange outline-none"
                            placeholder="e.g. Nextcloud"
                            value={name}
                            onChange={e => setName(e.target.value)}
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-white mb-1">URL *</label>
                        <input 
                            className="w-full bg-lrgex-bg border border-lrgex-border rounded-lg px-3 py-2 text-sm text-lrgex-text focus:border-lrgex-orange outline-none"
                            placeholder="https://yourapp.example.com"
                            value={url}
                            onChange={e => setUrl(e.target.value)}
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-lrgex-muted mb-1">Description</label>
                        <textarea 
                            className="w-full bg-lrgex-bg border border-lrgex-border rounded-lg px-3 py-2 text-sm text-lrgex-text focus:border-lrgex-orange outline-none resize-none h-20"
                            placeholder="Brief description..."
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-white mb-1">Icon (Optional)</label>
                        <div className="flex gap-2">
                             <input 
                                className="flex-1 bg-lrgex-bg border border-lrgex-border rounded-lg px-3 py-2 text-sm text-lrgex-text focus:border-lrgex-orange outline-none"
                                placeholder="Enter URL or upload image"
                                value={iconUrl}
                                onChange={e => setIconUrl(e.target.value)}
                            />
                            <label className="bg-lrgex-bg border border-lrgex-border rounded-lg px-3 flex items-center justify-center cursor-pointer hover:border-lrgex-orange transition-colors">
                                <Upload size={16} className="text-lrgex-muted" />
                                <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                            </label>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-white mb-1">Category</label>
                        <div className="flex gap-2">
                            {!isCustomCategory ? (
                                <select 
                                    className="flex-1 bg-lrgex-bg border border-lrgex-border rounded-lg px-3 py-2 text-sm text-lrgex-text focus:border-lrgex-orange outline-none"
                                    value={category}
                                    onChange={e => setCategory(e.target.value)}
                                >
                                    {existingCategories.map(cat => (
                                        <option key={cat} value={cat}>{cat}</option>
                                    ))}
                                </select>
                            ) : (
                                <input 
                                    className="flex-1 bg-lrgex-bg border border-lrgex-border rounded-lg px-3 py-2 text-sm text-lrgex-text focus:border-lrgex-orange outline-none"
                                    placeholder="New Category Name"
                                    value={newCategory}
                                    onChange={e => setNewCategory(e.target.value)}
                                    autoFocus
                                />
                            )}
                            <button 
                                onClick={() => setIsCustomCategory(!isCustomCategory)}
                                className="bg-lrgex-bg border border-lrgex-border rounded-lg px-3 flex items-center justify-center hover:bg-lrgex-hover text-white font-bold"
                            >
                                {isCustomCategory ? 'Select' : '+'}
                            </button>
                        </div>
                    </div>
                </div>

                <div className="flex gap-3 mt-8">
                    <button onClick={handleSave} className="flex-1 bg-lrgex-orange text-white py-2 rounded-lg font-bold hover:bg-orange-600 transition-colors">
                        Save App
                    </button>
                    <button onClick={onClose} className="flex-1 bg-lrgex-bg border border-lrgex-border text-lrgex-muted py-2 rounded-lg font-bold hover:bg-lrgex-hover transition-colors">
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
};
