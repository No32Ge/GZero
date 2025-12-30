import React, { useEffect, useRef } from 'react';
import { useLogStore } from '../../stores/useLogStore';
import { Icons } from '../Icon';

export const ConsolePanel: React.FC = () => {
    const { logs, isConsoleOpen, clearLogs, toggleConsole } = useLogStore();
    const endRef = useRef<HTMLDivElement>(null);

    // 自动滚动到底部
    useEffect(() => {
        if (isConsoleOpen) {
            endRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [logs, isConsoleOpen]);

    if (!isConsoleOpen) return null;

    const getIcon = (type: string) => {
        switch (type) {
            case 'error': return <span className="text-red-500"><Icons.Bug /></span>;
            case 'warn': return <span className="text-yellow-500"><Icons.Bug /></span>; // 需要在 Icon.ts 补一个 Alert，暂时用 Bug 代替或留空
            default: return <span className="text-blue-400"><Icons.Terminal /></span>;
        }
    };

    const getColor = (type: string) => {
        switch (type) {
            case 'error': return 'text-red-300 bg-red-900/10 border-l-2 border-red-500';
            case 'warn': return 'text-yellow-300 bg-yellow-900/10 border-l-2 border-yellow-500';
            default: return 'text-slate-300 border-l-2 border-transparent';
        }
    };

    return (
        <div className="fixed bottom-0 left-0 right-0 h-64 bg-[#1e1e1e] border-t border-[#333] z-40 flex flex-col shadow-2xl animate-slideUp">
            {/* Toolbar */}
            <div className="h-9 flex items-center justify-between px-4 bg-[#252526] border-b border-[#333] select-none">
                <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-300 flex items-center gap-2 uppercase tracking-wider">
                        <Icons.Terminal /> Preview Console
                    </span>
                    <span className="text-[10px] bg-[#333] px-1.5 rounded-full text-slate-400">{logs.length}</span>
                </div>
                <div className="flex items-center gap-1">
                    <button 
                        onClick={clearLogs} 
                        className="p-1 text-slate-400 hover:text-white rounded hover:bg-[#333]" 
                        title="Clear Console"
                    >
                        <Icons.Trash />
                    </button>
                    <button 
                        onClick={toggleConsole} 
                        className="p-1 text-slate-400 hover:text-white rounded hover:bg-[#333]"
                        title="Close"
                    >
                        <Icons.ChevronDown />
                    </button>
                </div>
            </div>

            {/* Logs Area */}
            <div className="flex-1 overflow-y-auto p-2 font-mono text-xs custom-scrollbar">
                {logs.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-slate-600 italic">
                        <span>No logs output</span>
                        <span className="text-[10px] mt-1">console.log() from preview will appear here</span>
                    </div>
                )}
                {logs.map((log) => (
                    <div key={log.id} className={`mb-1 px-2 py-1 rounded flex gap-2 items-start group ${getColor(log.type)}`}>
                        <span className="opacity-50 shrink-0 mt-0.5 text-[10px]">
                            {new Date(log.timestamp).toLocaleTimeString().split(' ')[0]}
                        </span>
                        <div className="flex-1 break-words whitespace-pre-wrap">
                            {log.content.map((c, i) => (
                                <span key={i} className="mr-2">{c}</span>
                            ))}
                        </div>
                    </div>
                ))}
                <div ref={endRef} />
            </div>
        </div>
    );
};