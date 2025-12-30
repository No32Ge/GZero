import React, { useState } from 'react';
import { VirtualMemory } from '../../types';
import { Icons } from '../Icon';
import { useConfigStore } from '../../stores/useConfigStore';

export const MemorySettings: React.FC = () => {
    const memories = useConfigStore(s => s.memories);
    const addMemory = useConfigStore(s => s.addMemory);
    const toggleMemory = useConfigStore(s => s.toggleMemory);
    const deleteMemory = useConfigStore(s => s.deleteMemory);

    const [newMemoryName, setNewMemoryName] = useState('');
    const [newMemoryContent, setNewMemoryContent] = useState('');

    const handleAddMemory = () => {
        if (!newMemoryName || !newMemoryContent) return;
        const memory: VirtualMemory = {
            id: crypto.randomUUID(),
            name: newMemoryName,
            content: newMemoryContent,
            active: true,
        };
        addMemory(memory);
        setNewMemoryName('');
        setNewMemoryContent('');
    };

    return (
        <div className="space-y-4 animate-fadeIn">
            <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-800">
                <h3 className="text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-wider">New Memory Block</h3>
                <input 
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-xs text-white mb-2 focus:border-blue-500 outline-none"
                    placeholder="Name (e.g., Project Specs)"
                    value={newMemoryName}
                    onChange={(e) => setNewMemoryName(e.target.value)}
                />
                <textarea 
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-xs text-white h-20 mb-2 focus:border-blue-500 outline-none resize-none"
                    placeholder="Content..."
                    value={newMemoryContent}
                    onChange={(e) => setNewMemoryContent(e.target.value)}
                />
                <button 
                    onClick={handleAddMemory}
                    className="w-full bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium py-1.5 rounded transition-colors flex justify-center items-center gap-2"
                >
                    <Icons.Plus /> Add Memory
                </button>
            </div>

            <div className="space-y-2">
                {memories.map(m => (
                    <div key={m.id} className={`group p-3 rounded-lg border transition-all ${m.active ? 'border-blue-500/30 bg-blue-900/10' : 'border-slate-800 bg-slate-900'}`}>
                        <div className="flex justify-between items-center mb-1">
                            <div className="flex items-center gap-2">
                                <input 
                                    type="checkbox" 
                                    checked={m.active} 
                                    onChange={() => toggleMemory(m.id)} 
                                    className="accent-blue-500 cursor-pointer"
                                />
                                <span className={`text-xs font-semibold ${m.active ? 'text-blue-200' : 'text-slate-400'}`}>{m.name}</span>
                            </div>
                            <button onClick={() => deleteMemory(m.id)} className="text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"><Icons.Trash /></button>
                        </div>
                        <p className="text-[10px] text-slate-500 line-clamp-2 pl-5">{m.content}</p>
                    </div>
                ))}
                {memories.length === 0 && (
                    <div className="text-center py-8 text-xs text-slate-600 italic">No memories defined.</div>
                )}
            </div>
        </div>
    );
};