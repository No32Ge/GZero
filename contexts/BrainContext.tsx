
import React, { createContext, useContext, useState, useMemo, useCallback, useEffect } from 'react';
import { AppConfig, Message, ToolLog, ConversationState } from '../types';
import { DEFAULT_CONFIG } from '../config';
import { getThread, getRawRequest } from '../services/geminiService';
import { useGlobalAPI } from '../hooks/useGlobalAPI';
import { useConfigStore } from '../stores/useConfigStore';
import { useFileStore } from '../stores/useFileStore';

interface BrainContextType {
    config: AppConfig;
    setConfig: React.Dispatch<React.SetStateAction<AppConfig>>;
    messageMap: Record<string, Message>;
    setMessageMap: React.Dispatch<React.SetStateAction<Record<string, Message>>>;
    headId: string | null;
    setHeadId: React.Dispatch<React.SetStateAction<string | null>>;
    
    // Computed / Derived
    currentThread: Message[];

    // Tools Debugging
    toolLogs: ToolLog[];
    addToolLog: (log: ToolLog) => void;
    updateToolLog: (id: string, updates: Partial<ToolLog>) => void;
    clearLogs: () => void;

    // Import/Export
    handleExport: (type: 'state' | 'raw') => void;
    handleImport: (file: File) => void;
}

const BrainContext = createContext<BrainContextType | null>(null);

