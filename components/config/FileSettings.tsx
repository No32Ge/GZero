import React, { useState } from 'react';
import { VirtualFile } from '../../types';
import { Icons } from '../Icon';
import { normalizePath } from '../../utils/fileSystem';
import { useFileStore } from '../../stores/useFileStore';

export const FileSettings: React.FC = () => {
    const files = useFileStore(s => s.files);
    const addFile = useFileStore(s => s.addFile);
    const updateFile = useFileStore(s => s.updateFile);
    const deleteFile = useFileStore(s => s.deleteFile);

    const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
    const [filePath, setFilePath] = useState('');
    const [fileContent, setFileContent] = useState('');
    const [isEditing, setIsEditing] = useState(false);

    // Enter Edit Mode (Create New)
    const handleStartCreate = () => {
        setSelectedFileId(null);
        setFilePath('');
        setFileContent('');
        setIsEditing(true);
    };

    // Enter Edit Mode (Existing)
    const handleSelectFile = (file: VirtualFile) => {
        setSelectedFileId(file.id);
        setFilePath(file.path || file.name);
        setFileContent(file.content);
        setIsEditing(true);
    };

    // Save File
    const handleSave = () => {
        if (!filePath.trim()) return;

        const cleanPath = normalizePath(filePath);
        const name = cleanPath.split('/').pop() || cleanPath;

        if (selectedFileId) {
            // Update existing
            updateFile(selectedFileId, {
                path: cleanPath,
                name: name,
                content: fileContent
            });
        } else {
            // Create new
            const newFile: VirtualFile = {
                id: crypto.randomUUID(),
                path: cleanPath,
                name: name,
                content: fileContent,
                language: 'plaintext',
                lastModified: Date.now()
            };
            addFile(newFile);
        }

        setIsEditing(false);
        setSelectedFileId(null);
        setFilePath('');
        setFileContent('');
    };

    // Delete File
    const handleDelete = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (window.confirm("Delete this file?")) {
            deleteFile(id);
            if (selectedFileId === id) {
                setIsEditing(false);
            }
        }
    };

    return (
        <div className="h-full flex flex-col animate-fadeIn">
            {isEditing ? (
                <div className="flex-1 flex flex-col gap-3">
                    <div className="flex items-center gap-2">
                        <button 
                            onClick={() => setIsEditing(false)}
                            className="text-slate-500 hover:text-white"
                        >
                            <Icons.ChevronLeft />
                        </button>
                        <h3 className="text-xs font-bold text-slate-300">
                            {selectedFileId ? 'Edit File' : 'New File'}
                        </h3>
                    </div>

                    <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-700 flex flex-col gap-3 flex-1 min-h-0">
                        <div>
                            <label className="text-[10px] uppercase text-slate-500 font-bold block mb-1">File Path</label>
                            <input
                                value={filePath}
                                onChange={(e) => setFilePath(e.target.value)}
                                placeholder="src/example.ts"
                                className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1.5 text-xs text-white focus:border-blue-500 outline-none font-mono"
                            />
                        </div>

                        <div className="flex-1 flex flex-col min-h-0">
                            <label className="text-[10px] uppercase text-slate-500 font-bold block mb-1">Content</label>
                            <textarea
                                value={fileContent}
                                onChange={(e) => setFileContent(e.target.value)}
                                className="flex-1 w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-xs text-slate-300 focus:border-blue-500 outline-none resize-none font-mono custom-scrollbar leading-relaxed"
                                spellCheck={false}
                            />
                        </div>

                        <div className="flex gap-2 shrink-0">
                            <button 
                                onClick={handleSave}
                                className="flex-1 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold py-2 rounded flex items-center justify-center gap-2"
                            >
                                <Icons.Save /> Save File
                            </button>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="space-y-4">
                    <div className="bg-slate-800/30 p-3 rounded-lg border border-slate-700 text-center">
                        <button 
                            onClick={handleStartCreate}
                            className="w-full bg-slate-800 hover:bg-slate-700 border border-slate-600 border-dashed text-slate-400 hover:text-blue-400 text-xs font-bold py-3 rounded transition-colors flex items-center justify-center gap-2"
                        >
                            <Icons.Plus /> Create New File
                        </button>
                    </div>

                    <div className="space-y-2">
                        {files.length === 0 && (
                            <div className="text-center py-8 text-xs text-slate-600 italic">No files in system.</div>
                        )}

                        {files.map(file => (
                            <div 
                                key={file.id} 
                                onClick={() => handleSelectFile(file)}
                                className="group p-3 rounded-lg border border-slate-800 bg-slate-900 hover:border-slate-700 hover:bg-slate-800/50 transition-all cursor-pointer flex items-center justify-between"
                            >
                                <div className="flex items-center gap-3 overflow-hidden">
                                    <div className="w-8 h-8 rounded bg-slate-800 flex items-center justify-center text-blue-400 shrink-0">
                                        <Icons.File />
                                    </div>
                                    <div className="min-w-0">
                                        <div className="text-xs font-bold text-slate-200 font-mono truncate" title={file.path || file.name}>{file.path || file.name}</div>
                                        <div className="text-[10px] text-slate-500">
                                            {file.content.length} chars
                                        </div>
                                    </div>
                                </div>
                                <button 
                                    onClick={(e) => handleDelete(file.id, e)}
                                    className="p-2 text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <Icons.Trash />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};