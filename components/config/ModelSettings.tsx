import React, { useState } from 'react';
import { ModelConfig } from '../../types';
import { Icons } from '../Icon';
import { useConfigStore } from '../../stores/useConfigStore';

// --- 修复 1: 添加兼容的 ID 生成函数 (解决 crypto.randomUUID 报错) ---
const generateId = (): string => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    // 回退方案：手动生成 UUID
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};

export const ModelSettings: React.FC = () => {
    const models = useConfigStore(s => s.models);
    const activeModelId = useConfigStore(s => s.activeModelId);
    
    const setActiveModelId = useConfigStore(s => s.setActiveModelId);
    const addModel = useConfigStore(s => s.addModel);
    const updateModel = useConfigStore(s => s.updateModel);
    const deleteModel = useConfigStore(s => s.deleteModel);

    const [editingModelId, setEditingModelId] = useState<string | null>(null);
    const [editModelForm, setEditModelForm] = useState<Partial<ModelConfig>>({});

    const handleEditModel = (model: ModelConfig) => {
        setEditingModelId(model.id);
        setEditModelForm({...model});
    };

    const handleCreateModel = () => {
        // --- 修复: 使用 generateId() 替代 crypto.randomUUID() ---
        const newId = generateId();
        const newModel: ModelConfig = {
            id: newId,
            name: 'New Model',
            provider: 'openai', // 默认设为 openai，或者你可以改为 'gemini'
            modelId: 'gpt-4o',
            apiKey: '',
            baseUrl: 'https://api.openai.com/v1'
        };
        setEditingModelId(newId);
        setEditModelForm(newModel);
    };

    const handleSaveModel = () => {
        if (!editModelForm.name || !editModelForm.apiKey || !editModelForm.modelId) {
            alert("Name, Model ID, and API Key are required.");
            return;
        }
        
        if (editingModelId) {
            const exists = models.find(m => m.id === editingModelId);
            if (exists) {
                updateModel(editingModelId, editModelForm);
            } else {
                addModel({ ...editModelForm, id: editingModelId } as ModelConfig);
            }
        }
        
        setEditingModelId(null);
        setEditModelForm({});
    };

    const handleDeleteModel = (id: string) => {
        if (models.length <= 1) {
            alert("You must have at least one model configured.");
            return;
        }
        deleteModel(id);
    };

    return (
        <div className="space-y-4 animate-fadeIn">
            {editingModelId ? (
                <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700 space-y-3">
                    <h3 className="text-xs font-bold text-white mb-2">{editModelForm.id ? 'Edit Model' : 'New Model'}</h3>
                    
                    <div>
                        <label className="text-[10px] uppercase text-slate-500 font-bold block mb-1">Display Name</label>
                        <input 
                            value={editModelForm.name || ''} 
                            onChange={e => setEditModelForm(prev => ({...prev, name: e.target.value}))}
                            className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1.5 text-xs text-white focus:border-blue-500 outline-none"
                        />
                    </div>

                    <div>
                        <label className="text-[10px] uppercase text-slate-500 font-bold block mb-1">Provider</label>
                        {/* --- 修复 2: 添加了 <option> 标签 --- */}
                        <select 
                            value={editModelForm.provider || 'openai'} 
                            onChange={e => setEditModelForm(prev => ({...prev, provider: e.target.value as any}))}
                            className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1.5 text-xs text-white focus:border-blue-500 outline-none"
                        >
                            <option value="openai">OpenAI / Compatible</option>
                            <option value="gemini">Google Gemini</option>
                            {/* 如果你需要更多选项，可以在这里添加，例如： */}
                            {/* <option value="anthropic">Anthropic</option> */}
                            {/* <option value="ollama">Ollama</option> */}
                        </select>
                    </div>

                    <div>
                        <label className="text-[10px] uppercase text-slate-500 font-bold block mb-1">Model ID</label>
                        <input 
                            value={editModelForm.modelId || ''} 
                            onChange={e => setEditModelForm(prev => ({...prev, modelId: e.target.value}))}
                            // 根据当前选择的 provider 动态提示
                            placeholder={editModelForm.provider === 'gemini' ? "gemini-2.5-flash" : "gpt-4o"}
                            className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1.5 text-xs text-white focus:border-blue-500 outline-none"
                        />
                    </div>

                    {/* 只有 OpenAI (或者兼容协议) 才显示 Base URL 设置 */}
                    {editModelForm.provider === 'openai' && (
                        <div>
                            <label className="text-[10px] uppercase text-slate-500 font-bold block mb-1">Base URL</label>
                            <input 
                                value={editModelForm.baseUrl || ''} 
                                onChange={e => setEditModelForm(prev => ({...prev, baseUrl: e.target.value}))}
                                placeholder="https://api.openai.com/v1"
                                className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1.5 text-xs text-white focus:border-blue-500 outline-none"
                            />
                        </div>
                    )}

                    <div>
                        <label className="text-[10px] uppercase text-slate-500 font-bold block mb-1">API Key</label>
                        <input 
                            type="password"
                            value={editModelForm.apiKey || ''} 
                            onChange={e => setEditModelForm(prev => ({...prev, apiKey: e.target.value}))}
                            className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1.5 text-xs text-white focus:border-blue-500 outline-none"
                        />
                    </div>

                    <div className="flex gap-2 pt-2">
                        <button onClick={handleSaveModel} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold py-2 rounded">Save</button>
                        <button onClick={() => { setEditingModelId(null); setEditModelForm({}); }} className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-bold py-2 rounded">Cancel</button>
                    </div>
                </div>
            ) : (
                <>
                    <div className="space-y-2">
                        {models.map(m => (
                            <div 
                                key={m.id} 
                                className={`p-3 rounded-lg border transition-all cursor-pointer ${
                                    activeModelId === m.id 
                                    ? 'bg-blue-900/20 border-blue-500/50 ring-1 ring-blue-500/20' 
                                    : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                                }`}
                                onClick={() => setActiveModelId(m.id)}
                            >
                                <div className="flex justify-between items-center mb-1">
                                    <div className="flex items-center gap-2">
                                        <div className={`w-3 h-3 rounded-full border-2 ${activeModelId === m.id ? 'border-blue-500 bg-blue-500' : 'border-slate-600'}`}></div>
                                        <span className="text-xs font-bold text-slate-200">{m.name}</span>
                                    </div>
                                    <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                                        <button onClick={() => handleEditModel(m)} className="p-1.5 text-slate-500 hover:text-blue-400 rounded hover:bg-slate-800"><Icons.Settings /></button>
                                        <button onClick={() => handleDeleteModel(m.id)} className="p-1.5 text-slate-500 hover:text-red-400 rounded hover:bg-slate-800"><Icons.Trash /></button>
                                    </div>
                                </div>
                                <div className="pl-5 text-[10px] text-slate-500 font-mono truncate">
                                    {m.modelId} • {m.provider}
                                </div>
                            </div>
                        ))}
                    </div>
                    <button 
                        onClick={handleCreateModel}
                        className="w-full py-2 border-2 border-dashed border-slate-800 text-slate-500 text-xs font-bold rounded-lg hover:border-blue-500/50 hover:text-blue-400 transition-colors flex items-center justify-center gap-2"
                    >
                        <Icons.Plus /> Add Model
                    </button>
                </>
            )}
        </div>
    );
};