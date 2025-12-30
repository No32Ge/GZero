// src/config/templates.ts
import { VirtualFile } from '../types';

const createFile = (path: string, content: string, language?: string): VirtualFile => ({
    id: crypto.randomUUID(),
    path,
    name: path.split('/').pop() || path,
    content,
    language,
    lastModified: Date.now(),
    inContext: true
});

export const INITIAL_FILES: VirtualFile[] = [
    createFile('package.json', JSON.stringify({
        "name": "gbrain-app",
        "private": true,
        "version": "0.0.0",
        "type": "module",
        "dependencies": { 
            "react": "^19.2.0", 
            "react-dom": "^19.2.0",
            "lucide-react": "^0.263.1"
        }
    }, null, 2), 'json'),
    
    createFile('index.html', `<!doctype html>
<html lang="en">
  <head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /><title>App</title></head>
  <body><div id="root"></div><script type="module" src="/src/index.tsx"></script></body>
</html>`, 'html'),

    createFile('src/index.tsx', `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><App /></React.StrictMode>
);`, 'typescript'),

    createFile('src/App.tsx', `import React from 'react';
import { Brain } from 'lucide-react';

export default function App() {
  return (
    <div className="flex flex-col items-center justify-center h-screen bg-slate-950 text-white">
      <Brain className="w-16 h-16 text-blue-500 mb-4 animate-pulse" />
      <h1 className="text-2xl font-bold">Ge Brain Ready</h1>
      <p className="text-slate-400 mt-2">Edit src/App.tsx to start building.</p>
    </div>
  );
}`, 'typescript'),

    createFile('src/index.css', `@tailwind base;\n@tailwind components;\n@tailwind utilities;`, 'css')
];