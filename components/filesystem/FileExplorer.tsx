import React, { useState, useMemo, useEffect } from 'react';
import { Icons } from '../Icon';
import { VirtualFile } from '../../types';
import { buildFileTree, FileNode, normalizePath } from '../../utils/fileSystem';
import { useFileStore } from '../../stores/useFileStore';

interface FileExplorerProps {
    files: VirtualFile[];
    onSelectFile: (file: VirtualFile) => void;
    onCreateFile: (path: string) => void;
    onDeleteFile?: (id: string) => void;
    onRenameFile?: (id: string, newPath: string) => void; // [新增]
    onToggleContext?: (id: string) => void;
}

const FileTreeNode: React.FC<{
    node: FileNode;
    level: number;
    onSelect: (path: string) => void;
    onDelete?: (id: string) => void;
    onRename?: (id: string, newPath: string) => void; // [新增]
    onToggleContext?: (id: string) => void;
    filesMap: Record<string, VirtualFile>;
    pendingDeleteId: string | null;
    setPendingDeleteId: React.Dispatch<React.SetStateAction<string | null>>;
    currentEntryPoint: string | null;
    onSetEntryPoint: (path: string) => void;
}> = ({ node, level, onSelect, onDelete, onRename, onToggleContext, filesMap, pendingDeleteId, setPendingDeleteId, currentEntryPoint, onSetEntryPoint }) => {
    const [isOpen, setIsOpen] = useState(true);
    
    // [新增] 重命名状态管理
    const [isRenaming, setIsRenaming] = useState(false);
    const [renameValue, setRenameValue] = useState(node.path);

    useEffect(() => {
        setRenameValue(node.path);
    }, [node.path]);

    // 渲染文件节点
    if (node.type === 'file') {
        const isPendingDelete = pendingDeleteId === node.id;
        const file = filesMap[node.id];
        const isInContext = file?.inContext !== false;
        
        const isEntryPoint = currentEntryPoint === node.path;
        const isRunnable = /\.(tsx|ts|jsx|js)$/.test(node.name);

        return (
            <div
                className={`group flex items-center transition-all relative pr-2 duration-200 ${isPendingDelete ? 'bg-red-900/40' : (isEntryPoint ? 'bg-green-900/20' : 'hover:bg-[#2a2a2d]')}`}
                style={{ paddingLeft: `${level * 12 + 12}px` }}
            >
                {/* 1. 左侧：选择区域与输入框 */}
                <div
                    className="flex-1 flex items-center gap-2 py-1.5 cursor-pointer min-w-0"
                    onClick={(e) => {
                        e.preventDefault();
                        if (!isRenaming) onSelect(node.path);
                    }}
                    title={node.path}
                >
                    <span className={`shrink-0 transition-colors ${isPendingDelete ? 'text-red-400' : (isEntryPoint ? 'text-green-400' : (isInContext ? 'text-blue-400' : 'text-slate-600'))}`}>
                        {isEntryPoint ? <Icons.Play /> : <Icons.File />}
                    </span>
                    
                    {isRenaming ? (
                        <input
                            autoFocus
                            value={renameValue}
                            onChange={e => setRenameValue(e.target.value)}
                            onBlur={() => {
                                setIsRenaming(false);
                                if (renameValue !== node.path && renameValue.trim() !== '') {
                                    onRename?.(node.id, renameValue);
                                }
                            }}
                            onKeyDown={e => {
                                if (e.key === 'Enter') {
                                    setIsRenaming(false);
                                    if (renameValue !== node.path && renameValue.trim() !== '') {
                                        onRename?.(node.id, renameValue);
                                    }
                                } else if (e.key === 'Escape') {
                                    setIsRenaming(false);
                                    setRenameValue(node.path);
                                }
                            }}
                            className="text-xs bg-slate-900 text-white outline-none border border-blue-500 px-1 py-0.5 rounded w-full ml-1"
                            onClick={e => e.stopPropagation()}
                        />
                    ) : (
                        <span className={`text-xs font-mono truncate select-none ${isPendingDelete ? 'text-red-200' : (isEntryPoint ? 'text-green-300 font-bold' : (isInContext ? 'text-slate-300' : 'text-slate-500 line-through decoration-slate-700'))}`}>
                            {node.name}
                        </span>
                    )}

                    {isPendingDelete && <span className="text-[9px] text-red-400 uppercase font-bold tracking-wider ml-2">Confirm?</span>}
                    {isEntryPoint && !isRenaming && <span className="text-[8px] bg-green-900 text-green-400 px-1 rounded ml-2 uppercase">Entry</span>}
                </div>

                {/* 2. 中间：设为入口 */}
                {isRunnable && !isEntryPoint && !isPendingDelete && !isRenaming && (
                     <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onSetEntryPoint(node.path);
                        }}
                        className="p-1.5 mr-1 rounded transition-all shrink-0 z-20 opacity-0 group-hover:opacity-100 text-slate-500 hover:text-green-400 hover:bg-slate-800"
                        title="Set as Entry Point (Start File)"
                    >
                        <div className="scale-75"><Icons.Play /></div>
                    </button>
                )}

                {/* 3. 中间：上下文切换 */}
                {onToggleContext && !isPendingDelete && !isRenaming && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onToggleContext(node.id);
                        }}
                        className={`p-1.5 mr-1 rounded transition-all shrink-0 z-20 opacity-0 group-hover:opacity-100 ${isInContext ? 'text-blue-500 hover:bg-slate-800' : 'text-slate-500 hover:text-slate-300'}`}
                        title={isInContext ? "In Context" : "Out of Context"}
                    >
                        <div className="scale-75">
                            {isInContext ? <Icons.Eye /> : <Icons.EyeOff />}
                        </div>
                    </button>
                )}

                {/* [新增] 4. 右侧：重命名按钮 */}
                {onRename && !isPendingDelete && !isRenaming && (
                    <button
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setIsRenaming(true);
                        }}
                        className={`p-1.5 mr-1 rounded transition-all shrink-0 z-20 opacity-0 group-hover:opacity-100 text-slate-500 hover:text-blue-400 hover:bg-slate-800`}
                        title="Rename File"
                    >
                        <div className="scale-75"><Icons.Edit /></div>
                    </button>
                )}

                {/* 5. 右侧：删除按钮 */}
                {onDelete && !isRenaming && (
                    <button
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (isPendingDelete) {
                                onDelete(node.id);
                                setPendingDeleteId(null);
                            } else {
                                setPendingDeleteId(node.id);
                                setTimeout(() => {
                                    setPendingDeleteId((prev: string | null) => prev === node.id ? null : prev);
                                }, 3000);
                            }
                        }}
                        className={`p-1.5 rounded transition-all shrink-0 z-20 ${isPendingDelete
                            ? 'opacity-100 text-white bg-red-600 hover:bg-red-500 shadow-lg shadow-red-900/50'
                            : 'opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 hover:bg-slate-800'
                            }`}
                        title={isPendingDelete ? "Confirm Delete" : "Delete File"}
                    >
                        <div className="scale-75"><Icons.Trash /></div>
                    </button>
                )}
            </div>
        );
    }

    // 渲染文件夹节点
    return (
        <div>
            <div
                onClick={(e) => {
                    e.preventDefault();
                    setIsOpen(!isOpen);
                }}
                className="flex items-center gap-2 py-1 px-2 hover:bg-[#2a2a2d] cursor-pointer text-slate-500 hover:text-slate-300 font-bold select-none transition-colors"
                style={{ paddingLeft: `${level * 12 + 12}px` }}
            >
                <span className="scale-75 transition-transform duration-200" style={{ transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)' }}>
                    <Icons.ChevronDown />
                </span>
                <span className="text-xs uppercase tracking-wider flex items-center gap-2 truncate">
                    <Icons.Folder /> {node.name}
                </span>
            </div>
            {isOpen && node.children?.map(child => (
                <FileTreeNode
                    key={child.path}
                    node={child}
                    level={level + 1}
                    onSelect={onSelect}
                    onDelete={onDelete}
                    onRename={onRename}
                    onToggleContext={onToggleContext}
                    filesMap={filesMap}
                    pendingDeleteId={pendingDeleteId}
                    setPendingDeleteId={setPendingDeleteId}
                    currentEntryPoint={currentEntryPoint}
                    onSetEntryPoint={onSetEntryPoint}
                />
            ))}
        </div>
    );
};

