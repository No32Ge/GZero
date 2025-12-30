import React from 'react';
import { Icons } from '../Icon';
import { useConfigStore } from '../../stores/useConfigStore';
import { useUIStore } from '../../stores/useUIStore';

export const ToolSettings: React.FC = () => {
    const tools = useConfigStore(s => s.tools);
    const toggleTool = useConfigStore(s => s.toggleTool);
    const toggleToolManager = useUIStore(s => s.toggleToolManager);

    const activeCount = tools.filter(t => t.active).length;

    return (
        <div className="space-y-4 animate-fadeIn">
            {/* Launcher Card */}
            <div className="p-4 bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl border border-slate-700 shadow-sm relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                    <div className="scale-[2.5]"><Icons.Tool /></div>
                </div>
                
                <h3 className="text-sm font-bold text-white mb-1 relative z-10">Advanced Tool Manager</h3>
                <p className="text-[11px] text-slate-400 mb-4 relative z-10 max-w-[80%]">
                    Create, edit, and debug tools using the new dedicated studio environment.
                </p>

                <div className="flex items-center gap-3 text-[10px] text-slate-500 mb-4 font-mono relative z-10">
                    <span className="flex items-center gap-1.5 bg-slate-950/50 px-2 py-1 rounded">
                        <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
                        {tools.length} Installed
                    </span>
                    <span className="flex items-center gap-1.5 bg-slate-950/50 px-2 py-1 rounded">
                        <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                        {activeCount} Active
                    </span>
                </div>

                <button
                    onClick={toggleToolManager}
                    className="w-full bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold py-2.5 rounded-lg flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-900/20 relative z-10"
                >
                    <Icons.Settings /> Open Tool Studio
                </button>
            </div>

            {/* Quick Toggle List */}
            <div>
                <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 px-1">Quick Toggles</h4>
                <div className="space-y-1">
                    {tools.length === 0 && (
                        <div className="text-center py-4 text-xs text-slate-600 italic">No tools installed.</div>
                    )}
                    {tools.map(t => (
                        <div key={t.id} className="flex items-center justify-between p-2 rounded hover:bg-slate-800/50 transition-colors group">
                             <div className="flex items-center gap-2 min-w-0">
                                <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${t.active ? 'bg-green-500' : 'bg-slate-700'}`}></div>
                                <span className={`text-xs font-mono truncate ${t.active ? 'text-slate-300' : 'text-slate-500'}`}>{t.definition.name}</span>
                             </div>
                             <button
                                onClick={() => toggleTool(t.id)}
                                className={`text-[10px] font-bold px-2 py-0.5 rounded transition-colors ${
                                    t.active 
                                    ? 'bg-green-500/10 text-green-400 hover:bg-green-500/20' 
                                    : 'bg-slate-800 text-slate-500 hover:text-slate-300'
                                }`}
                             >
                                {t.active ? 'ON' : 'OFF'}
                             </button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};