
import { create } from 'zustand';
import { VirtualFile } from '../types';
import { normalizePath } from '../utils/fileSystem';
import { resolveModule } from '../utils/pathResolver';
import { DEFAULT_CONFIG } from '../config';

interface FileState {
    // UI 数据源 (保持为数组以兼容现有组件)
    files: VirtualFile[];
    
    // [新增] 核心数据源 (Path -> File Map)，用于 O(1) 查找
    fileMap: Record<string, VirtualFile>;
    
    // [新增] 依赖图谱 (Importer Path -> Set of Imported Paths)
    // 用于当 B 变化时，找到引用了 B 的 A
    dependencyGraph: Record<string, string[]>;

    activeFileId: string | null;
    entryPoint: string | null;

    // [Local Mode State]
    isLocalMode: boolean;
    projectHandle: FileSystemDirectoryHandle | null;
    fileHandles: Map<string, FileSystemFileHandle>;

    // Actions
    setFiles: (files: VirtualFile[]) => void;
    setActiveFileId: (id: string | null) => void;
    setEntryPoint: (path: string | null) => void;
    mountLocalProject: (rootHandle: FileSystemDirectoryHandle, initialFiles: VirtualFile[], handlesMap: Map<string, FileSystemFileHandle>) => void;
    
    // File CRUD
    addFile: (file: VirtualFile) => void;
    updateFile: (id: string, updates: Partial<VirtualFile>) => void;
    updateFileContent: (id: string, content: string) => void;
    deleteFile: (id: string) => void;
    toggleFileContext: (id: string) => void;
    
    // Helpers
    getFileById: (id: string) => VirtualFile | undefined;
    getFileByPath: (path: string) => VirtualFile | undefined;
    resolveImport: (importer: string, importSource: string) => VirtualFile | null; // [新增]
    
    resetFiles: () => void;

    // Internal Helper to sync Map -> Array
    _syncFiles: (map: Record<string, VirtualFile>) => VirtualFile[];
    
}

// 简单的 Import 正则提取器
const extractImports = (content: string): string[] => {
    const imports: string[] = [];
    // 匹配 import ... from '...' 和 import '...'
    const regex = /import\s+(?:[\s\S]*?from\s+)?['"]([^'"]+)['"]/g;
    let match;
    while ((match = regex.exec(content)) !== null) {
        imports.push(match[1]);
    }
    return imports;
};

