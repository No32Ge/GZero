
import { VirtualFile } from '../types';
import { posixNormalize } from './pathResolver';

export interface FileNode {
    id: string;
    name: string;
    path: string;
    type: 'file' | 'folder';
    children?: FileNode[];
    content?: string;
}

// [核心修改] 标准化路径：强制使用绝对路径 (/src/...)
export const normalizePath = (p: string) => {
    // 移除空白
    let clean = p.trim();
    // 统一分隔符
    clean = clean.replace(/\\/g, '/');
    // 如果不是以 / 开头，加上 /
    if (!clean.startsWith('/')) {
        clean = '/' + clean;
    }
    // 使用 posixNormalize 处理 .. 和 .
    return posixNormalize(clean);
};

/**
 * 智能优化文件列表
 */
export const optimizeImportedFiles = (files: { path: string; content: string }[]): { path: string; content: string }[] => {
    // 1. 初步过滤和标准化
    let cleanFiles = files
        .map(f => ({ ...f, path: normalizePath(f.path) }))
        .filter(f => {
            const p = f.path;
            return !p.includes('__MACOSX') && !p.includes('.DS_Store') && !p.includes('/.git/') && p !== '/';
        });

    if (cleanFiles.length === 0) return [];

    // 2. 检测单一顶层目录 (Root Hoisting)
    // 例如 zip 解压出来所有文件都在 /my-project/ 下，我们希望把 my-project 去掉，直接放到根目录 /
    // 获取第一个文件的第一级目录
    const firstParts = cleanFiles[0].path.split('/').filter(Boolean);
    
    if (firstParts.length > 0) {
        const rootDir = '/' + firstParts[0];
        const isAllUnderRoot = cleanFiles.every(f => f.path.startsWith(rootDir + '/'));

        if (isAllUnderRoot) {
            const prefixLen = rootDir.length;
            return cleanFiles.map(f => ({
                ...f,
                path: f.path.substring(prefixLen) || '/', // 移除前缀
                content: f.content
            })).filter(f => f.path !== '/'); // 过滤掉变为空的路径
        }
    }

    return cleanFiles;
};

export const buildFileTree = (files: VirtualFile[]) => {
    const root: FileNode[] = [];

    files.forEach((file) => {
        const cleanPath = normalizePath(file.path || file.name);
        // split 后会产生空字符串 (因为路径以 / 开头)，需要过滤
        const parts = cleanPath.split('/').filter(Boolean);
        let currentLevel = root;

        parts.forEach((part, index) => {
            const isFile = index === parts.length - 1;
            const existingNode = currentLevel.find(
                (n) => n.name === part && n.type === (isFile ? 'file' : 'folder')
            );

            if (existingNode) {
                if (!isFile) {
                    currentLevel = existingNode.children!;
                }
            } else {
                // 构造节点路径
                const nodePath = '/' + parts.slice(0, index + 1).join('/');
                
                const newNode: FileNode = {
                    id: isFile ? file.id : `folder-${nodePath}`,
                    name: part,
                    path: nodePath,
                    type: isFile ? 'file' : 'folder',
                    children: isFile ? undefined : [],
                    content: isFile ? file.content : undefined,
                };
                currentLevel.push(newNode);

                if (!isFile) {
                    currentLevel = newNode.children!;
                }
            }
        });
    });

    // Sort folders first
    const sortNodes = (nodes: FileNode[]) => {
        nodes.sort((a, b) => {
            if (a.type === b.type) return a.name.localeCompare(b.name);
            return a.type === 'folder' ? -1 : 1;
        });
        nodes.forEach(n => {
            if (n.children) sortNodes(n.children);
        });
    };

    sortNodes(root);
    return root;
};
