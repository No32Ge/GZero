import React, { useEffect, useRef } from 'react';
import { AppConfig, Message, VirtualMemory, UserTool } from '../types';
import { getThread } from '../services/geminiService';
import { normalizePath } from '../utils/fileSystem';
import { useFileStore } from '../stores/useFileStore';
import { getDirectoryHandleByPath } from '../utils/localFileSystem';

const detectLanguage = (path: string) => {
    if (path.endsWith('.tsx') || path.endsWith('.ts')) return 'typescript';
    if (path.endsWith('.jsx') || path.endsWith('.js')) return 'javascript';
    if (path.endsWith('.css')) return 'css';
    if (path.endsWith('.json')) return 'json';
    if (path.endsWith('.html')) return 'html';
    return 'plaintext';
};

interface GlobalAPIProps {
    config: AppConfig;
    setConfig: React.Dispatch<React.SetStateAction<AppConfig>>;
    messageMap: Record<string, Message>;
    headId: string | null;
}

export const useGlobalAPI = ({ config, setConfig, messageMap, headId }: GlobalAPIProps) => {
    const stateRef = useRef({ config, messageMap, headId });

    useEffect(() => {
        stateRef.current = { config, messageMap, headId };
    }, [config, messageMap, headId]);

    useEffect(() => {
        const api = {
            // --- Configuration & System ---
            getConfig: () => {
                const { config } = stateRef.current;
                return {
                    ...config,
                    models: config.models.map(m => ({ ...m, apiKey: m.apiKey ? '***' + m.apiKey.slice(-4) : 'unset' }))
                };
            },

            getSystemPrompt: () => stateRef.current.config.systemPrompt,

            updateSystemPrompt: (newPrompt: string) => {
                if (!newPrompt || newPrompt.trim().length === 0) {
                    return { success: false, message: "提示词不能为空" };
                }
                const oldPrompt = stateRef.current.config.systemPrompt;
                setConfig(prev => ({ ...prev, systemPrompt: newPrompt }));
                return { success: true, message: "系统提示词已更新", oldPrompt, newPrompt, length: newPrompt.length };
            },

            appendSystemPrompt: (additional: string) => {
                const current = stateRef.current.config.systemPrompt;
                const newPrompt = `${current}\n\n${additional}`;
                setConfig(prev => ({ ...prev, systemPrompt: newPrompt }));
                return { success: true, message: "系统提示词已追加", length: newPrompt.length };
            },

            // --- Memory & History ---
            getConversationHistory: () => {
                const { messageMap, headId } = stateRef.current;
                return getThread(messageMap, headId);
            },

            addMemory: (name: string, content: string) => {
                const memory: VirtualMemory = {
                    id: crypto.randomUUID(),
                    name,
                    content,
                    active: true
                };
                setConfig(prev => ({ ...prev, memories: [...prev.memories, memory] }));
                return { success: true, memory };
            },

            // --- File System ---

            listFiles: () => {
                return stateRef.current.config.files.map(f => ({
                    path: f.path || f.name,
                    size: f.content.length,
                    language: f.language
                }));
            },

            readFile: (targetPath: string) => {
                if (!targetPath) return { success: false, message: "Path required" };
                const cleanTarget = normalizePath(targetPath);
                
                // Read from memory (which is synced with disk on load/write)
                const file = stateRef.current.config.files.find(f => {
                    const currentPath = f.path || f.name;
                    const cleanF = normalizePath(currentPath);
                    return cleanF === cleanTarget || cleanF.endsWith(`/${cleanTarget}`);
                });

                if (!file) return { success: false, message: `File '${targetPath}' not found` };
                return { success: true, content: file.content, path: file.path || file.name };
            },

            writeFile: async (targetPath: string, content: string) => {
                if (!targetPath) return { success: false, message: "Path required" };
                const cleanPath = normalizePath(targetPath);
                const fileName = cleanPath.split('/').pop() || cleanPath;

                // 1. Local Disk Write Interception
                const fileStore = useFileStore.getState();
                if (fileStore.isLocalMode && fileStore.projectHandle) {
                    try {
                        const dirHandle = await getDirectoryHandleByPath(fileStore.projectHandle, cleanPath, true);
                        const fileHandle = await dirHandle.getFileHandle(fileName, { create: true });
                        const writable = await fileHandle.createWritable();
                        await writable.write(content);
                        await writable.close();

                        // Register handle if new
                        if (!fileStore.fileHandles.has(cleanPath)) {
                            fileStore.registerHandle(cleanPath, fileHandle);
                        }
                    } catch (e: any) {
                        console.error("Local disk write failed", e);
                        return { success: false, message: `Local Disk Write Failed: ${e.message}` };
                    }
                }

                // 2. Memory State Update (UI Refresh)
                let action = 'created';
                setConfig(prev => {
                    const newFiles = [...prev.files];
                    const idx = newFiles.findIndex(f => normalizePath(f.path || f.name) === cleanPath);

                    if (idx >= 0) {
                        action = 'updated';
                        newFiles[idx] = {
                            ...newFiles[idx],
                            content,
                            path: cleanPath,
                            lastModified: Date.now()
                        };
                    } else {
                        newFiles.push({
                            id: crypto.randomUUID(),
                            path: cleanPath,
                            name: fileName,
                            content,
                            language: detectLanguage(cleanPath),
                            lastModified: Date.now(),
                            inContext: true
                        });
                    }
                    return { ...prev, files: newFiles };
                });
                return { success: true, message: `File '${cleanPath}' ${action}` };
            },

            deleteFile: async (targetPath: string) => {
                const cleanPath = normalizePath(targetPath);

                // 1. Check existence in memory
                const exists = stateRef.current.config.files.some(
                    f => normalizePath(f.path || f.name) === cleanPath
                );
                if (!exists) {
                    return { success: false, message: `File '${cleanPath}' not found` };
                }

                // 2. Local Disk Delete Interception
                const fileStore = useFileStore.getState();
                if (fileStore.isLocalMode && fileStore.projectHandle) {
                    try {
                        const dirHandle = await getDirectoryHandleByPath(fileStore.projectHandle, cleanPath, false);
                        const fileName = cleanPath.split('/').pop()!;
                        await dirHandle.removeEntry(fileName);
                        fileStore.unregisterHandle(cleanPath);
                    } catch (e: any) {
                         console.error("Local disk delete failed", e);
                         return { success: false, message: `Local Disk Delete Failed: ${e.message}` };
                    }
                }

                // 3. Memory State Update
                setConfig(prev => {
                    const remaining = prev.files.filter(f => normalizePath(f.path || f.name) !== cleanPath);
                    return { ...prev, files: remaining };
                });

                return { success: true, message: `File '${cleanPath}' deleted` };
            },


            // --- Tools ---
            getTools: () => {
                return stateRef.current.config.tools.map(t => ({
                    name: t.definition?.name || 'Unnamed Tool',
                    description: t.definition?.description || '',
                    active: t.active,
                    autoExecute: t.autoExecute
                }));
            },

            registerTool: (toolDefinition: any, implementation: string, autoExecute: boolean = false) => {
                if (!toolDefinition.name) return { success: false, message: "工具必须包含name属性" };
                const exists = stateRef.current.config.tools.find(t => t.definition?.name === toolDefinition.name);
                if (exists) return { success: false, message: `工具 ${toolDefinition.name} 已存在` };

                const newTool: UserTool = {
                    id: crypto.randomUUID(),
                    definition: toolDefinition,
                    active: true,
                    implementation,
                    autoExecute
                };
                setConfig(prev => ({ ...prev, tools: [...prev.tools, newTool] }));
                return { success: true, message: `工具 ${toolDefinition.name} 注册成功`, tool: newTool };
            },

            removeTool: (toolName: string) => {
                const currentTools = stateRef.current.config.tools;
                const newTools = currentTools.filter(t => t.definition?.name !== toolName);
                if (newTools.length === currentTools.length) return { success: false, message: `未找到工具 ${toolName}` };
                setConfig(prev => ({ ...prev, tools: newTools }));
                return { success: true, message: `工具 ${toolName} 已删除` };
            },

            toggleTool: (toolName: string, active: boolean) => {
                const idx = stateRef.current.config.tools.findIndex(t => t.definition?.name === toolName);
                if (idx === -1) return { success: false, message: `未找到工具 ${toolName}` };

                setConfig(prev => {
                    const tools = [...prev.tools];
                    tools[idx] = { ...tools[idx], active };
                    return { ...prev, tools };
                });
                return { success: true, message: `工具 ${toolName} 已${active ? '启用' : '禁用'}` };
            },

            getToolDetails: (toolName: string) => {
                const tool = stateRef.current.config.tools.find(t => t.definition?.name === toolName);
                if (!tool) return { success: false, message: `未找到工具 ${toolName}` };
                return { success: true, tool: { ...tool, definition: tool.definition } };
            }
        };

        window.GeBrain = api;

        return () => {
            // @ts-ignore
            delete window.GeBrain;
        };
    }, []);
};