export const useFileStore = create<FileState>((set, get) => ({
    files: DEFAULT_CONFIG.files,
    fileMap: DEFAULT_CONFIG.files.reduce((acc, f) => {
        acc[normalizePath(f.path || f.name)] = f;
        return acc;
    }, {} as Record<string, VirtualFile>),
    dependencyGraph: {},
    
    activeFileId: null,
    entryPoint: null,
    isLocalMode: false,
    projectHandle: null,
    fileHandles: new Map(),

    // 辅助：从 Map 同步回 Array，保持 UI 响应
    _syncFiles: (map) => Object.values(map),

    setFiles: (files) => {
        const newMap = files.reduce((acc, f) => {
            acc[normalizePath(f.path || f.name)] = f;
            return acc;
        }, {} as Record<string, VirtualFile>);
        
        set({ 
            files, 
            fileMap: newMap,
            // 重置依赖图，因为文件全变了 (后续可做全量扫描优化)
            dependencyGraph: {} 
        });
    },

    setActiveFileId: (id) => set({ activeFileId: id }),
    setEntryPoint: (path) => set({ entryPoint: path ? normalizePath(path) : null }),

    mountLocalProject: (rootHandle, initialFiles, handlesMap) => {
        const newMap = initialFiles.reduce((acc, f) => {
            acc[normalizePath(f.path || f.name)] = f;
            return acc;
        }, {} as Record<string, VirtualFile>);

        set({
            isLocalMode: true,
            projectHandle: rootHandle,
            fileHandles: handlesMap,
            files: initialFiles,
            fileMap: newMap,
            activeFileId: null
        });
    },

    addFile: (file) => set((state) => {
        const cleanPath = normalizePath(file.path || file.name);
        
        if (state.fileMap[cleanPath]) {
            return state; // 文件已存在
        }

        const newFile = { ...file, path: cleanPath };
        const newMap = { ...state.fileMap, [cleanPath]: newFile };

        return {
            fileMap: newMap,
            files: Object.values(newMap), // Sync Array
            activeFileId: file.id
        };
    }),

    updateFile: (id, updates) => set((state) => {
        const file = state.files.find(f => f.id === id);
        if (!file) return state;

        const oldPath = normalizePath(file.path || file.name);
        const newPathRaw = updates.path || updates.name || oldPath;
        const newPath = normalizePath(newPathRaw);

        const updatedFile = { ...file, ...updates, path: newPath, lastModified: Date.now() };
        
        const newMap = { ...state.fileMap };
        
        // 如果路径变了，删除旧 Key
        if (oldPath !== newPath) {
            delete newMap[oldPath];
        }
        newMap[newPath] = updatedFile;

        return {
            fileMap: newMap,
            files: Object.values(newMap)
        };
    }),

    updateFileContent: (id, content) => set((state) => {
        const file = state.files.find(f => f.id === id);
        if (!file) return state;

        const path = normalizePath(file.path || file.name);
        const updatedFile = { ...file, content, lastModified: Date.now() };
        const newMap = { ...state.fileMap, [path]: updatedFile };

        // [新增] 更新依赖图
        const imports = extractImports(content);
        // 这里可以进一步解析 imports 为绝对路径并存储，
        // 暂时只存储 raw imports 或在 resolve 时动态计算，
        // 为了性能，我们只在 Graph 中存 "Who imports Who" 的关系。
        // 简化版：dependencyGraph[path] = resolvedImports
        
        // 注意：要在 reducer 中调用 resolveModule 需要 access 到最新的 fileMap
        // 由于这里是在 set 回调中，newMap 是最新的
        const resolvedDeps = imports
            .map(imp => resolveModule(path, imp, newMap))
            .filter((p): p is string => p !== null);

        const newGraph = { ...state.dependencyGraph, [path]: resolvedDeps };

        return {
            fileMap: newMap,
            files: Object.values(newMap),
            dependencyGraph: newGraph
        };
    }),

    deleteFile: (id) => set((state) => {
        const file = state.files.find(f => f.id === id);
        if (!file) return state;

        const path = normalizePath(file.path || file.name);
        const newMap = { ...state.fileMap };
        delete newMap[path];

        // 清理 entry point
        const newEntryPoint = state.entryPoint === path ? null : state.entryPoint;
        
        // 清理依赖图
        const newGraph = { ...state.dependencyGraph };
        delete newGraph[path];

        return {
            fileMap: newMap,
            files: Object.values(newMap),
            activeFileId: state.activeFileId === id ? null : state.activeFileId,
            entryPoint: newEntryPoint,
            dependencyGraph: newGraph
        };
    }),

    toggleFileContext: (id) => set((state) => {
        const file = state.files.find(f => f.id === id);
        if (!file) return state;
        
        const path = normalizePath(file.path || file.name);
        const newFile = { ...file, inContext: file.inContext !== false ? false : true };
        const newMap = { ...state.fileMap, [path]: newFile };

        return {
            fileMap: newMap,
            files: Object.values(newMap)
        };
    }),

    // O(1) Lookup
    getFileById: (id) => get().files.find(f => f.id === id),
    
    /**
     * 增强版文件查找：支持 SW 发来的模糊路径
     * @param path - e.g., "/src/App" or "/src/App.tsx"
     */
    getFileByPath: (path: string) => {
        const clean = normalizePath(path);
        const { fileMap } = get();

        // 1. 精确匹配
        if (fileMap[clean]) return fileMap[clean];

        // 2. 尝试添加后缀 (SW 有时会直接请求无后缀路径)
        const extensions = ['.tsx', '.ts', '.jsx', '.js', '.json', '.css'];
        for (const ext of extensions) {
            if (fileMap[clean + ext]) return fileMap[clean + ext];
        }

        // 3. 尝试 index 索引
        for (const ext of extensions) {
            const indexPath = normalizePath(clean + '/index' + ext);
            if (fileMap[indexPath]) return fileMap[indexPath];
        }

        return undefined;
    },

    // [新增] 模块解析 API，供编译器或编辑器跳转使用
    resolveImport: (importer, importSource) => {
        const { fileMap } = get();
        const resolvedPath = resolveModule(importer, importSource, fileMap);
        if (resolvedPath && fileMap[resolvedPath]) {
            return fileMap[resolvedPath];
        }
        return null;
    },

    resetFiles: () => set({
        files: [],
        fileMap: {},
        dependencyGraph: {},
        activeFileId: null,
        entryPoint: null,
        isLocalMode: false,
        projectHandle: null,
        fileHandles: new Map()
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
}));
