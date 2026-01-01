
import { VirtualFile } from '../types';

/**
 * 自动类型获取 (ATA) - 简化版
 * 负责从 CDN 拉取 d.ts 文件并注入到 Monaco 编辑器中
 */

const CACHE = new Map<string, string>();

// 常用库的类型入口硬编码 (优化加载速度)
const PRELOAD_MAP: Record<string, string> = {
    'react': 'https://unpkg.com/@types/react@18.2.0/index.d.ts',
    'react-dom': 'https://unpkg.com/@types/react-dom@18.2.0/index.d.ts',
    'lucide-react': 'https://unpkg.com/lucide-react@0.263.1/dist/lucide-react.d.ts',
    // 可以添加更多...
};

/**
 * 分析 package.json 并获取依赖列表
 */
export const extractDependencies = (files: VirtualFile[]) => {
    const pkg = files.find(f => f.path.endsWith('package.json'));
    if (!pkg) return {};
    
    try {
        const json = JSON.parse(pkg.content);
        return { ...json.dependencies, ...json.devDependencies };
    } catch (e) {
        return {};
    }
};

/**
 * 从 URL 获取文本内容
 */
const fetchText = async (url: string) => {
    if (CACHE.has(url)) return CACHE.get(url);
    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(res.statusText);
        const text = await res.text();
        CACHE.set(url, text);
        return text;
    } catch (e) {
        console.warn(`Failed to fetch types from ${url}`, e);
        return null;
    }
};

/**
 * 尝试为指定包获取类型定义
 */
export const fetchPackageTypes = async (name: string, version: string): Promise<{ filePath: string; content: string } | null> => {
    // 1. 检查预设映射
    if (PRELOAD_MAP[name]) {
        const content = await fetchText(PRELOAD_MAP[name]);
        if (content) {
            return {
                filePath: `file:///node_modules/@types/${name}/index.d.ts`,
                content
            };
        }
    }

    // 2. 尝试从 unpkg 获取 package.json 以查找 types 字段
    // 注意：这只是一个简化的 heuristic，完整的 ATA 需要递归解析依赖树
    try {
        const pkgUrl = `https://unpkg.com/${name}@${version.replace(/[\^~]/, '')}/package.json`;
        const pkgContent = await fetchText(pkgUrl);
        if (!pkgContent) return null;

        const pkgJson = JSON.parse(pkgContent);
        const typesField = pkgJson.types || pkgJson.typings;

        if (typesField) {
            // 规范化路径
            const typesPath = typesField.startsWith('./') ? typesField.slice(2) : typesField;
            const dtsUrl = `https://unpkg.com/${name}@${version.replace(/[\^~]/, '')}/${typesPath}`;
            const dtsContent = await fetchText(dtsUrl);
            
            if (dtsContent) {
                return {
                    filePath: `file:///node_modules/${name}/${typesPath}`,
                    content: dtsContent
                };
            }
        }
    } catch (e) {
        // Ignore errors for obscure packages
    }

    return null;
};

/**
 * 主入口：为编辑器注入额外的库定义
 */
export const injectLibraryTypes = async (monaco: any, dependencies: Record<string, string>) => {
    const promises = Object.entries(dependencies).map(async ([name, version]) => {
        // 检查是否已经存在
        const uri = `file:///node_modules/@types/${name}/index.d.ts`;
        // 这里无法直接检查 monaco extraLibs，只能依赖外部逻辑或重复注入(Monaco允许覆盖)
        
        const result = await fetchPackageTypes(name, version);
        if (result) {
            monaco.languages.typescript.typescriptDefaults.addExtraLib(
                result.content,
                result.filePath
            );
            // 同时注入 javascriptDefaults 以支持 JS 文件
            monaco.languages.typescript.javascriptDefaults.addExtraLib(
                result.content,
                result.filePath
            );
        }
    });

    await Promise.all(promises);
};
