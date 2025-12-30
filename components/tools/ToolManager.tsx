import React, { useState, useEffect, useCallback } from 'react';
import Editor from '@monaco-editor/react';
import { useConfigStore } from '../../stores/useConfigStore';
import { UserTool } from '../../types';
import { Icons } from '../Icon';

interface ToolManagerProps {
    onClose: () => void;
}

const DEFAULT_TOOL_JSON = JSON.stringify({
    "name": "new_tool",
    "description": "Description of what this tool does",
    "parameters": {
        "type": "OBJECT",
        "properties": {
            "arg1": { "type": "STRING", "description": "Argument description" }
        },
        "required": ["arg1"]
    }
}, null, 2);

const DEFAULT_TOOL_IMPL = `// JavaScript Implementation
// Available globals: args, env, console
// Async/Await is supported.
// Return value must be JSON serializable (string, number, object).

try {
  // const apiKey = env.MY_API_KEY;
  console.log("Tool running with args:", args);
  return "Hello " + args.arg1;
} catch (error) {
  throw new Error("Tool failed: " + error.message);
}`;

export const ToolManager: React.FC<ToolManagerProps> = ({ onClose }) => {
    const { tools, addTool, updateTool, deleteTool } = useConfigStore();
    const [selectedToolId, setSelectedToolId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState<'code' | 'schema' | 'test'>('code');

    // Editing State
    const [editName, setEditName] = useState('');
    const [editDesc, setEditDesc] = useState('');
    const [editImpl, setEditImpl] = useState('');
    const [editSchema, setEditSchema] = useState('');
    const [editAuto, setEditAuto] = useState(false);
    const [isDirty, setIsDirty] = useState(false);

    // Test State
    const [testArgs, setTestArgs] = useState('{\n  "arg1": "world"\n}');
    const [testResult, setTestResult] = useState<string>('');
    const [testLogs, setTestLogs] = useState<string[]>([]);
    const [testStatus, setTestStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle');

    // Load tool into editor
    useEffect(() => {
        if (selectedToolId) {
            const tool = tools.find(t => t.id === selectedToolId);
            if (tool) {
                setEditName(tool.definition.name);
                setEditDesc(tool.definition.description || '');
                setEditImpl(tool.implementation || '');
                setEditSchema(JSON.stringify(tool.definition, null, 2));
                setEditAuto(tool.autoExecute || false);
                setIsDirty(false);
                setTestResult('');
                setTestLogs([]);
                setTestStatus('idle');
            }
        } else {
            // Reset if no tool selected (or creating new not yet implemented as separate state)
        }
    }, [selectedToolId, tools]);

    const handleCreateTool = () => {
        const newTool: UserTool = {
            id: crypto.randomUUID(),
            active: true,
            definition: JSON.parse(DEFAULT_TOOL_JSON),
            implementation: DEFAULT_TOOL_IMPL,
            autoExecute: false
        };
        addTool(newTool);
        setSelectedToolId(newTool.id);
        setActiveTab('code');
    };

    const handleSave = () => {
        if (!selectedToolId) return;
        try {
            const definition = JSON.parse(editSchema);
            // Sync top-level fields
            definition.name = editName;
            definition.description = editDesc;

            updateTool(selectedToolId, {
                definition,
                implementation: editImpl,
                autoExecute: editAuto
            });
            setIsDirty(false);
            // Refresh schema text to ensure sync
            setEditSchema(JSON.stringify(definition, null, 2));
        } catch (e: any) {
            alert("Error saving tool: Invalid JSON Schema. " + e.message);
        }
    };

    const handleDelete = (id: string) => {
        if (confirm("Are you sure you want to delete this tool?")) {
            deleteTool(id);
            if (selectedToolId === id) setSelectedToolId(null);
        }
    };

    const runTest = async () => {
        setTestStatus('running');
        setTestLogs([]);
        setTestResult('');
        
        const env = useConfigStore.getState().env;
        const logs: string[] = [];
        
        const mockConsole = {
            log: (...args: any[]) => logs.push(args.map(String).join(' ')),
            error: (...args: any[]) => logs.push('[ERROR] ' + args.map(String).join(' ')),
            warn: (...args: any[]) => logs.push('[WARN] ' + args.map(String).join(' ')),
            info: (...args: any[]) => logs.push('[INFO] ' + args.map(String).join(' ')),
        };

        try {
            let parsedArgs = {};
            try {
                parsedArgs = JSON.parse(testArgs);
            } catch (e) {
                throw new Error("Invalid JSON in Arguments");
            }

            const func = new Function('args', 'env', 'console', `return (async () => { ${editImpl} })()`);
            const start = performance.now();
            const result = await func(parsedArgs, env, mockConsole);
            const duration = performance.now() - start;

            setTestResult(JSON.stringify(result, null, 2));
            logs.push(`[SYSTEM] Execution finished in ${duration.toFixed(2)}ms`);
            setTestLogs(logs);
            setTestStatus('success');
        } catch (e: any) {
            logs.push(`[SYSTEM ERROR] ${e.message}`);
            setTestLogs(logs);
            setTestStatus('error');
            setTestResult(e.message);
        }
    };

    const filteredTools = tools.filter(t => 
        t.definition.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        (t.definition.description || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-sm flex items-center justify-center p-4 md:p-8 animate-fadeIn">
            <div className="w-full max-w-7xl h-[85vh] bg-[#1e1e1e] border border-slate-700 rounded-xl shadow-2xl flex overflow-hidden flex-col md:flex-row relative">
                
                {/* Close Button */}
                <button 
                    onClick={onClose} 
                    className="absolute top-4 right-4 z-50 p-2 bg-slate-800 rounded-full hover:bg-red-600 text-white transition-colors border border-slate-700 shadow-lg"
                >
                    <Icons.X />
                </button>

                {/* Sidebar */}
                <div className="w-full md:w-72 border-r border-slate-800 flex flex-col bg-[#252526]">
                    <div className="p-4 border-b border-slate-800">
                        <h2 className="text-sm font-bold text-slate-200 flex items-center gap-2 mb-4">
                            <Icons.Tool /> Tool Manager
                        </h2>
                        <div className="relative">
                            <input 
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search tools..."
                                className="w-full bg-[#3c3c3c] text-white text-xs px-3 py-2 rounded border border-[#3c3c3c] focus:border-blue-500 outline-none"
                            />
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
                        {filteredTools.map(t => (
                            <div 
                                key={t.id}
                                onClick={() => setSelectedToolId(t.id)}
                                className={`p-3 rounded cursor-pointer group flex items-center justify-between transition-all ${
                                    selectedToolId === t.id 
                                    ? 'bg-[#37373d] text-white border-l-2 border-blue-500' 
                                    : 'text-slate-400 hover:bg-[#2a2d2e] hover:text-slate-200'
                                }`}
                            >
                                <div className="min-w-0 flex-1 mr-2">
                                    <div className="font-bold text-xs truncate flex items-center gap-2">
                                        {t.definition.name}
                                        {t.autoExecute && <span className="text-[8px] bg-purple-900/50 text-purple-300 px-1 py-0.5 rounded border border-purple-500/30">AUTO</span>}
                                    </div>
                                    <div className="text-[10px] opacity-60 truncate">{t.definition.description || 'No description'}</div>
                                </div>
                                {selectedToolId !== t.id && (
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); handleDelete(t.id); }}
                                        className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-400"
                                    >
                                        <Icons.Trash />
                                    </button>
                                )}
                            </div>
                        ))}
                        {filteredTools.length === 0 && (
                            <div className="text-center py-8 text-xs text-slate-600">No tools found</div>
                        )}
                    </div>
                    <div className="p-4 border-t border-slate-800 bg-[#252526]">
                        <button 
                            onClick={handleCreateTool}
                            className="w-full bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold py-2 rounded flex items-center justify-center gap-2 transition-colors"
                        >
                            <Icons.Plus /> Create New Tool
                        </button>
                    </div>
                </div>

                {/* Editor Area */}
                <div className="flex-1 flex flex-col min-w-0 bg-[#1e1e1e]">
                    {selectedToolId ? (
                        <>
                            {/* Editor Header */}
                            <div className="h-16 border-b border-slate-800 flex items-center justify-between px-6 bg-[#1e1e1e] shrink-0">
                                <div className="flex-1 mr-8">
                                    <div className="flex items-center gap-4">
                                        <input 
                                            value={editName}
                                            onChange={(e) => { setEditName(e.target.value); setIsDirty(true); }}
                                            className="bg-transparent text-sm font-bold text-white outline-none border-b border-transparent focus:border-blue-500 placeholder:text-slate-600 w-48"
                                            placeholder="Tool Name"
                                        />
                                        <div className="h-4 w-px bg-slate-700"></div>
                                        <input 
                                            value={editDesc}
                                            onChange={(e) => { setEditDesc(e.target.value); setIsDirty(true); }}
                                            className="bg-transparent text-xs text-slate-400 outline-none border-b border-transparent focus:border-blue-500 placeholder:text-slate-600 flex-1 min-w-0"
                                            placeholder="Short description of the tool..."
                                        />
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <label className="flex items-center gap-2 cursor-pointer select-none">
                                        <input 
                                            type="checkbox" 
                                            checked={editAuto}
                                            onChange={(e) => { setEditAuto(e.target.checked); setIsDirty(true); }}
                                            className="accent-purple-500"
                                        />
                                        <span className={`text-xs font-bold ${editAuto ? 'text-purple-400' : 'text-slate-500'}`}>Auto-Run</span>
                                    </label>
                                    <button 
                                        onClick={handleSave}
                                        disabled={!isDirty}
                                        className={`px-4 py-1.5 rounded text-xs font-bold flex items-center gap-2 transition-all ${
                                            isDirty 
                                            ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/20' 
                                            : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                                        }`}
                                    >
                                        <Icons.Save /> Save
                                    </button>
                                    <button 
                                        onClick={() => handleDelete(selectedToolId)}
                                        className="p-2 text-slate-500 hover:text-red-400 hover:bg-slate-800 rounded"
                                    >
                                        <Icons.Trash />
                                    </button>
                                </div>
                            </div>

                            {/* Tabs */}
                            <div className="flex bg-[#252526] border-b border-slate-800 px-6">
                                {[
                                    { id: 'code', label: 'Implementation', icon: <Icons.Terminal /> },
                                    { id: 'schema', label: 'Configuration (JSON)', icon: <Icons.Settings /> },
                                    { id: 'test', label: 'Test Lab', icon: <Icons.Bug /> }
                                ].map(tab => (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id as any)}
                                        className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition-colors ${
                                            activeTab === tab.id 
                                            ? 'border-blue-500 text-white bg-[#1e1e1e]' 
                                            : 'border-transparent text-slate-500 hover:text-slate-300'
                                        }`}
                                    >
                                        {tab.icon} {tab.label}
                                    </button>
                                ))}
                            </div>

                            {/* Tab Content */}
                            <div className="flex-1 relative overflow-hidden">
                                {activeTab === 'code' && (
                                    <Editor 
                                        height="100%" 
                                        defaultLanguage="javascript" 
                                        theme="vs-dark" 
                                        value={editImpl}
                                        onChange={(val) => { setEditImpl(val || ''); setIsDirty(true); }}
                                        options={{ 
                                            minimap: { enabled: false }, 
                                            fontSize: 13, 
                                            fontFamily: "'JetBrains Mono', monospace",
                                            padding: { top: 16 }
                                        }}
                                    />
                                )}
                                
                                {activeTab === 'schema' && (
                                    <Editor 
                                        height="100%" 
                                        defaultLanguage="json" 
                                        theme="vs-dark" 
                                        value={editSchema}
                                        onChange={(val) => { setEditSchema(val || ''); setIsDirty(true); }}
                                        options={{ 
                                            minimap: { enabled: false }, 
                                            fontSize: 13, 
                                            fontFamily: "'JetBrains Mono', monospace",
                                            padding: { top: 16 }
                                        }}
                                    />
                                )}

                                {activeTab === 'test' && (
                                    <div className="flex h-full">
                                        {/* Test Input */}
                                        <div className="w-1/2 flex flex-col border-r border-slate-800">
                                            <div className="h-8 bg-[#252526] flex items-center justify-between px-3 border-b border-slate-800">
                                                <span className="text-[10px] font-bold text-slate-400 uppercase">Input Arguments (JSON)</span>
                                                <button 
                                                    onClick={runTest} 
                                                    className="bg-green-600 hover:bg-green-500 text-white text-[10px] px-2 py-0.5 rounded font-bold flex items-center gap-1"
                                                >
                                                    <Icons.Play /> Run
                                                </button>
                                            </div>
                                            <div className="flex-1 relative">
                                                <Editor 
                                                    height="100%" 
                                                    defaultLanguage="json" 
                                                    theme="vs-dark" 
                                                    value={testArgs}
                                                    onChange={(val) => setTestArgs(val || '')}
                                                    options={{ minimap: { enabled: false }, fontSize: 12, lineNumbers: 'off' }}
                                                />
                                            </div>
                                        </div>

                                        {/* Test Output */}
                                        <div className="w-1/2 flex flex-col bg-[#1e1e1e]">
                                             <div className="h-1/2 flex flex-col border-b border-slate-800">
                                                 <div className="h-8 bg-[#252526] flex items-center px-3 border-b border-slate-800">
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase">Return Value</span>
                                                    <span className={`ml-auto text-[10px] font-bold uppercase ${testStatus === 'error' ? 'text-red-400' : 'text-green-400'}`}>{testStatus}</span>
                                                 </div>
                                                 <div className="flex-1 overflow-auto p-2 bg-[#1e1e1e] custom-scrollbar">
                                                     <pre className={`text-xs font-mono whitespace-pre-wrap ${testStatus === 'error' ? 'text-red-300' : 'text-green-300'}`}>
                                                        {testResult || (testStatus === 'running' ? 'Running...' : '// No output')}
                                                     </pre>
                                                 </div>
                                             </div>
                                             <div className="h-1/2 flex flex-col">
                                                 <div className="h-8 bg-[#252526] flex items-center px-3 border-b border-slate-800">
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase">Console Logs</span>
                                                 </div>
                                                 <div className="flex-1 overflow-auto p-2 bg-black custom-scrollbar">
                                                     {testLogs.map((log, i) => (
                                                         <div key={i} className="text-[11px] font-mono text-slate-400 border-b border-slate-900 pb-0.5 mb-0.5 last:border-0">{log}</div>
                                                     ))}
                                                     {testLogs.length === 0 && <div className="text-[11px] text-slate-600 italic">// No logs</div>}
                                                 </div>
                                             </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-slate-600 select-none">
                            <div className="scale-150 mb-4 opacity-50"><Icons.Tool /></div>
                            <p className="text-sm font-medium">Select a tool to edit</p>
                            <p className="text-xs opacity-60 mt-1">or create a new one</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};