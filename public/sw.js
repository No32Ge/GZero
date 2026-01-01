
/* eslint-disable no-restricted-globals */
importScripts('https://cdnjs.cloudflare.com/ajax/libs/babel-standalone/7.23.10/babel.min.js');

const PREVIEW_SCOPE = '/preview/';

// ----------------------------------------------------------------------
// 1. Error Overlay
// ----------------------------------------------------------------------
const generateErrorOverlay = (message, sourcePath) => {
    return `(function() {
        console.error("[Build Error] " + ${JSON.stringify(message)});
        let overlay = document.getElementById('gbrain-error-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'gbrain-error-overlay';
            Object.assign(overlay.style, {
                position: 'fixed', top: '0', left: '0', right: '0', bottom: '0',
                backgroundColor: 'rgba(0, 0, 0, 0.85)', color: '#ff5555',
                zIndex: '99999', padding: '20px', overflow: 'auto',
                fontFamily: 'monospace', fontSize: '14px', whiteSpace: 'pre-wrap'
            });
            document.body.appendChild(overlay);
        }
        overlay.innerHTML = '<h3 style="color: #ff5555; border-bottom: 1px solid #ff5555; padding-bottom: 10px;">Build Error</h3>' +
            '<div style="color: #ccc; margin-bottom: 10px;">File: <strong>' + ${JSON.stringify(sourcePath)} + '</strong></div>' +
            '<div>' + ${JSON.stringify(message).replace(/</g, '&lt;')} + '</div>';
    })();`;
};

// ----------------------------------------------------------------------
// 2. Communication Logic
// ----------------------------------------------------------------------
const pendingRequests = new Map();

const fetchFileFromMainThread = (path) => {
    return new Promise((resolve, reject) => {
        const id = (typeof crypto.randomUUID === 'function') 
            ? crypto.randomUUID() 
            : Math.random().toString(36).substring(2) + Date.now().toString(36);

        pendingRequests.set(id, { resolve, reject });

        self.clients.matchAll({ includeUncontrolled: true, type: 'window' }).then((clients) => {
            if (clients && clients.length) {
                clients[0].postMessage({ type: 'SW_REQUEST_FILE', path, requestId: id });
                setTimeout(() => {
                    if (pendingRequests.has(id)) {
                        pendingRequests.get(id).reject(new Error(`Timeout awaiting file: ${path}`));
                        pendingRequests.delete(id);
                    }
                }, 5000);
            } else {
                reject(new Error('No active window clients found'));
            }
        });
    });
};

self.addEventListener('message', (event) => {
    const { type, requestId, content, path, found, error } = event.data; // [修改] 接收 path
    if (type === 'SW_RESPONSE_FILE' && pendingRequests.has(requestId)) {
        const { resolve, reject } = pendingRequests.get(requestId);
        if (found) resolve({ content, path }); // [修改] resolve 对象
        else reject(new Error(error || 'File not found'));
        pendingRequests.delete(requestId);
    }
});

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

// ----------------------------------------------------------------------
// 3. Compiler & Interceptor
// ----------------------------------------------------------------------

const transformImports = (code) => {
    return code.replace(/((?:import|export)\s+[\s\S]*?from\s+['"])([^'"]+)(['"])/g, (match, prefix, path, suffix) => {
        if (path.startsWith('http') || path.startsWith('//')) return match;
        if (path.startsWith('.') || path.startsWith('/')) return match;
        return `${prefix}https://esm.sh/${path}${suffix}`;
    });
};

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    if (!url.pathname.startsWith(PREVIEW_SCOPE)) return;

    // A. 入口 HTML
    if (url.pathname === PREVIEW_SCOPE || url.pathname === PREVIEW_SCOPE + 'index.html') {
        const html = `<!DOCTYPE html><html><head><meta charset="UTF-8" />
<style>body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }</style>
<script src="https://cdn.tailwindcss.com"></script>
<script>window.addEventListener('error', (e) => { const overlay = document.createElement('div'); Object.assign(overlay.style, { position: 'fixed', top: '0', left: '0', right: '0', padding: '12px', backgroundColor: '#ef4444', color: 'white', fontFamily: 'monospace', fontSize: '12px', zIndex: '99999' }); overlay.innerText = 'Runtime Error: ' + e.message; document.body.appendChild(overlay); });</script>
</head><body><div id="root"></div><script type="module">import '/preview/src/index.tsx';</script></body></html>`;
        event.respondWith(new Response(html, { headers: { 'Content-Type': 'text/html' } }));
        return;
    }

    // B. 资源处理
    const vfsPath = url.pathname.replace(PREVIEW_SCOPE, '/').replace('//', '/');

    event.respondWith(async function() {
        try {
            // [修改] 解构出 resolvedPath
            const { content: rawContent, path: resolvedPath } = await fetchFileFromMainThread(vfsPath);

            // CSS
            if (resolvedPath.endsWith('.css')) {
                const js = `const style = document.createElement('style'); style.setAttribute('data-file', '${resolvedPath}'); style.textContent = ${JSON.stringify(rawContent)}; document.head.appendChild(style);`;
                return new Response(js, { headers: { 'Content-Type': 'application/javascript' } });
            }

            // JSON
            if (resolvedPath.endsWith('.json')) {
                return new Response(rawContent, { headers: { 'Content-Type': 'application/json' } });
            }

            // TS/JS -> Babel Compile
            // [修改] 使用 resolvedPath 判断文件类型 (解决无后缀 import 导致的 text/plain 问题)
            if (/\.(t|j)sx?$/.test(resolvedPath)) {
                try {
                    const compiled = self.Babel.transform(rawContent, {
                        presets: ['react', 'typescript'],
                        filename: resolvedPath,
                        retainLines: true
                    }).code;
                    const finalCode = transformImports(compiled);
                    return new Response(finalCode, { headers: { 'Content-Type': 'application/javascript' } });
                } catch (compileError) {
                    const errorScript = generateErrorOverlay(compileError.message, resolvedPath);
                    return new Response(errorScript, { headers: { 'Content-Type': 'application/javascript' } });
                }
            }

            return new Response(rawContent, { headers: { 'Content-Type': 'text/plain' } });

        } catch (err) {
            const errorScript = generateErrorOverlay(`Module not found: ${vfsPath}`, vfsPath);
            return new Response(errorScript, { headers: { 'Content-Type': 'application/javascript' }, status: 200 });
        }
    }());
});
