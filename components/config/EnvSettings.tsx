import React, { useState } from 'react';
import { Icons } from '../Icon';
import { useConfigStore } from '../../stores/useConfigStore';

export const EnvSettings: React.FC = () => {
    const env = useConfigStore(s => s.env);
    const setEnv = useConfigStore(s => s.setEnv);
    const removeEnv = useConfigStore(s => s.removeEnv);

    const [newKey, setNewKey] = useState('');
    const [newValue, setNewValue] = useState('');
    const [showValues, setShowValues] = useState(false);

    const handleAddEnv = () => {
        if (!newKey.trim() || !newValue.trim()) return;
        
        // Key 自动转大写且去除空格，符合 ENV 习惯
        const cleanKey = newKey.trim().toUpperCase().replace(/\s+/g, '_');
        
        setEnv(cleanKey, newValue.trim());
        
        setNewKey('');
        setNewValue('');
    };

    return (
        <div className="space-y-4 animate-fadeIn">
            <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                        <Icons.Key /> Environment Variables
                    </h3>
                    <button 
                        onClick={() => setShowValues(!showValues)}
                        className="text-[10px] text-slate-500 hover:text-blue-400 underline"
                    >
                        {showValues ? 'Hide Values' : 'Show Values'}
                    </button>
                </div>
                
                <p className="text-[10px] text-slate-500 mb-4">
                    在这里配置的变量可以在工具（Tools）代码中通过 <code className="bg-slate-900 px-1 py-0.5 rounded text-orange-300">env.KEY_NAME</code> 直接访问。
                    这些数据仅存储在您的本地浏览器中。
                </p>

                <div className="flex flex-col gap-2 mb-4">
                    <input 
                        className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-2 text-xs text-white focus:border-purple-500 outline-none font-mono uppercase placeholder:normal-case"
                        placeholder="Key (e.g. SERPER_API_KEY)"
                        value={newKey}
                        onChange={(e) => setNewKey(e.target.value)}
                    />
                    <div className="flex gap-2">
                        <input 
                            className="flex-1 min-w-0 bg-slate-950 border border-slate-700 rounded px-2 py-2 text-xs text-white focus:border-purple-500 outline-none font-mono"
                            placeholder="Value"
                            type={showValues ? "text" : "password"}
                            value={newValue}
                            onChange={(e) => setNewValue(e.target.value)}
                        />
                        <button 
                            onClick={handleAddEnv}
                            disabled={!newKey || !newValue}
                            className="bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:hover:bg-purple-600 text-white px-3 py-2 rounded text-xs font-bold transition-colors shrink-0"
                        >
                            <Icons.Plus />
                        </button>
                    </div>
                </div>

                {/* List */}
                <div className="space-y-2">
                    {Object.entries(env).length === 0 && (
                        <div className="text-center py-4 text-xs text-slate-600 italic">No environment variables defined.</div>
                    )}
                    
                    {Object.entries(env).map(([key, value]) => (
                        <div key={key} className="flex items-center gap-2 bg-slate-900 p-2 rounded border border-slate-800 hover:border-slate-700 transition-colors group">
                            <div className="w-8 h-8 flex items-center justify-center bg-slate-800 rounded text-slate-500 shrink-0">
                                <Icons.Key />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="text-[10px] font-bold text-purple-300 font-mono truncate" title={key}>{key}</div>
                                <div className="text-[10px] text-slate-500 font-mono truncate">
                                    {showValues ? value : '••••••••••••••••••••'}
                                </div>
                            </div>
                            <button 
                                onClick={() => removeEnv(key)}
                                className="p-2 text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                            >
                                <Icons.Trash />
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};