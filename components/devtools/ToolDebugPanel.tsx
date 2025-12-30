import React, { useState, useMemo } from 'react';
import { ToolLog, AppConfig } from '../../types';
import { Icons } from '../Icon';

interface ToolDebugPanelProps {
    logs: ToolLog[];
    isOpen: boolean;
    onClose: () => void;
    onClearLogs: () => void;
    isPaused: boolean;
    onTogglePause: () => void;
    config: AppConfig;
    onRunTool: (name: string, args: string) => void;
}

export const ToolDebugPanel: React.FC<ToolDebugPanelProps> = ({
    logs, isOpen, onClose, onClearLogs, isPaused, onTogglePause, config, onRunTool
}) => {
    const [selectedLogId, setSelectedLogId] = useState<string | null>(null);
    const [editArgs, setEditArgs] = useState('');
    const [isEditing, setIsEditing] = useState(false);

    const selectedLog = useMemo(() => logs.find(l => l.id === selectedLogId), [logs, selectedLogId]);

    // Update edit args when selection changes
    React.useEffect(() => {
        if (selectedLog) {
            setEditArgs(JSON.stringify(selectedLog.args, null, 2));
            setIsEditing(false);
        }
    }, [selectedLogId]);

    if (!isOpen) return null;

    const getStatusColor = (status: ToolLog['status']) => {
        switch(status) {
            case 'pending': return 'text-slate-500 bg-slate-800';
            case 'running': return 'text-blue-400 bg-blue-900/30 border-blue-500/50 animate-pulse';
            case 'success': return 'text-green-400 bg-green-900/20';
            case 'error': return 'text-red-400 bg-red-900/20';
        }
    };

    const formatDuration = (ms?: number) => {
        if (ms === undefined) return '-';
        if (ms < 10) return `${ms.toFixed(2)}ms`;
        return `${Math.round(ms)}ms`;
    };

    const handleRun = () => {
        if (!selectedLog) return;
        onRunTool(selectedLog.toolName, editArgs);
    };

    return (
        <div className="fixed bottom-0 left-0 right-0 h-96 bg-slate-950 border-t border-slate-800 shadow-2xl z-50 flex flex-col animate-slideUp">
            {/* Header */}
            <div className="h-10 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-4 shrink-0">
                <div className="flex items-center gap-4">
                    <h3 className="text-xs font-bold text-slate-200 flex items-center gap-2">
                        <Icons.Bug /> Tool Debugger
                    </h3>
                    <div className="h-4 w-px bg-slate-700"></div>
                    <div className="flex items-center gap-2 text-[10px] text-slate-400">
                        <span>Total: {logs.length}</span>
                        <span>Errors: {logs.filter(l => l.status === 'error').length}</span>
                    </div>
                </div>
                
                <div className="flex items-center gap-2">
                     <button 
                        onClick={onTogglePause}
                        className={`flex items-center gap-1.5 px-3 py-1 rounded text-[10px] font-bold transition-colors ${
                            isPaused 
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50' 
                            : 'bg-slate-800 text-slate-400 hover:text-white'
                        }`}
                        title="Pause auto-execution of tools"
                    >
                        {isPaused ? <><Icons.Pause /> Paused</> : <><Icons.Play /> Running</>}
                    </button>
                    <button 
                        onClick={onClearLogs}
                        className="p-1.5 text-slate-500 hover:text-white rounded hover:bg-slate-800"
                        title="Clear Logs"
                    >
                        <Icons.Trash />
                    </button>
                    <button 
                        onClick={onClose}
                        className="p-1.5 text-slate-500 hover:text-white rounded hover:bg-slate-800"
                    >
                        <Icons.ChevronDown />
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 flex overflow-hidden">
                {/* Left: Log List */}
                <div className="w-1/3 border-r border-slate-800 flex flex-col bg-slate-925">
                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        {logs.length === 0 && (
                            <div className="flex flex-col items-center justify-center h-full text-slate-600 gap-2">
                                <Icons.Terminal />
                                <span className="text-xs">No execution logs</span>
                            </div>
                        )}
                        {logs.slice().reverse().map(log => (
                            <div 
                                key={log.id}
                                onClick={() => setSelectedLogId(log.id)}
                                className={`p-3 border-b border-slate-800/50 cursor-pointer transition-colors ${
                                    selectedLogId === log.id ? 'bg-blue-900/10 border-l-2 border-l-blue-500' : 'hover:bg-slate-900'
                                }`}
                            >
                                <div className="flex justify-between items-start mb-1">
                                    <span className="font-mono text-xs font-bold text-slate-300 truncate max-w-[140px]" title={log.toolName}>
                                        {log.toolName}
                                    </span>
                                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wide ${getStatusColor(log.status)}`}>
                                        {log.status}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center text-[10px] text-slate-500 font-mono">
                                    <span>{new Date(log.startTime).toLocaleTimeString().split(' ')[0]}</span>
                                    <span className="flex items-center gap-1">
                                        <Icons.Clock /> {formatDuration(log.duration)}
                                    </span>
                                </div>
                                {/* Mini Bar for duration (relative to 5s max) */}
                                {log.duration && (
                                    <div className="mt-1.5 h-0.5 bg-slate-800 rounded-full overflow-hidden w-full">
                                        <div 
                                            className={`h-full ${log.status === 'error' ? 'bg-red-500' : 'bg-blue-500'}`}
                                            style={{ width: `${Math.min((log.duration / 5000) * 100, 100)}%` }}
                                        />
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Right: Details */}
                <div className="flex-1 flex flex-col bg-slate-950 min-w-0">
                    {selectedLog ? (
                        <div className="flex flex-col h-full">
                            {/* Toolbar */}
                            <div className="h-8 border-b border-slate-800 flex items-center px-4 bg-slate-900/50 gap-4">
                                <span className="text-[10px] font-mono text-slate-500">ID: {selectedLog.callId}</span>
                                <div className="flex-1" />
                                <button 
                                    onClick={() => setIsEditing(!isEditing)}
                                    className={`text-[10px] font-bold uppercase ${isEditing ? 'text-blue-400' : 'text-slate-400 hover:text-white'}`}
                                >
                                    {isEditing ? 'Cancel Edit' : 'Edit Args'}
                                </button>
                                <button 
                                    onClick={handleRun}
                                    className="bg-purple-600 hover:bg-purple-500 text-white text-[10px] font-bold px-3 py-1 rounded flex items-center gap-1"
                                >
                                    <Icons.Play /> Test Run
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                                {/* Args Section */}
                                <div>
                                    <div className="text-[10px] font-bold text-slate-500 uppercase mb-2 flex items-center gap-2">
                                        INPUT (Arguments)
                                    </div>
                                    {isEditing ? (
                                        <textarea 
                                            value={editArgs}
                                            onChange={e => setEditArgs(e.target.value)}
                                            className="w-full h-32 bg-slate-900 border border-slate-700 rounded p-2 text-xs font-mono text-orange-200 outline-none focus:border-blue-500"
                                        />
                                    ) : (
                                        <pre className="bg-slate-900 p-3 rounded border border-slate-800 text-xs font-mono text-orange-200 whitespace-pre-wrap overflow-x-auto">
                                            {JSON.stringify(selectedLog.args, null, 2)}
                                        </pre>
                                    )}
                                </div>

                                {/* Result Section */}
                                <div>
                                    <div className="text-[10px] font-bold text-slate-500 uppercase mb-2">OUTPUT (Result)</div>
                                    {selectedLog.error ? (
                                        <div className="bg-red-900/20 p-3 rounded border border-red-500/30 text-xs font-mono text-red-300">
                                            {selectedLog.error}
                                        </div>
                                    ) : (
                                        <pre className="bg-slate-900 p-3 rounded border border-slate-800 text-xs font-mono text-green-300 whitespace-pre-wrap overflow-x-auto">
                                            {selectedLog.result ? JSON.stringify(selectedLog.result, null, 2) : (selectedLog.status === 'running' ? 'Executing...' : 'No output')}
                                        </pre>
                                    )}
                                </div>

                                {/* Console Logs */}
                                {selectedLog.consoleLogs.length > 0 && (
                                    <div>
                                        <div className="text-[10px] font-bold text-slate-500 uppercase mb-2 flex items-center gap-2">
                                            <Icons.Terminal /> Console Logs
                                        </div>
                                        <div className="bg-black/50 p-3 rounded border border-slate-800 font-mono text-[10px] text-slate-400 space-y-1 max-h-40 overflow-y-auto">
                                            {selectedLog.consoleLogs.map((line, i) => (
                                                <div key={i} className="border-b border-slate-800/50 last:border-0 pb-1">
                                                    {line}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Env Snapshot */}
                                <div>
                                    <div className="text-[10px] font-bold text-slate-500 uppercase mb-2">Environment Snapshot</div>
                                    <div className="bg-slate-900 p-3 rounded border border-slate-800 grid grid-cols-2 gap-2">
                                        {selectedLog.envSnapshot && Object.entries(selectedLog.envSnapshot).map(([k, v]) => (
                                            <div key={k} className="text-[10px] font-mono flex flex-col">
                                                <span className="text-purple-300 font-bold">{k}</span>
                                                <span className="text-slate-500 truncate" title={v}>******</span>
                                            </div>
                                        ))}
                                        {(!selectedLog.envSnapshot || Object.keys(selectedLog.envSnapshot).length === 0) && (
                                            <span className="text-[10px] text-slate-600 italic">No env vars</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-slate-600">
                            <Icons.Bug />
                            <span className="text-sm mt-2">Select a log entry to view details</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};