export {};

declare global {
    interface Window {
        GeBrain: {
            // Configuration & System
            getConfig: () => any;
            getSystemPrompt: () => string;
            updateSystemPrompt: (prompt: string) => any;
            appendSystemPrompt: (prompt: string) => any;

            // Memory & History
            getConversationHistory: () => any[];
            addMemory: (name: string, content: string) => any;
            
            // File System (Updated to Promise for Local I/O)
            listFiles: () => any[];
            readFile: (path: string) => any; // Keep sync for read if possible, or make async if needed. Currently read from store is sync.
            writeFile: (path: string, content: string) => Promise<any>; // Changed to Promise
            deleteFile: (path: string) => Promise<any>; // Changed to Promise
            
            // Tools
            getTools: () => any[];
            registerTool: (def: any, impl: string, auto: boolean) => any;
            removeTool: (name: string) => any;
            toggleTool: (name: string, active: boolean) => any;
            getToolDetails: (name: string) => any;
        };
        // For File System Access API types if not automatically detected
        showDirectoryPicker: (options?: any) => Promise<FileSystemDirectoryHandle>;
    }
}