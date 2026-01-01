
import React, { useEffect, useRef, useState } from 'react';
import { useFileStore } from '../../stores/useFileStore';
import { Icons } from '../Icon';

export const PreviewPanel: React.FC = () => {
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const [isSWReady, setIsSWReady] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);

    useEffect(() => {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js', { scope: '/preview/' })
                .then((registration) => {
                    const sw = registration.installing || registration.waiting || registration.active;
                    if (sw) {
                        if (sw.state === 'activated') setIsSWReady(true);
                        sw.addEventListener('statechange', (e) => {
                            if ((e.target as any).state === 'activated') setIsSWReady(true);
                        });
                    }
                })
                .catch(err => console.error('SW Registration failed:', err));

            const messageHandler = (event: MessageEvent) => {
                if (event.data && event.data.type === 'SW_REQUEST_FILE') {
                    handleSWRequest(event.data.path, event.data.requestId, event.source as ServiceWorker);
                }
            };
            navigator.serviceWorker.addEventListener('message', messageHandler);

            return () => navigator.serviceWorker.removeEventListener('message', messageHandler);
        }
    }, []);

    const handleSWRequest = (reqPath: string, requestId: string, swPort: ServiceWorker | null) => {
        const store = useFileStore.getState();
        // 使用 Store 中增强的查找逻辑 (支持自动补全后缀)
        const targetFile = store.getFileByPath(reqPath);

        if (targetFile) {
            swPort?.postMessage({
                type: 'SW_RESPONSE_FILE',
                requestId,
                found: true,
                content: targetFile.content,
                path: targetFile.path // [新增] 返回真实路径 (包含扩展名)
            });
        } else {
            console.warn(`[VFS 404] Request: ${reqPath}`);
            swPort?.postMessage({
                type: 'SW_RESPONSE_FILE',
                requestId,
                found: false,
                error: 'File not found'
            });
        }
    };

    const handleRefresh = () => {
        if (iframeRef.current) {
            iframeRef.current.src = 'about:blank';
            setTimeout(() => {
                if (iframeRef.current) iframeRef.current.src = '/preview/index.html';
            }, 50);
        }
        setRefreshKey(k => k + 1);
    };

    return (
        <div className="flex flex-col h-full bg-[#0c0c0e]">
            <div className="h-10 border-b border-slate-800 bg-[#18181b] flex items-center justify-between px-4 shrink-0">
                <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${isSWReady ? 'bg-green-500' : 'bg-yellow-500 animate-pulse'}`}></span>
                    <span className="text-xs text-slate-400 font-mono">
                        {isSWReady ? 'Kernel Ready' : 'Booting Service Worker...'}
                    </span>
                </div>
                <button onClick={handleRefresh} className="p-1.5 text-slate-500 hover:text-white rounded hover:bg-slate-800 transition-colors">
                    <Icons.Activity />
                </button>
            </div>
            <div className="flex-1 relative bg-white">
                {isSWReady ? (
                    <iframe 
                        ref={iframeRef}
                        key={refreshKey}
                        src="/preview/index.html"
                        className="w-full h-full border-none"
                        title="Preview"
                        sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups"
                    />
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-2">
                        <Icons.Activity />
                        <span className="text-xs">Initializing Runtime Environment...</span>
                    </div>
                )}
            </div>
        </div>
    );
};
