import React from 'react';
import { useConfigStore } from '../../stores/useConfigStore';

export const SystemSettings: React.FC = () => {
    // 1. 细粒度选择 State，性能优化关键
    const systemPrompt = useConfigStore((state) => state.systemPrompt);
    const setSystemPrompt = useConfigStore((state) => state.setSystemPrompt);

    return (
        <div className="space-y-4 animate-fadeIn">
            <div>
                <div className="flex justify-between items-center mb-2">
                    <label className="text-xs text-slate-400 font-medium">System Instructions</label>
                    <span className="text-[9px] text-blue-500 uppercase font-bold bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/20">
                        In-Memory (Dev)
                    </span>
                </div>
                <textarea
                    value={systemPrompt}
                    onChange={(e) => setSystemPrompt(e.target.value)}
                    className="w-full h-80 bg-slate-950 text-slate-300 p-3 rounded-md text-sm border border-slate-800 focus:border-blue-500 outline-none resize-none leading-relaxed"
                    placeholder="You are a helpful assistant..."
                />
            </div>
        </div>
    );
};