export const BrainProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [config, setConfig] = useState<AppConfig>(DEFAULT_CONFIG);
    const [messageMap, setMessageMap] = useState<Record<string, Message>>({});
    const [headId, setHeadId] = useState<string | null>(null);
    const [toolLogs, setToolLogs] = useState<ToolLog[]>([]);

    // Computed
    const currentThread = useMemo(() => getThread(messageMap, headId), [messageMap, headId]);

    // Actions
    const addToolLog = useCallback((log: ToolLog) => setToolLogs(prev => [...prev, log]), []);
    const updateToolLog = useCallback((id: string, updates: Partial<ToolLog>) => {
        setToolLogs(prev => prev.map(l => l.id === id ? { ...l, ...updates } : l));
    }, []);
    const clearLogs = useCallback(() => setToolLogs([]), []);

    // --- Sync Logic for Migration (Step 1 & 2 & 3) ---

    // 1. Sync Store -> Context (When UI updates Store, sync to Context config)
    useEffect(() => {
        const unsubConfig = useConfigStore.subscribe((state) => {
            setConfig(prev => {
                const isSystemPromptChanged = prev.systemPrompt !== state.systemPrompt;
                const isActiveModelChanged = prev.activeModelId !== state.activeModelId;
                const isModelsChanged = prev.models !== state.models;
                const isEnvChanged = prev.env !== state.env;
                const isMemoriesChanged = prev.memories !== state.memories;
                const isToolsChanged = prev.tools !== state.tools;

                if (isSystemPromptChanged || isActiveModelChanged || isModelsChanged || isEnvChanged || isMemoriesChanged || isToolsChanged) {
                    return { 
                        ...prev, 
                        systemPrompt: state.systemPrompt,
                        activeModelId: state.activeModelId,
                        models: state.models,
                        env: state.env,
                        memories: state.memories,
                        tools: state.tools,
                        files: prev.files // Explicitly keep files from context state to avoid loop
                    };
                }
                return prev;
            });
        });

        // File Store Sync
        const unsubFiles = useFileStore.subscribe((state) => {
            setConfig(prev => {
                if (prev.files !== state.files) {
                    return { ...prev, files: state.files };
                }
                return prev;
            });
        });

        return () => {
            unsubConfig();
            unsubFiles();
        };
    }, []);

    // 2. Sync Context -> Store (When Context config updates e.g. from Import, sync to Store)
    useEffect(() => {
        const store = useConfigStore.getState();
        
        if (
            store.systemPrompt !== config.systemPrompt ||
            store.activeModelId !== config.activeModelId ||
            store.models !== config.models ||
            store.env !== config.env ||
            store.memories !== config.memories ||
            store.tools !== config.tools
        ) {
            useConfigStore.setState({
                systemPrompt: config.systemPrompt,
                activeModelId: config.activeModelId,
                models: config.models,
                env: config.env,
                memories: config.memories,
                tools: config.tools
            });
        }

        // [修复] 正确同步文件状态：使用 setFiles Action 而不是直接 setState
        const fileStore = useFileStore.getState();
        if (fileStore.files !== config.files) {
            // 调用 Action 以确保 fileMap 和 dependencyGraph 被正确重建
            fileStore.setFiles(config.files);
        }
    }, [config]);

    const handleExport = useCallback((type: 'state' | 'raw') => {
        let content = "";
        let filename = "";

        if (type === 'state') {
          const state: ConversationState = { config, messageMap, headId };
          content = JSON.stringify(state, null, 2);
          filename = `brain-studio-tree-${new Date().toISOString()}.json`;
        } else {
          try {
            const rawReq = getRawRequest(config, currentThread);
            content = JSON.stringify(rawReq, null, 2);
            filename = `api-debug-request-${new Date().toISOString()}.json`;
          } catch (e: any) {
            alert("Failed to generate raw request: " + e.message);
            return;
          }
        }

        const blob = new Blob([content], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, [config, messageMap, headId, currentThread]);

    const handleImport = useCallback((file: File) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const json = e.target?.result as string;
            const state: any = JSON.parse(json);

            // V1 Schema Migration
            if (Array.isArray(state.messages)) {
              const legacyMessages = state.messages as Message[];
              const newMap: Record<string, Message> = {};
              let prevId: string | null = null;

              legacyMessages.forEach((msg) => {
                if (!msg.id) msg.id = crypto.randomUUID();
                const newMsg: Message = { ...msg, parentId: prevId, childrenIds: [] };
                newMap[newMsg.id] = newMsg;
                if (prevId && newMap[prevId]) newMap[prevId].childrenIds.push(newMsg.id);
                prevId = newMsg.id;
              });

              let newConfig = state.config || DEFAULT_CONFIG;
              if (typeof newConfig.apiKey === 'string') {
                 newConfig = { ...DEFAULT_CONFIG, ...newConfig, models: [{
                    id: 'legacy', name: 'Imported', provider: 'gemini', modelId: 'gemini-2.5-flash', apiKey: newConfig.apiKey
                 }], activeModelId: 'legacy' };
              }
              
              // Migrate Files
              if (newConfig.files) {
                 newConfig.files = newConfig.files.map((f: any) => ({
                     ...f,
                     path: f.path || f.name,
                     name: f.name || (f.path ? f.path.split('/').pop() : 'untitled'),
                     lastModified: f.lastModified || Date.now()
                 }));
              }

              setConfig(newConfig);
              setMessageMap(newMap);
              setHeadId(prevId);
              alert("Legacy session restored.");
              return;
            }

            // V2 Tree Schema
            if (state.messageMap && state.headId) {
              const importedConfig = state.config || DEFAULT_CONFIG;
              if (!importedConfig.files) importedConfig.files = [];
              
              // Migrate Files
              if (importedConfig.files) {
                 importedConfig.files = importedConfig.files.map((f: any) => ({
                     ...f,
                     path: f.path || f.name,
                     name: f.name || (f.path ? f.path.split('/').pop() : 'untitled'),
                     lastModified: f.lastModified || Date.now()
                 }));
              }
              
              setConfig(importedConfig);
              setMessageMap(state.messageMap);
              setHeadId(state.headId);
              alert("Session restored successfully.");
            } else {
              throw new Error("Unknown file format");
            }
          } catch (err) {
            alert("Failed to import: " + err);
          }
        };
        reader.readAsText(file);
    }, []);

    // Initialize Global API
    useGlobalAPI({ config, setConfig, messageMap, headId });

    return (
        <BrainContext.Provider value={{
            config, setConfig, messageMap, setMessageMap, headId, setHeadId,
            currentThread, toolLogs, addToolLog, updateToolLog, clearLogs,
            handleExport, handleImport
        }}>
            {children}
        </BrainContext.Provider>
    );
};

export const useBrain = () => {
    const context = useContext(BrainContext);
    if (!context) throw new Error("useBrain must be used within a BrainProvider");
    return context;
};
