import React, { useState, useRef, useEffect } from 'react';
import { useBrain } from '../contexts/BrainContext';
import { Icons } from './Icon';
import { ModelSettings } from './config/ModelSettings';
import { SystemSettings } from './config/SystemSettings';
import { MemorySettings } from './config/MemorySettings';
import { ToolSettings } from './config/ToolSettings';
import { EnvSettings } from './config/EnvSettings';

interface ConfigPanelProps {
    onCloseMobile: () => void;
}

export const ConfigPanel: React.FC<ConfigPanelProps> = ({ onCloseMobile }) => {
    const { 
        handleImport, 
        handleExport 
    } = useBrain();

    const [activeTab, setActiveTab] = useState<'models' | 'system' | 'memory' | 'tools' | 'env'>('models');
    const [showExportMenu, setShowExportMenu] = useState(false);
    const exportRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (exportRef.current && !exportRef.current.contains(event.target as Node)) {
                setShowExportMenu(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            handleImport(e.target.files[0]);
        }
    };

    return (
        <div className="h-full w-full bg-slate-900 border-r border-slate-800 flex flex-col">
            {/* Header */}
            <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900">
                <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2 tracking-wide">
                    <Icons.Brain /> Ge Brain
                </h2>
                <button onClick={onCloseMobile} className="md:hidden text-slate-400 hover:text-white">
                    <Icons.X />
                </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-slate-800 mx-0 bg-slate-900/50 overflow-x-auto scrollbar-hide">
                {(['models', 'system', 'memory', 'tools', 'env'] as const).map((tab) => (
                    <button 
                        key={tab}
                        onClick={() => setActiveTab(tab)} 
                        className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-wider transition-colors border-b-2 min-w-[50px] ${
                            activeTab === tab 
                            ? 'text-blue-400 border-blue-400 bg-slate-800/30' 
                            : 'text-slate-500 border-transparent hover:text-slate-300'
                        }`}
                    >
                        {tab}
                    </button>
                ))}
            </div>

            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                {activeTab === 'models' && <ModelSettings />}
                {activeTab === 'system' && <SystemSettings />}
                {activeTab === 'memory' && <MemorySettings />}
                {activeTab === 'tools' && <ToolSettings />}
                {activeTab === 'env' && <EnvSettings />}
            </div>
            
            <div className="p-4 border-t border-slate-800 bg-slate-900 flex gap-2">
                <label className="flex-1 cursor-pointer bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs py-2 px-3 rounded flex items-center justify-center gap-2 transition-colors">
                    <Icons.Upload /> Import
                    <input type="file" onChange={handleFileUpload} accept=".json" className="hidden" />
                </label>
                
                <div className="flex-1 relative" ref={exportRef}>
                    <button 
                        onClick={() => setShowExportMenu(!showExportMenu)} 
                        className="w-full bg-emerald-700/80 hover:bg-emerald-600 border border-emerald-600/50 text-emerald-100 text-xs py-2 px-3 rounded flex items-center justify-center gap-2 transition-colors"
                    >
                        <Icons.Save /> Export
                    </button>
                    {showExportMenu && (
                        <div className="absolute bottom-full mb-2 right-0 w-48 bg-slate-900 border border-slate-700 rounded-lg shadow-xl overflow-hidden z-50">
                            <button 
                                onClick={() => { handleExport('state'); setShowExportMenu(false); }}
                                className="w-full text-left px-4 py-3 hover:bg-slate-800 text-xs text-slate-200 border-b border-slate-800"
                            >
                                <span className="font-bold block text-white">Export Session</span>
                                <span className="text-[10px] text-slate-500">Save Full App State</span>
                            </button>
                            <button 
                                onClick={() => { handleExport('raw'); setShowExportMenu(false); }}
                                className="w-full text-left px-4 py-3 hover:bg-slate-800 text-xs text-slate-200"
                            >
                                <span className="font-bold block text-orange-300">Export Raw Request</span>
                                <span className="text-[10px] text-slate-500">Debug API JSON Body</span>
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};