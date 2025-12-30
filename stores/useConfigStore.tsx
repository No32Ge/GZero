import { create } from 'zustand';
import { ModelConfig, VirtualMemory, UserTool } from '../types';
import { DEFAULT_CONFIG } from '../config'; 

interface ConfigState {
  // --- State (数据) ---
  activeModelId: string;
  models: ModelConfig[];
  systemPrompt: string;
  env: Record<string, string>;
  memories: VirtualMemory[]; // [新增]
  tools: UserTool[];         // [新增]

  // --- Actions (修改数据的方法) ---
  setActiveModelId: (id: string) => void;
  setSystemPrompt: (prompt: string) => void;
  
  // Model CRUD
  addModel: (model: ModelConfig) => void;
  updateModel: (id: string, updates: Partial<ModelConfig>) => void;
  deleteModel: (id: string) => void;

  // Env CRUD
  setEnv: (key: string, value: string) => void;
  removeEnv: (key: string) => void;

  // [新增] Memory CRUD
  addMemory: (memory: VirtualMemory) => void;
  toggleMemory: (id: string) => void;
  deleteMemory: (id: string) => void;

  // [新增] Tool CRUD
  addTool: (tool: UserTool) => void;
  updateTool: (id: string, tool: Partial<UserTool>) => void; // 支持部分更新
  toggleTool: (id: string) => void;
  deleteTool: (id: string) => void;
  
  // Dev Helper: 一键重置（既然是开发阶段，加个重置方法很方便）
  resetConfig: () => void;
}

export const useConfigStore = create<ConfigState>((set) => ({
  // 1. 初始化状态 (直接使用 DEFAULT_CONFIG)
  activeModelId: DEFAULT_CONFIG.activeModelId,
  models: DEFAULT_CONFIG.models,
  systemPrompt: DEFAULT_CONFIG.systemPrompt,
  env: DEFAULT_CONFIG.env,
  memories: DEFAULT_CONFIG.memories, // [新增]
  tools: DEFAULT_CONFIG.tools,       // [新增]

  // 2. Actions 实现
  setActiveModelId: (id) => set({ activeModelId: id }),
  
  setSystemPrompt: (prompt) => set({ systemPrompt: prompt }),

  addModel: (model) => set((state) => ({ 
    models: [...state.models, model],
    activeModelId: state.models.length === 0 ? model.id : state.activeModelId 
  })),

  updateModel: (id, updates) => set((state) => ({
    models: state.models.map((m) => m.id === id ? { ...m, ...updates } : m)
  })),

  deleteModel: (id) => set((state) => {
    const newModels = state.models.filter((m) => m.id !== id);
    let newActiveId = state.activeModelId;
    // 如果删除了当前激活的模型，切回第一个，或者空
    if (state.activeModelId === id) {
         newActiveId = newModels.length > 0 ? newModels[0].id : '';
    }
    return { models: newModels, activeModelId: newActiveId };
  }),

  setEnv: (key, value) => set((state) => ({
    env: { ...state.env, [key]: value }
  })),

  removeEnv: (key) => set((state) => {
    const newEnv = { ...state.env };
    delete newEnv[key];
    return { env: newEnv };
  }),

  // [新增] Memory Logic
  addMemory: (memory) => set((state) => ({ memories: [...state.memories, memory] })),
  toggleMemory: (id) => set((state) => ({
    memories: state.memories.map(m => m.id === id ? { ...m, active: !m.active } : m)
  })),
  deleteMemory: (id) => set((state) => ({
    memories: state.memories.filter(m => m.id !== id)
  })),

  // [新增] Tool Logic
  addTool: (tool) => set((state) => ({ tools: [...state.tools, tool] })),
  updateTool: (id, updates) => set((state) => ({
    tools: state.tools.map(t => t.id === id ? { ...t, ...updates } : t)
  })),
  toggleTool: (id) => set((state) => ({
    tools: state.tools.map(t => t.id === id ? { ...t, active: !t.active } : t)
  })),
  deleteTool: (id) => set((state) => ({
    tools: state.tools.filter(t => t.id !== id)
  })),

  resetConfig: () => set({ ...DEFAULT_CONFIG })
}));