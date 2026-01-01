
/**
 * @deprecated 阶段三重构：
 * 编译逻辑已移至 Service Worker (public/sw.js)。
 * 此文件现仅保留类型定义或辅助常量。
 */

import { VirtualFile } from '../types';

// 如果未来需要在主线程做静态分析（比如依赖图可视化），可以在这里保留相关逻辑。
// 目前 SW 负责 JIT 编译，此处留空。

export const compileFile = (code: string) => {
    console.warn("compileFile called from main thread - this should now be handled by SW.");
    return code;
};

export const buildImportMap = (files: VirtualFile[]) => {
    console.warn("buildImportMap is deprecated in Phase 3.");
    return { imports: {}, css: '' };
};
