import React, { useEffect, useRef, useState } from 'react';
import { useFileStore } from '../../stores/useFileStore';
import { useLogStore } from '../../stores/useLogStore'; // 确保导入这个
import { buildImportMap } from '../../utils/compiler';
import { Icons } from '../Icon';

type ViewMode = 'responsive' | 'mobile' | 'tablet' | 'desktop';

export const PreviewPanel: React.FC = () => {
    const files = useFileStore(s => s.files);
    const manualEntryPoint = useFileStore(s => s.entryPoint);
    
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const [key, setKey] = useState(0); 

    const [viewMode, setViewMode] = useState<ViewMode>('responsive');
    const [isFullScreen, setIsFullScreen] = useState(false);
    const [currentEntry, setCurrentEntry] = useState<string>(''); 

    useEffect(() => {
        if (!iframeRef.current || files.length === 0) return;

        const run = async () => {
            const { imports, css } = buildImportMap(files);

            let entryPath: string | null = null;
            if (manualEntryPoint) {
                entryPath = manualEntryPoint.replace(/^\/+/, '');
            } 
            
            if (!entryPath) {
                let entryFile = files.find(f => 
                    f.path.includes('src/index.tsx') || 
                    f.path.includes('src/main.tsx') ||
                    f.path.includes('src/main.ts')
                );
                
                if (!entryFile) {
                    entryFile = files.find(f => f.path.includes('App.tsx'));
                }
                
                if (entryFile) {
                    entryPath = entryFile.path.replace(/^\/+/, '');
                }
            }

            setCurrentEntry(entryPath || 'Not Found');

            if (!entryPath) {
                if (iframeRef.current) iframeRef.current.srcdoc = "<html><body style='font-family:sans-serif;color:#666;padding:20px'><h3>No entry file found</h3><p>Please select a file in the explorer (e.g. index.tsx) and click the <strong>Play</strong> icon to set it as the entry point.</p></body></html>";
                return;
            }

            // 控制台拦截脚本
            const consoleScript = `
                <script>
                    (function() {
                        const originalLog = console.log;
                        const originalWarn = console.warn;
                        const originalError = console.error;

                        function sendToParent(type, args) {
                            try {
                                const content = args.map(arg => {
                                    if (arg instanceof Error) return arg.message + '\\n' + arg.stack;
                                    if (typeof arg === 'object') {
                                        try { return JSON.parse(JSON.stringify(arg)); } catch { return String(arg); }
                                    }
                                    return String(arg);
                                });
                                window.parent.postMessage({ type: 'PREVIEW_CONSOLE', level: type, content }, '*');
                            } catch (e) {
                                // Ignore serialization errors
                            }
                        }

                        console.log = function(...args) {
                            originalLog.apply(console, args);
                            sendToParent('info', args);
                        };
                        console.warn = function(...args) {
                            originalWarn.apply(console, args);
                            sendToParent('warn', args);
                        };
                        console.error = function(...args) {
                            originalError.apply(console, args);
                            sendToParent('error', args);
                        };
                        
                        window.onerror = function(msg, url, line, col, error) {
                            sendToParent('error', [msg]);
                            return false;
                        };
                    })();
                </script>
            `;

            const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    ${consoleScript}
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        html, body { margin: 0; padding: 0; height: 100%; background: #fff; }
        ${css}
        #error-overlay {
            display: none; position: fixed; top: 0; left: 0; right: 0; padding: 12px;
            background: #ef4444; color: white; font-family: monospace; font-size: 12px; z-index: 9999;
            white-space: pre-wrap;
        }
    </style>
    <script type="importmap">
    { "imports": ${JSON.stringify(imports, null, 2)} }
    </script>
    <script>
        window.addEventListener('error', (e) => {
             const box = document.getElementById('error-overlay');
             box.style.display = 'block';
             box.innerText = 'Runtime Error: ' + e.message;
        });
        window.addEventListener('unhandledrejection', (e) => {
             const box = document.getElementById('error-overlay');
             box.style.display = 'block';
             box.innerText = 'Async Error: ' + (e.reason ? e.reason.message || e.reason : 'Unknown');
        });
    </script>
</head>
<body>
    <div id="error-overlay"></div>
    <div id="root"></div>
    <div id="app"></div>
    <script type="module">
        import('${entryPath}')
            .catch(err => {
                console.error(err);
                const box = document.getElementById('error-overlay');
                box.style.display = 'block';
                box.innerHTML = '<strong>Failed to load entry: ${entryPath}</strong><br/>' + err.message;
            });
    </script>
</body>
</html>`;

            if (iframeRef.current) {
                iframeRef.current.srcdoc = html;
            }
        };

        run();
    }, [files, key, manualEntryPoint]);

    const getContainerStyle = () => {
        const base = "transition-all duration-300 ease-in-out shadow-2xl border border-slate-700 overflow-hidden bg-white";
        switch (viewMode) {
            case 'mobile': return `${base} w-[375px] h-[667px] rounded-[2rem] border-[8px] border-slate-800`;
            case 'tablet': return `${base} w-[768px] h-[1024px] max-h-[90%] rounded-xl border-[4px] border-slate-800`;
            case 'desktop': return `${base} w-[1024px] h-[768px] max-h-[90%] rounded-lg border border-slate-600`;
            default: return "w-full h-full bg-white";
        }
    };

    return (
        <div className={`${isFullScreen ? 'fixed inset-0 z-50' : 'relative h-full w-full'} flex flex-col bg-[#0c0c0e] animate-fadeIn`}>
            <div className="h-10 border-b border-slate-800 bg-[#18181b] flex items-center justify-between px-4 shrink-0 shadow-sm z-20">
                <div className="flex items-center gap-3">
                    <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider bg-emerald-900/20 px-2 py-0.5 rounded border border-emerald-900/50 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                        Live Preview
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono hidden md:inline-block border-l border-slate-700 pl-3 ml-1" title="Current Entry Point">
                        Entry: <span className="text-slate-300">{currentEntry}</span>
                    </span>
                </div>
                <div className="flex items-center bg-slate-900 rounded-lg p-0.5 border border-slate-800">
                    <button onClick={() => setViewMode('mobile')} className={`p-1.5 rounded transition-all ${viewMode === 'mobile' ? 'bg-slate-700 text-blue-400' : 'text-slate-500 hover:text-white'}`}><Icons.Smartphone /></button>
                    <button onClick={() => setViewMode('tablet')} className={`p-1.5 rounded transition-all ${viewMode === 'tablet' ? 'bg-slate-700 text-blue-400' : 'text-slate-500 hover:text-white'}`}><Icons.Tablet /></button>
                    <button onClick={() => setViewMode('desktop')} className={`p-1.5 rounded transition-all hidden md:block ${viewMode === 'desktop' ? 'bg-slate-700 text-blue-400' : 'text-slate-500 hover:text-white'}`}><Icons.Monitor /></button>
                    <div className="w-px h-3 bg-slate-700 mx-1"></div>
                    <button onClick={() => setViewMode('responsive')} className={`px-2 py-1 text-[10px] font-bold uppercase rounded transition-all ${viewMode === 'responsive' ? 'bg-slate-700 text-blue-400' : 'text-slate-500 hover:text-white'}`}>Auto</button>
                </div>
                <div className="flex items-center gap-2">
                    <ConsoleToggleBtn /> 
                    <button onClick={() => setKey(k => k + 1)} className="p-1.5 text-slate-500 hover:text-white rounded hover:bg-slate-800 transition-colors" title="Reload"><Icons.Activity /></button>
                    <button onClick={() => setIsFullScreen(!isFullScreen)} className={`p-1.5 rounded hover:bg-slate-800 transition-colors ${isFullScreen ? 'text-green-400' : 'text-slate-500 hover:text-white'}`}>{isFullScreen ? <Icons.Minimize /> : <Icons.Maximize />}</button>
                </div>
            </div>
            <div className={`flex-1 relative overflow-hidden flex items-center justify-center transition-colors duration-500 ${viewMode === 'responsive' ? 'bg-white' : 'bg-[#0c0c0e] pattern-grid'}`}>
                <div className={getContainerStyle()} style={{ transitionProperty: 'width, height, border-radius' }}>
                    <iframe ref={iframeRef} className="w-full h-full border-none bg-white" title="Preview" sandbox="allow-scripts allow-same-origin allow-forms allow-modals" />
                </div>
            </div>
            <style>{` .pattern-grid { background-image: radial-gradient(#333 1px, transparent 1px); background-size: 20px 20px; } `}</style>
        </div>
    );
};

// 【关键修复】拆分选择器，避免返回新对象导致无限重渲染
const ConsoleToggleBtn = () => {
    const toggleConsole = useLogStore(s => s.toggleConsole);
    const isConsoleOpen = useLogStore(s => s.isConsoleOpen);
    const hasLogs = useLogStore(s => s.logs.length > 0); // 只监听长度变化，性能更好

    return (
        <button 
            onClick={toggleConsole} 
            className={`p-1.5 rounded hover:bg-slate-800 transition-colors flex items-center gap-1 ${isConsoleOpen ? 'text-blue-400 bg-blue-900/20' : 'text-slate-500 hover:text-white'}`}
            title="Toggle Console"
        >
            <Icons.Terminal />
            {hasLogs && !isConsoleOpen && <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>}
        </button>
    );
};