import { VirtualFile } from '../types';
import { normalizePath } from './fileSystem';

// 忽略列表，防止加载 node_modules 炸掉浏览器内存
const IGNORED_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.vscode', '.idea', 'coverage']);
const IGNORED_FILES = new Set(['.DS_Store', 'yarn.lock', 'package-lock.json', 'pnpm-lock.yaml']);

// 判断是否为文本文件（简单扩展名检查）
const isTextFile = (name: string) => {
    const binaryExts = new Set([
        'png', 'jpg', 'jpeg', 'gif', 'ico', 'svg', 'woff', 'woff2', 'ttf', 'eot', 'mp4', 'webm', 'mp3', 'wav', 'pdf', 'zip', 'exe', 'dll', 'so', 'dylib'
    ]);
    const ext = name.split('.').pop()?.toLowerCase();
    return ext ? !binaryExts.has(ext) : true;
};

// 递归读取目录
export const readDirectoryRecursive = async (
    dirHandle: FileSystemDirectoryHandle,
    pathPrefix = ''
): Promise<{ files: VirtualFile[], handles: Map<string, FileSystemFileHandle> }> => {
    let files: VirtualFile[] = [];
    const handles = new Map<string, FileSystemFileHandle>();

    // [修复 TS 报错]: 使用 (dirHandle as any) 绕过类型检查，或者使用 entries()
    // 标准 API 是异步迭代器，但在某些 TS 版本定义中缺失
    // @ts-ignore - values() method exists in modern browsers but might be missing in TS lib
    for await (const entry of dirHandle.values()) {
        const fullPath = pathPrefix ? `${pathPrefix}/${entry.name}` : entry.name;
        
        if (entry.kind === 'file') {
            if (IGNORED_FILES.has(entry.name)) continue;
            if (!isTextFile(entry.name)) continue;

            const fileHandle = entry as FileSystemFileHandle;
            const file = await fileHandle.getFile();
            
            try {
                const text = await file.text();
                // 过滤空字节，防止二进制文件被误读为文本导致编辑器崩溃
                if (text.indexOf('\0') === -1) {
                    files.push({
                        id: crypto.randomUUID(),
                        path: fullPath,
                        name: entry.name,
                        content: text,
                        lastModified: file.lastModified,
                        inContext: true, 
                    });
                    handles.set(normalizePath(fullPath), fileHandle);
                }
            } catch (e) {
                console.warn(`Skipping file ${fullPath}: unable to read text.`);
            }

        } else if (entry.kind === 'directory') {
            if (IGNORED_DIRS.has(entry.name)) continue;
            
            const subDirHandle = entry as FileSystemDirectoryHandle;
            const subResult = await readDirectoryRecursive(subDirHandle, fullPath);
            
            files = [...files, ...subResult.files];
            subResult.handles.forEach((v, k) => handles.set(k, v));
        }
    }

    return { files, handles };
};

// 辅助：根据路径获取或创建目录 Handle
export const getDirectoryHandleByPath = async (
    root: FileSystemDirectoryHandle, 
    path: string, 
    create = false
): Promise<FileSystemDirectoryHandle> => {
    const clean = normalizePath(path);
    const parts = clean.split('/').slice(0, -1); // 去掉文件名，只保留目录部分
    let current = root;
    
    // 如果文件就在根目录，parts 为空，直接返回 root
    if (parts.length === 0) return root;

    for (const part of parts) {
        if (!part || part === '.') continue;
        current = await current.getDirectoryHandle(part, { create });
    }
    
    return current;
};