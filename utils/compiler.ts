import { transform } from 'sucrase';
import { VirtualFile } from '../types';

// CDN 配置
const CDN_HOST = 'https://esm.sh';

/**
 * 路径解析：统一返回不带前导斜杠的路径
 */
const resolvePath = (base: string, target: string): string => {
    // 1. 如果不是相对路径，直接返回
    if (!target.startsWith('.')) return target;

    // 2. 移除前导斜杠，确保处理一致性
    const cleanBase = base.replace(/^\/+/, '');
    
    const baseParts = cleanBase.split('/');
    baseParts.pop(); // 移除当前文件名
    
    const targetParts = target.split('/');

    for (const part of targetParts) {
        if (part === '.') continue;
        if (part === '..') {
            if (baseParts.length > 0) baseParts.pop();
        } else {
            baseParts.push(part);
        }
    }
    
    return baseParts.join('/');
};

/**
 * 重写 Import 路径 (增强版正则)
 */
const rewriteImports = (code: string, currentPath: string) => {
    const replaceCallback = (match: string, prefix: string, path: string, suffix: string) => {
        if (path.startsWith('.')) {
            const resolved = resolvePath(currentPath, path);
            return `${prefix}${resolved}${suffix}`;
        }
        return match;
    };

    // 1. 处理带 'from' 的导入/导出 (import x from "mod", export x from "mod")
    let nextCode = code.replace(
        /((?:import|export)\s+[\s\S]*?from\s*['"])([^'"]+)(['"])/g,
        replaceCallback
    );

    // 2. 处理副作用导入 (import "./style.css") - 这种通常没有 'from'
    // 注意：这里使用 \s* 允许 import"mod" 这种紧凑写法
    nextCode = nextCode.replace(
        /(import\s*['"])([^'"]+)(['"])/g,
        replaceCallback
    );

    // 3. 处理动态导入 (import("mod"))
    nextCode = nextCode.replace(
        /(import\s*\(\s*['"])([^'"]+)(['"]\s*\))/g,
        replaceCallback
    );

    return nextCode;
};

export const compileFile = (code: string, filename: string) => {
    try {
        // 自动注入 process Polyfill
        // 放在这里确保它在 transform 之前注入，但不会破坏 import 语句
        let finalCode = code;
        
        // 只有当代码中真正用到 process 时才注入，避免污染
        if (code.includes('process.env') || code.includes('process.')) {
            finalCode = `
// Polyfill injected by GeBrain
const process = { 
    env: { 
        API_KEY: '', 
        GEMINI_API_KEY: '', 
        NODE_ENV: 'development',
        PUBLIC_URL: '' 
    } 
};
${code}`;
        }

        const compiled = transform(finalCode, {
            transforms: ['typescript', 'jsx'],
            jsxRuntime: 'automatic',
            production: false,
        });
        return compiled.code;
    } catch (e: any) {
        console.error(`Compile error in ${filename}:`, e);
        return `console.error("Compile Error in ${filename}: ${e.message.replace(/"/g, '\\"')}"); throw new Error("Compile Error");`;
    }
};

export const buildImportMap = (files: VirtualFile[]) => {
    const REACT_VERSION = '19.0.0';

    const imports: Record<string, string> = {
        "react": `${CDN_HOST}/react@${REACT_VERSION}?dev`,
        "react-dom": `${CDN_HOST}/react-dom@${REACT_VERSION}?dev`,
        "react-dom/client": `${CDN_HOST}/react-dom@${REACT_VERSION}/client?dev`,
        "react/jsx-runtime": `${CDN_HOST}/react@${REACT_VERSION}/jsx-runtime?dev`,
        "react/jsx-dev-runtime": `${CDN_HOST}/react@${REACT_VERSION}/jsx-dev-runtime?dev`
    };

    const cssContent: string[] = [];

    const pkgFile = files.find(f => f.path.endsWith('package.json'));
    if (pkgFile) {
        try {
            const pkg = JSON.parse(pkgFile.content);
            const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
            
            Object.keys(allDeps).forEach(dep => {
                // 跳过 react 和 react-dom，防止版本冲突
                if (dep === 'react' || dep === 'react-dom') return;
                
                const version = allDeps[dep].replace(/[\^~]/, '');
                
                // 1. 精确映射
                imports[dep] = `${CDN_HOST}/${dep}@${version}?dev&deps=react@${REACT_VERSION},react-dom@${REACT_VERSION}`;

                // 2. 子路径映射
                imports[`${dep}/`] = `${CDN_HOST}/${dep}@${version}/`;
            });
        } catch (e) {
            console.warn("Invalid package.json");
        }
    }

    files.forEach(file => {
        if (file.path.endsWith('.json') || file.path.endsWith('.html')) return;
        const cleanPath = file.path.replace(/^\/+/, '');

        if (file.path.endsWith('.css')) {
            cssContent.push(file.content);
            // 为 CSS 创建空模块，防止 import 报错
            const emptyBlob = new Blob(["export default {}"], { type: 'application/javascript' });
            imports[cleanPath] = URL.createObjectURL(emptyBlob);
            return;
        }

        if (/\.(tsx|ts|jsx|js)$/.test(file.path)) {
            try {
                // 1. 先重写路径
                const rewrittenCode = rewriteImports(file.content, cleanPath);
                
                // 2. 再编译代码 (此时 process polyfill 会被注入)
                const jsCode = compileFile(rewrittenCode, cleanPath);
                
                const blob = new Blob([jsCode], { type: 'application/javascript' });
                const blobUrl = URL.createObjectURL(blob);

                // 注册多种路径形式以提高命中率
                imports[cleanPath] = blobUrl;
                
                // 支持无后缀引用
                const noExt = cleanPath.replace(/\.(tsx|ts|jsx|js)$/, '');
                imports[noExt] = blobUrl;
                
            } catch (e) {
                console.error(`Failed to process ${file.path}`);
            }
        }
    });

    return { imports, css: cssContent.join('\n') };
};