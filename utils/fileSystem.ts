import { VirtualFile } from '../types';

export interface FileNode {
  id: string;
  name: string;
  path: string;
  type: 'file' | 'folder';
  children?: FileNode[];
  content?: string;
}

// 基础路径清理：去除开头的 ./ 或 /，统一分隔符
export const normalizePath = (p: string) => {
    return p.trim().replace(/^[\.\/]+/, '').replace(/\\/g, '/');
};

/**
 * 核心新增功能：智能优化文件列表
 * 1. 过滤系统垃圾文件 (__MACOSX, .DS_Store)
 * 2. 检测并去除单一顶层目录 (Root Hoisting)
 */
export const optimizeImportedFiles = (files: { path: string; content: string }[]): { path: string; content: string }[] => {
    // 1. 初步过滤和标准化
    let cleanFiles = files
        .map(f => ({ ...f, path: normalizePath(f.path) }))
        .filter(f => {
            const p = f.path;
            // 过滤掉 Mac 系统文件、Git 目录、以及空路径
            return !p.startsWith('__MACOSX') && 
                   !p.includes('.DS_Store') && 
                   !p.startsWith('.git/') &&
                   p.length > 0;
        });

    if (cleanFiles.length === 0) return [];

    // 2. 检测是否存在公共前缀 (即单一顶层目录)
    // 比如所有文件都是: "my-project/package.json", "my-project/src/..."
    const firstPathParts = cleanFiles[0].path.split('/');
    let commonPrefixLength = 0;

    // 如果第一个文件在根目录 (parts.length === 1)，那肯定没有公共目录需要去除了
    if (firstPathParts.length > 1) {
        const potentialRoot = firstPathParts[0]; // 假设 "my-project" 是根
        
        // 检查是否所有文件都以这个目录开头
        const isAllUnderRoot = cleanFiles.every(f => f.path.startsWith(potentialRoot + '/'));
        
        if (isAllUnderRoot) {
            commonPrefixLength = potentialRoot.length + 1; // +1 是为了去掉后面的 '/'
        }
    }

    // 3. 执行“去皮”操作并返回
    if (commonPrefixLength > 0) {
        return cleanFiles.map(f => ({
            ...f,
            path: f.path.substring(commonPrefixLength), // 去掉前缀
            content: f.content
        }));
    }

    return cleanFiles;
};

export const buildFileTree = (files: VirtualFile[]) => {
  const root: FileNode[] = [];
  
  files.forEach((file) => {
    // Ensure path exists for migration
    const rawPath = file.path || file.name;
    const cleanPath = normalizePath(rawPath);
    const parts = cleanPath.split('/').filter((p) => p);
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
        const newNode: FileNode = {
          id: isFile ? file.id : `folder-${parts.slice(0, index + 1).join('-')}`,
          name: part,
          path: parts.slice(0, index + 1).join('/'),
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

  // Sort folders first, then files
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