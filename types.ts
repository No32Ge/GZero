import { FunctionDeclaration } from "@google/genai";

// App Logic Types
export interface VirtualMemory {
    id: string;
    name: string;
    content: string;
    active: boolean;
}

// 虚拟文件类型
export interface VirtualFile {
    id: string;
    path: string; 
    name: string; 
    content: string;
    language?: string;
    lastModified?: number;
    inContext?: boolean; 
}

export interface UserTool {
    id: string;
    definition: FunctionDeclaration;
    active: boolean;
    implementation?: string; 
    autoExecute?: boolean; 
}

export type ModelProvider = 'gemini' | 'openai';

export interface ModelConfig {
    id: string;
    name: string;
    provider: ModelProvider;
    modelId: string;
    apiKey: string;
    baseUrl?: string;
}

export interface AppConfig {
    activeModelId: string;
    models: ModelConfig[];
    systemPrompt: string;
    memories: VirtualMemory[];
    files: VirtualFile[]; 
    tools: UserTool[];
    env: Record<string, string>;
}

export interface ToolCall {
    id: string;
    name: string;
    args: any;
}

export interface ToolLog {
    id: string;
    toolName: string;
    callId: string;
    status: 'pending' | 'running' | 'success' | 'error';
    startTime: number;
    endTime?: number;
    duration?: number;
    args: any;
    result?: any;
    error?: string;
    consoleLogs: string[];
    envSnapshot?: Record<string, string>;
}

export interface Message {
    id: string;
    role: 'user' | 'model' | 'tool';
    content?: string;
    referencedMessageId?: string;
    toolCalls?: ToolCall[];
    toolResults?: {
        callId: string;
        result: string;
        isError?: boolean;
    }[];
    timestamp: number;
    parentId: string | null;
    childrenIds: string[];
}

export interface ConversationState {
    config: AppConfig;
    messageMap: Record<string, Message>;
    headId: string | null;
}

export interface AttachedFile {
    name: string;
    content: string;
}

// [新增] 控制台日志类型
export interface ConsoleLog {
    id: string;
    type: 'info' | 'warn' | 'error';
    content: string[];
    timestamp: number;
}