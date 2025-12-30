import React, { useState } from 'react';

export const ToolExecutor: React.FC<{ callId: string, name: string, onExecute: (result: string) => void }> = ({ callId, name, onExecute }) => {
    const [result, setResult] = useState('');

    return (
        <div className="flex flex-col gap-2 mt-2">
            <input
                className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-slate-200 focus:border-purple-500 outline-none font-mono"
                placeholder='Enter JSON result... e.g. {"temperature": 22}'
                value={result}
                onChange={(e) => setResult(e.target.value)}
            />
            <button
                onClick={() => onExecute(result)}
                className="self-end bg-purple-700 hover:bg-purple-600 text-white px-4 py-1.5 rounded text-xs font-medium transition-colors"
            >
                Submit Result
            </button>
        </div>
    )
}