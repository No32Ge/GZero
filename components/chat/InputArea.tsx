import React from 'react';
import { Icons } from '../Icon';
import { AppConfig, AttachedFile, Message } from '../../types';

interface InputAreaProps {
    input: string;
    setInput: (val: string) => void;
    inputMode: 'user' | 'fake_tool';
    setInputMode: (mode: 'user' | 'fake_tool') => void;
    attachments: AttachedFile[];
    onRemoveAttachment: (index: number) => void;
    onAttach: () => void;
    fileInputRef: React.RefObject<HTMLInputElement>;
    handleFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
    handleSend: () => void;
    onStop: () => void;
    isLoading: boolean;
    config: AppConfig;
    selectedToolName: string;
    setSelectedToolName: (name: string) => void;
    fakeArgs: string;
    setFakeArgs: (args: string) => void;
    fakeOutput: string;
    setFakeOutput: (output: string) => void;
    replyingToMessage: Message | null;
    onCancelReply: () => void;
}

export const InputArea: React.FC<InputAreaProps> = ({
    input, setInput,
    inputMode, setInputMode,
    attachments, onRemoveAttachment,
    onAttach, fileInputRef, handleFileSelect,
    handleSend, onStop,
    isLoading,
    config,
    selectedToolName, setSelectedToolName,
    fakeArgs, setFakeArgs,
    fakeOutput, setFakeOutput,
    replyingToMessage,
    onCancelReply
}) => {
    return (
        <div className="p-4 md:p-6 bg-gradient-to-t from-slate-950 via-slate-950 to-transparent">
            <div className="max-w-4xl mx-auto relative shadow-2xl rounded-xl bg-slate-900/90 backdrop-blur border border-slate-700/50 overflow-hidden">

                {/* Mode Tabs */}
                <div className="flex border-b border-slate-800">
                    <button
                        onClick={() => setInputMode('user')}
                        className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors ${inputMode === 'user' ? 'bg-slate-800 text-blue-400' : 'hover:bg-slate-800/50 text-slate-500'}`}
                    >
                        <Icons.MessageSquare /> Message
                    </button>
                    <button
                        onClick={() => setInputMode('fake_tool')}
                        className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors ${inputMode === 'fake_tool' ? 'bg-purple-900/20 text-purple-400' : 'hover:bg-slate-800/50 text-slate-500'}`}
                    >
                        <Icons.Tool /> Fake Tool Output
                    </button>
                </div>

                {inputMode === 'user' ? (
                    <div className="relative">
                        {/* Reply Banner */}
                        {replyingToMessage && (
                            <div className="flex items-center justify-between bg-slate-800/80 border-b border-slate-700/50 p-2 px-3 animate-fadeIn">
                                <div className="flex items-center gap-2 overflow-hidden">
                                    <span className="text-blue-400"><Icons.Reply /></span>
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-bold text-blue-300 uppercase">Replying to {replyingToMessage.role}</span>
                                        <span className="text-xs text-slate-400 truncate max-w-[200px] md:max-w-md">
                                            {replyingToMessage.content || "Function Call / Tool Result"}
                                        </span>
                                    </div>
                                </div>
                                <button onClick={onCancelReply} className="p-1 hover:text-white text-slate-500">
                                    <Icons.X />
                                </button>
                            </div>
                        )}

                        {/* Attachments List */}
                        {attachments.length > 0 && (
                            <div className="flex flex-wrap gap-2 p-2 bg-slate-900 border-b border-slate-800">
                                {attachments.map((file, idx) => (
                                    <div key={idx} className="flex items-center gap-2 bg-slate-800 text-slate-200 text-xs px-2 py-1.5 rounded-md border border-slate-700">
                                        <span className="text-blue-400"><Icons.File /></span>
                                        <span className="max-w-[150px] truncate">{file.name}</span>
                                        <button onClick={() => onRemoveAttachment(idx)} className="text-slate-500 hover:text-red-400 ml-1">
                                            <div className="scale-75"><Icons.X /></div>
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        <textarea
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSend();
                                }
                            }}
                            placeholder={isLoading ? "Generating..." : "Type your message..."}
                            disabled={isLoading}
                            className="w-full bg-transparent text-slate-100 pl-12 pr-14 py-4 focus:outline-none resize-none custom-scrollbar disabled:opacity-50"
                            rows={1}
                            style={{ minHeight: '60px', maxHeight: '200px' }}
                        />

                        {/* Attachment Button */}
                        <div className="absolute left-3 top-1/2 -translate-y-1/2">
                            <button
                                onClick={onAttach}
                                disabled={isLoading}
                                className="p-2 text-slate-500 hover:text-blue-400 transition-colors disabled:opacity-30"
                                title="Attach files (Text or Zip)"
                            >
                                <Icons.Paperclip />
                            </button>
                            <input
                                type="file"
                                ref={fileInputRef}
                                className="hidden"
                                multiple
                                onChange={handleFileSelect}
                            />
                        </div>

                        {/* Stop / Send Button Swap */}
                        {isLoading ? (
                            <button
                                onClick={onStop}
                                className="absolute right-3 top-1/2 -translate-y-1/2 p-2.5 bg-red-600 rounded-lg hover:bg-red-500 transition-all text-white shadow-lg shadow-red-900/20 animate-fadeIn"
                                title="Stop generating"
                            >
                                <Icons.Stop />
                            </button>
                        ) : (
                            <button
                                onClick={handleSend}
                                disabled={(!input.trim() && attachments.length === 0)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 p-2.5 bg-blue-600 rounded-lg hover:bg-blue-500 disabled:opacity-30 disabled:hover:bg-blue-600 transition-all text-white shadow-lg shadow-blue-900/20"
                            >
                                <Icons.Send />
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="p-4 bg-purple-900/5">
                        {config.tools.length === 0 ? (
                            <div className="text-center py-4 text-xs text-slate-500">
                                No registered tools found. Please add tools in the sidebar first.
                            </div>
                        ) : (
                            <div className="space-y-3">
                                <div>
                                    <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Select Tool</label>
                                    <select
                                        value={selectedToolName}
                                        onChange={(e) => setSelectedToolName(e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-2 text-xs text-white outline-none focus:border-purple-500"
                                    >
                                        {config.tools.map(t => (
                                            <option key={t.id} value={t.definition.name}>{t.definition.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Fake Arguments (JSON)</label>
                                        <textarea
                                            value={fakeArgs}
                                            onChange={(e) => setFakeArgs(e.target.value)}
                                            className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-2 text-xs font-mono text-orange-200 outline-none focus:border-purple-500 h-20 resize-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Fake Output (JSON/String)</label>
                                        <textarea
                                            value={fakeOutput}
                                            onChange={(e) => setFakeOutput(e.target.value)}
                                            className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-2 text-xs font-mono text-green-400 outline-none focus:border-purple-500 h-20 resize-none"
                                        />
                                    </div>
                                </div>
                                <button
                                    onClick={handleSend}
                                    disabled={isLoading || !selectedToolName}
                                    className="w-full bg-purple-600 hover:bg-purple-500 text-white py-2 rounded text-xs font-bold uppercase tracking-wide transition-colors"
                                >
                                    Inject & Run
                                </button>
                            </div>
                        )}
                    </div>
                )}

            </div>
            <div className="text-center mt-2 text-[10px] text-slate-600">
                {inputMode === 'user' ? 'Press Enter to send' : 'Injects fake history and triggers model response'}
            </div>
        </div>
    );
};