import { create } from 'zustand';
import { VirtualFile } from '../types';
import { normalizePath } from '../utils/fileSystem';
import { DEFAULT_CONFIG } from '../config';

interface FileState {
    files: VirtualFile[];
    activeFileId: string | null;
    entryPoint: string | null;
    
    // [Local Mode State]
    isLocalMode: boolean;
    projectHandle: FileSystemDirectoryHandle | null;
    fileHandles: Map<string, FileSystemFileHandle>; // Key: Normalized Path

    // Actions
    setFiles: (files: VirtualFile[]) => void;
    setActiveFileId: (id: string | null) => void;
    setEntryPoint: (path: string | null) => void;
    
    // Local Mode Actions
    mountLocalProject: (rootHandle: FileSystemDirectoryHandle, initialFiles: VirtualFile[], handlesMap: Map<string, FileSystemFileHandle>) => void;
    registerHandle: (path: string, handle: FileSystemFileHandle) => void;
    unregisterHandle: (path: string) => void;

    // File CRUD
    addFile: (file: VirtualFile) => void;
    updateFile: (id: string, updates: Partial<VirtualFile>) => void;
    updateFileContent: (id: string, content: string) => void;
    deleteFile: (id: string) => void;
    toggleFileContext: (id: string) => void;

    // Helpers
    getFileById: (id: string) => VirtualFile | undefined;
    getFileByPath: (path: string) => VirtualFile | undefined;
    resetFiles: () => void;
}

export const useFileStore = create<FileState>((set, get) => ({
    files: DEFAULT_CONFIG.files,
    activeFileId: null,
    entryPoint: null,
    
    // Local Mode Init
    isLocalMode: false,
    projectHandle: null,
    fileHandles: new Map(),

    setFiles: (files) => set({ files }),
    setActiveFileId: (id) => set({ activeFileId: id }),
    setEntryPoint: (path) => set({ entryPoint: path }),

    mountLocalProject: (rootHandle, initialFiles, handlesMap) => set({
        isLocalMode: true,
        projectHandle: rootHandle,
        fileHandles: handlesMap,
        files: initialFiles,
        activeFileId: null
    }),

    registerHandle: (path, handle) => set((state) => {
        const newMap = new Map(state.fileHandles);
        newMap.set(normalizePath(path), handle);
        return { fileHandles: newMap };
    }),

    unregisterHandle: (path) => set((state) => {
        const newMap = new Map(state.fileHandles);
        newMap.delete(normalizePath(path));
        return { fileHandles: newMap };
    }),

    addFile: (file) => set((state) => {
        const cleanPath = normalizePath(file.path || file.name);
        const exists = state.files.some(f => normalizePath(f.path || f.name) === cleanPath);
        if (exists) return state;
        return { files: [...state.files, file], activeFileId: file.id };
    }),

    updateFile: (id, updates) => set((state) => ({ 
        files: state.files.map(f => f.id === id ? { ...f, ...updates, lastModified: Date.now() } : f) 
    })),

    updateFileContent: (id, content) => set((state) => ({ 
        files: state.files.map(f => f.id === id ? { ...f, content, lastModified: Date.now() } : f) 
    })),

    deleteFile: (id) => set((state) => ({ 
        files: state.files.filter(f => f.id !== id), 
        activeFileId: state.activeFileId === id ? null : state.activeFileId,
        entryPoint: state.files.find(f => f.id === id)?.path === state.entryPoint ? null : state.entryPoint
    })),

    toggleFileContext: (id) => set((state) => ({ 
        files: state.files.map(f => {
            if (f.id !== id) return f;
            return { ...f, inContext: f.inContext !== false ? false : true };
        }) 
    })),

    getFileById: (id) => get().files.find(f => f.id === id),

    getFileByPath: (path) => {
        const cleanPath = normalizePath(path);
        return get().files.find(f => {
            const fPath = normalizePath(f.path || f.name);
            return fPath === cleanPath || fPath.endsWith(`/${cleanPath}`);
        });
    },

    resetFiles: () => set({ 
        files: [], 
        activeFileId: null, 
        entryPoint: null,
        isLocalMode: false,
        projectHandle: null,
        fileHandles: new Map()
    })
}));