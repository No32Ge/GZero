import React, { useRef, useState, useMemo } from 'react';
import { useFileStore } from '../../stores/useFileStore';
import { useBrain } from '../../contexts/BrainContext';
import { FileExplorer } from './FileExplorer';
import { CodeEditor } from './CodeEditor';
import { normalizePath, optimizeImportedFiles } from '../../utils/fileSystem';
import { extractDependencies, transformToSandpackFiles, detectTemplate } from '../../utils/sandpackUtils';
import { PreviewPanel } from './PreviewPanel';
import { VirtualFile } from '../../types';
import { Icons } from '../Icon';
// [修正] 导入 DirectoryHandle 以支持本地双向同步
import { readDirectoryRecursive, getDirectoryHandleByPath } from '../../utils/localFileSystem';
// @ts-ignore
import JSZip from 'jszip';

const TEMPLATES: any = {
    react: [{ path: 'package.json', content: '{}', language: 'json' }, { path: 'src/App.tsx', content: '', language: 'typescript' }],
    vue: [{ path: 'package.json', content: '{}', language: 'json' }],
    vanilla: [{ path: 'index.html', content: '', language: 'html' }]
};

export const FileWorkspace: React.FC = () => {
    const { config } = useBrain();

    // File Store Actions
    const files = useFileStore(s => s.files);
    const activeFileId = useFileStore(s => s.activeFileId);
    const setActiveFileId = useFileStore(s => s.setActiveFileId);
    const setFiles = useFileStore(s => s.setFiles);
    const addFile = useFileStore(s => s.addFile);
    const updateFileContent = useFileStore(s => s.updateFileContent);
    const deleteFile = useFileStore(s => s.deleteFile);
    const toggleFileContext = useFileStore(s => s.toggleFileContext);
    const getFileById = useFileStore(s => s.getFileById);

    // Local Mode
    const mountLocalProject = useFileStore(s => s.mountLocalProject);
    const isLocalMode = useFileStore(s => s.isLocalMode);
    const projectHandle = useFileStore(s => s.projectHandle);
    const fileHandles = useFileStore(s => s.fileHandles);

    const uploadInputRef = useRef<HTMLInputElement>(null);
    const [notification, setNotification] = useState<{ message: string, type: 'success' | 'error' } | null>(null);
    const [activeTab, setActiveTab] = useState<'code' | 'preview'>('code');

    const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
        setNotification({ message, type });
        setTimeout(() => setNotification(null), 3000);
    };

    const activeFile = getFileById(activeFileId || '') || null;

    // --- Actions ---

    const handleSaveFile = async (id: string, content: string) => {
        updateFileContent(id, content);
        
        if (isLocalMode) {
             const file = getFileById(id);
             if (!file) return;
             const cleanPath = normalizePath(file.path || file.name);
             const handle = fileHandles.get(cleanPath);
             
             if (handle) {
                 try {
                     const writable = await handle.createWritable();
                     await writable.write(content);
                     await writable.close();
                 } catch (e: any) {
                     console.error("Save to disk failed", e);
                     showNotification("Failed to save to disk: " + e.message, "error");
                 }
             } else {
                 console.warn("No handle found for", cleanPath);
             }
        }
    };

    const handleToggleContext = (id: string) => toggleFileContext(id);

    // [强化] 支持双向同步（创建文件）
    const handleCreateFile = async (inputPath: string) => {
        if (!inputPath) return;
        const cleanPath = normalizePath(inputPath);
        const fileName = cleanPath.split('/').pop() || cleanPath;

        if (files.some(f => normalizePath(f.path || f.name) === cleanPath)) {
            showNotification("File already exists!", "error");
            return;
        }

        if (isLocalMode && projectHandle) {
            try {
                const newDirHandle = await getDirectoryHandleByPath(projectHandle, cleanPath, true);
                const newFileHandle = await newDirHandle.getFileHandle(fileName, { create: true });
                const writable = await newFileHandle.createWritable();
                await writable.write("");
                await writable.close();
                useFileStore.getState().registerHandle(cleanPath, newFileHandle);
            } catch (e: any) {
                showNotification("Create failed on disk: " + e.message, "error");
                return;
            }
        }

        const newFile: VirtualFile = {
            id: crypto.randomUUID(),
            path: cleanPath,
            name: fileName,
            content: '',
            lastModified: Date.now(),
            inContext: true
        };

        addFile(newFile);
        setActiveFileId(newFile.id);
        setActiveTab('code');
    };

    // [强化] 支持双向同步（删除文件）
    const handleDeleteFile = async (id: string) => {
        if (isLocalMode && !window.confirm("This will permanently delete the file from your local disk. Continue?")) {
            return;
        }

        if (isLocalMode && projectHandle) {
            const file = getFileById(id);
            if (file) {
                const cleanPath = normalizePath(file.path || file.name);
                try {
                    const dirHandle = await getDirectoryHandleByPath(projectHandle, cleanPath, false);
                    const fileName = cleanPath.split('/').pop()!;
                    await dirHandle.removeEntry(fileName);
                    useFileStore.getState().unregisterHandle(cleanPath);
                } catch (e: any) {
                    showNotification("Delete failed on disk: " + e.message, "error");
                    return;
                }
            }
        }

        deleteFile(id);
        if (activeFileId === id) setActiveFileId(null);
    };

    // [新增] UI发起的双向同步（重命名文件）
    const handleRenameFile = async (id: string, newPath: string) => {
        const file = getFileById(id);
        if (!file) return;
        
        const oldPath = normalizePath(file.path || file.name);
        const cleanNewPath = normalizePath(newPath);
        if (oldPath === cleanNewPath) return;

        if (isLocalMode && projectHandle) {
             try {
                 const oldDirHandle = await getDirectoryHandleByPath(projectHandle, oldPath, false);
                 const oldFileName = oldPath.split('/').pop()!;
                 const fileHandle = await oldDirHandle.getFileHandle(oldFileName);
                 const diskFile = await fileHandle.getFile();
                 const content = await diskFile.text();

                 const newDirHandle = await getDirectoryHandleByPath(projectHandle, cleanNewPath, true);
                 const newFileName = cleanNewPath.split('/').pop()!;
                 const newFileHandle = await newDirHandle.getFileHandle(newFileName, { create: true });
                 const writable = await newFileHandle.createWritable();
                 await writable.write(content);
                 await writable.close();

                 await oldDirHandle.removeEntry(oldFileName);
                 
                 const fileStore = useFileStore.getState();
                 fileStore.unregisterHandle(oldPath);
                 fileStore.registerHandle(cleanNewPath, newFileHandle);
             } catch (e: any) {
                 showNotification("Rename failed on disk: " + e.message, "error");
                 return;
             }
        }

        useFileStore.getState().updateFile(id, {
            path: cleanNewPath,
            name: cleanNewPath.split('/').pop() || cleanNewPath
        });
    };

    // --- Local Project ---
    const handleOpenLocalProject = async () => {
        try {
            // @ts-ignore
            const dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
            showNotification("Scanning local files...", "success");
            const { files, handles } = await readDirectoryRecursive(dirHandle);
            mountLocalProject(dirHandle, files, handles);
            showNotification(`Mounted: ${dirHandle.name}`, "success");
            setActiveTab('code');
        } catch (err: any) {
            if (err.name !== 'AbortError') {
                console.error(err);
                showNotification("Failed to open local folder", "error");
            }
        }
    };

    // --- Template & Import/Export ---
    const handleInitTemplate = (type: string) => { 
       alert("Templates are reset in local mode context. Switch to memory mode to use templates.");
    };

    const handleDownloadWorkspace = async () => {
        if (files.length === 0) { showNotification("Workspace is empty", "error"); return; }
        const zip = new JSZip();
        files.forEach(file => zip.file(file.path || file.name, file.content));
        const blob = await zip.generateAsync({ type: "blob" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = "gbrain-workspace.zip"; a.click(); URL.revokeObjectURL(url);
    };

    const handleUploadWorkspace = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            const zip = await JSZip.loadAsync(file);
            const rawFiles: any[] = [];
            const promises: any[] = [];
            zip.forEach((relativePath: string, zipEntry: any) => {
                promises.push((async () => {
                    if (zipEntry.dir || relativePath.includes('__MACOSX')) return;
                    const content = await zipEntry.async('string');
                    if (content.indexOf('\0') === -1) rawFiles.push({ path: relativePath, content });
                })());
            });
            await Promise.all(promises);
            const optimized = optimizeImportedFiles(rawFiles);
            const newFiles = optimized.map(f => ({
                id: crypto.randomUUID(), path: f.path, name: f.path.split('/').pop()||'u', content: f.content, lastModified: Date.now(), inContext: true
            }));
            setFiles(newFiles);
            showNotification(`Imported ${newFiles.length} files.`, 'success');
        } catch (e) { showNotification("Zip error", "error"); }
        if (uploadInputRef.current) uploadInputRef.current.value = '';
    };

    const previewData = useMemo(() => {
        if (activeTab !== 'preview') return null;
        return { files: transformToSandpackFiles(files), dependencies: extractDependencies(files), template: detectTemplate(files) };
    }, [files, activeTab]);

    return (
        <div className="flex h-full w-full border-r border-slate-800 bg-[#18181b] flex-shrink-0 animate-fadeIn z-10 flex-col">
            <div className="h-12 border-b border-slate-800 flex items-center justify-between px-2 bg-[#18181b] shrink-0 gap-2">
                <div className="flex bg-slate-900 rounded p-1 gap-1">
                    <button onClick={() => setActiveTab('code')} className={`px-3 py-1 rounded text-[10px] font-bold uppercase ${activeTab === 'code' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}>Code</button>
                    <button onClick={() => setActiveTab('preview')} className={`px-3 py-1 rounded text-[10px] font-bold uppercase ${activeTab === 'preview' ? 'bg-green-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}>Preview</button>
                </div>

                <div className="flex-1 min-w-0 flex justify-center">
                    {notification && <div className={`text-[10px] font-bold truncate px-2 ${notification.type === 'error' ? 'text-red-400' : 'text-green-400'}`}>{notification.message}</div>}
                </div>

                <div className="flex items-center gap-2">
                    <button 
                        onClick={handleOpenLocalProject}
                        className={`p-1.5 rounded transition-colors ${isLocalMode ? 'text-green-400 bg-green-900/20 shadow-[0_0_10px_rgba(74,222,128,0.2)]' : 'text-slate-500 hover:text-white hover:bg-slate-800'}`} 
                        title={isLocalMode ? "Local Project Connected" : "Open Local Project Folder"}
                    >
                        <Icons.FolderOpen />
                    </button>
                    
                    <div className="w-px h-4 bg-slate-800 mx-1"></div>

                    <button onClick={() => uploadInputRef.current?.click()} className="p-1.5 text-slate-500 hover:text-blue-400 hover:bg-slate-800 rounded" title="Import ZIP"><Icons.Upload /></button>
                    <input type="file" ref={uploadInputRef} className="hidden" accept=".zip" onChange={handleUploadWorkspace} />
                    <button onClick={handleDownloadWorkspace} className="p-1.5 text-slate-500 hover:text-green-400 hover:bg-slate-800 rounded" title="Download ZIP"><Icons.Save /></button>
                </div>
            </div>

            <div className="flex-1 min-h-0 flex flex-col relative">
                <div className={`absolute inset-0 flex flex-col transition-opacity duration-300 ${activeTab === 'code' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}>
                    <div className="h-1/3 min-h-[150px] max-h-[50%] border-b border-slate-800 overflow-hidden flex flex-col">
                        <FileExplorer
                            files={files}
                            onSelectFile={(f) => setActiveFileId(f.id)}
                            onCreateFile={handleCreateFile}
                            onDeleteFile={handleDeleteFile}
                            onRenameFile={handleRenameFile} // [传入重命名处理]
                            onToggleContext={handleToggleContext}
                        />
                    </div>
                    <div className="flex-1 min-h-0 flex flex-col">
                        <CodeEditor file={activeFile} onSave={handleSaveFile} onClose={() => setActiveFileId(null)} />
                    </div>
                </div>
                <div className={`absolute inset-0 bg-[#18181b] flex flex-col transition-opacity duration-300 ${activeTab === 'preview' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}>
                    {activeTab === 'preview' && <PreviewPanel />}
                </div>
            </div>
        </div>
    );
};