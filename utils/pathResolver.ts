
import { VirtualFile } from '../types';

/**
 * POSIX 风格路径处理工具集 (浏览器端运行)
 */

// 1. 标准化路径：处理 . 和 ..，确保以 / 开头
// e.g., /src/components/../App.tsx -> /src/App.tsx
export const posixNormalize = (path: string): string => {
  const isAbsolute = path.startsWith('/');
  const parts = path.split(/\/+/);
  const stack: string[] = [];

  for (const part of parts) {
    if (part === '' || part === '.') continue;
    if (part === '..') {
      if (stack.length > 0) {
        stack.pop();
      }
    } else {
      stack.push(part);
    }
  }

  const res = stack.join('/');
  return isAbsolute ? `/${res}` : res;
};

// 2. 路径拼接
export const posixJoin = (...paths: string[]): string => {
  return posixNormalize(paths.join('/'));
};

// 3. 获取目录名
export const posixDirname = (path: string): string => {
  const normalized = posixNormalize(path);
  const lastSlash = normalized.lastIndexOf('/');
  if (lastSlash === -1) return '.';
  if (lastSlash === 0) return '/';
  return normalized.substring(0, lastSlash);
};

// 4. 获取扩展名
export const posixExtname = (path: string): string => {
  const idx = path.lastIndexOf('.');
  if (idx === -1) return '';
  return path.slice(idx);
};

/**
 * 模块解析算法 (Node.js Style)
 * @param currentFile - 当前文件路径 (e.g., /src/App.tsx)
 * @param importPath - 导入路径 (e.g., ./components/Button)
 * @param fileMap - 文件索引 Map
 */
export const resolveModule = (
  currentFile: string, 
  importPath: string, 
  fileMap: Record<string, VirtualFile>
): string | null => {
  // 1. 处理非相对路径 (如 'react') -> 暂不处理 node_modules，直接忽略或返回 null
  if (!importPath.startsWith('.') && !importPath.startsWith('/')) {
    return null; // 这是一个外部依赖
  }

  // 2. 计算绝对路径上下文
  const currentDir = posixDirname(currentFile);
  let absolutePath = importPath.startsWith('/') 
    ? importPath 
    : posixJoin(currentDir, importPath);

  // 3. 尝试解析策略
  const extensions = ['', '.ts', '.tsx', '.js', '.jsx', '.json', '.css'];
  
  // 策略 A: 直接文件匹配 (Check File)
  for (const ext of extensions) {
    const tryPath = absolutePath + ext;
    if (fileMap[tryPath]) return tryPath;
  }

  // 策略 B: 目录索引匹配 (Check Directory Index)
  // e.g., /src/components/Button -> /src/components/Button/index.tsx
  const indexExtensions = ['/index.ts', '/index.tsx', '/index.js', '/index.jsx'];
  for (const ext of indexExtensions) {
    const tryPath = absolutePath + ext;
    if (fileMap[tryPath]) return tryPath;
  }

  return null; // 解析失败
};