export const FileExplorer: React.FC<FileExplorerProps> = ({ files, onSelectFile, onCreateFile, onDeleteFile, onRenameFile, onToggleContext }) => {
    const tree = useMemo(() => buildFileTree(files), [files]);
    const filesMap = useMemo(() => {
        return files.reduce((acc, file) => {
            acc[file.id] = file;
            return acc;
        }, {} as Record<string, VirtualFile>);
    }, [files]);

    const [newPath, setNewPath] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

    const entryPoint = useFileStore(s => s.entryPoint);
    const setEntryPoint = useFileStore(s => s.setEntryPoint);

    const handleCreate = () => {
        if (!newPath) return;
        onCreateFile(newPath);
        setNewPath('');
        setIsCreating(false);
    }

    return (
        <div className="flex flex-col h-full bg-[#18181b]">
            <div className="p-2 border-b border-slate-800 flex justify-between items-center bg-[#18181b] shrink-0">
                <span className="text-[10px] font-bold text-slate-500 tracking-wider pl-2">EXPLORER</span>
                <button onClick={() => setIsCreating(true)} className="text-slate-500 hover:text-white p-1 rounded hover:bg-slate-800 transition-colors" title="New File">
                    <Icons.Plus />
                </button>
            </div>

            {isCreating && (
                <div className="p-2 bg-[#202023] border-b border-slate-800 animate-fadeIn shrink-0">
                    <input
                        autoFocus
                        className="w-full bg-black/30 text-xs text-white p-1.5 border border-blue-500 outline-none rounded font-mono placeholder:text-slate-600"
                        placeholder="src/components/App.tsx"
                        value={newPath}
                        onChange={e => setNewPath(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleCreate()}
                        onBlur={() => setIsCreating(false)}
                    />
                </div>
            )}

            <div className="flex-1 overflow-y-auto py-2 custom-scrollbar">
                {files.length === 0 && !isCreating && (
                    <div className="text-center mt-10 text-[10px] text-slate-600 italic px-4">
                        Workspace is empty.<br />Import a ZIP or create a file.
                    </div>
                )}

                {tree.map(node => (
                    <FileTreeNode
                        key={node.path}
                        node={node}
                        level={0}
                        onDelete={onDeleteFile}
                        onRename={onRenameFile}
                        onToggleContext={onToggleContext}
                        filesMap={filesMap}
                        pendingDeleteId={pendingDeleteId}
                        setPendingDeleteId={setPendingDeleteId}
                        currentEntryPoint={entryPoint}
                        onSetEntryPoint={setEntryPoint}
                        onSelect={(selectedPath) => {
                            const cleanSelected = normalizePath(selectedPath);
                            const file = files.find(f => {
                                const fPath = normalizePath(f.path || f.name);
                                return fPath === cleanSelected;
                            });
                            if (file) {
                                onSelectFile(file);
                            }
                        }}
                    />
                ))}
            </div>
        </div>
    );
};