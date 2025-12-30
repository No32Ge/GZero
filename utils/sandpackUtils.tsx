import { VirtualFile } from '../types';

// [修改] 引入 Vite 模板类型
export type SupportedTemplate = 'vite-react-ts' | 'vite-vue-ts' | 'vanilla-ts' | 'static';

/**
 * 1. 智能检测项目模板
 */
export const detectTemplate = (files: VirtualFile[]): SupportedTemplate => {
    const pkgFile = files.find(f => f.path === 'package.json' || f.name === 'package.json');
    let dependencies: Record<string, string> = {};

    if (pkgFile) {
        try {
            const pkg = JSON.parse(pkgFile.content);
            dependencies = { ...pkg.dependencies, ...pkg.devDependencies };
        } catch (e) {}
    }

    // Vue 检测
    if (dependencies['vue'] || files.some(f => f.path.endsWith('.vue'))) {
        return 'vite-vue-ts'; // [修改] 使用 Vite 环境
    }

    // React 检测
    if (dependencies['react'] || dependencies['react-dom'] || files.some(f => f.path.endsWith('.tsx'))) {
        return 'vite-react-ts'; // [修改] 使用 Vite 环境
    }

    // 默认为原生 TypeScript/HTML
    return 'vanilla-ts';
};

/**
 * 2. 获取对应模板的入口文件配置
 */
export const getTemplateOptions = (template: SupportedTemplate) => {
    switch (template) {
        case 'vite-vue-ts':
            return {
                visibleFiles: ["/src/App.vue", "/src/main.ts", "/index.html"],
                activeFile: "/src/App.vue",
                entry: "/src/main.ts" 
            };
        case 'vanilla-ts':
        case 'static':
            return {
                visibleFiles: ["/index.html", "/src/main.ts", "/style.css"],
                activeFile: "/index.html",
                entry: "/index.html" 
            };
        case 'vite-react-ts':
        default:
            return {
                visibleFiles: ["/src/App.tsx", "/src/index.tsx", "/index.html"], // [修改] 规范路径
                activeFile: "/src/App.tsx",
                entry: "/src/index.tsx" // [修改] Vite 推荐入口
            };
    }
};

/**
 * 3. 提取依赖
 */
export const extractDependencies = (files: VirtualFile[]) => {
    const pkgFile = files.find(f => f.path === 'package.json' || f.name === 'package.json');
    if (!pkgFile) return {}; 

    try {
        const pkg = JSON.parse(pkgFile.content);
        return {
            ...pkg.dependencies,
            ...pkg.devDependencies
        };
    } catch (e) {
        console.warn("Failed to parse package.json", e);
        return {};
    }
};

/**
 * 4. 转换文件格式
 */
export const transformToSandpackFiles = (files: VirtualFile[]) => {
    const sandpackFiles: Record<string, string> = {};
    files.forEach(f => {
        let path = f.path;
        if (!path.startsWith('/')) path = '/' + path;
        sandpackFiles[path] = f.content;
    });
    return sandpackFiles;
};