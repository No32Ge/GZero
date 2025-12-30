// src/config/index.ts
import { AppConfig } from '../types';
import { SYSTEM_PROMPT } from './prompts';
import { INITIAL_FILES } from './templates';
import { SYSTEM_TOOLS } from './tools';



export const DEFAULT_CONFIG: AppConfig = {
    activeModelId: 'default-gemini',
    models: [
        {
            id: 'default-gemini',
            name: 'Gemini 2.5 Flash',
            provider: 'gemini',
            modelId: 'gemini-2.5-flash',
            apiKey: '' // 用户需手动填入或从本地存储加载
        }
    ],
    systemPrompt: SYSTEM_PROMPT,
    memories: [],
    files: INITIAL_FILES,
    tools: SYSTEM_TOOLS,
    env: {},
};