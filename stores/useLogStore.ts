import { create } from 'zustand';
import { ConsoleLog } from '../types';

interface LogState {
    logs: ConsoleLog[];
    isConsoleOpen: boolean;
    
    addLog: (type: 'info' | 'warn' | 'error', content: any[]) => void;
    clearLogs: () => void;
    toggleConsole: () => void;
    setConsoleOpen: (open: boolean) => void;
}

export const useLogStore = create<LogState>((set) => ({
    logs: [],
    isConsoleOpen: false,

    addLog: (type, content) => set((state) => ({
        logs: [...state.logs, {
            id: crypto.randomUUID(),
            type,
            content: content.map(c => {
                if (typeof c === 'object') {
                    try { return JSON.stringify(c, null, 2); } catch { return '[Object]'; }
                }
                return String(c);
            }),
            timestamp: Date.now()
        }]
    })),

    clearLogs: () => set({ logs: [] }),
    
    toggleConsole: () => set((s) => ({ isConsoleOpen: !s.isConsoleOpen })),
    setConsoleOpen: (open) => set({ isConsoleOpen: open }),
}));