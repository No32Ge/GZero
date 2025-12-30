
import React, { useState } from 'react';
import { Message, ToolCall, ModelConfig } from '../../types';
import { Icons } from '../Icon';
import { ToolExecutor } from './ToolExecutor';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MessageItemProps {
    msg: Message;
    messageMap: Record<string, Message>;
    currentThread: Message[];
    activeModel?: ModelConfig;
    isLoading: boolean;
    onRegenerate: (id: string) => void;
    onBranchNav: (id: string, dir: 'prev' | 'next') => void;
    onToolExecute: (callId: string, result: string) => void;
    onReply: (id: string) => void;
    onEdit: (id: string) => void;
}

const CopyButton: React.FC<{ text: string }> = ({ text }) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <button
            onClick={handleCopy}
            className="text-slate-400 hover:text-white transition-colors"
            title="Copy code"
        >
            {copied ? <span className="text-green-400"><Icons.Check /></span> : <Icons.Copy />}
        </button>
    );
};

export const MessageItem: React.FC<MessageItemProps> = ({
    msg,
    messageMap,
    currentThread,
    activeModel,
    isLoading,
    onRegenerate,
    onBranchNav,
    onToolExecute,
    onReply,
    onEdit
}) => {
    const parent = msg.parentId ? messageMap[msg.parentId] : null;
    const siblingCount = parent ? parent.childrenIds.length : 0;
    const currentSiblingIndex = parent ? parent.childrenIds.indexOf(msg.id) : 0;
    const referencedMsg = msg.referencedMessageId ? messageMap[msg.referencedMessageId] : null;

    // Determine if message is editable (User message or Tool/FakeTool related)
    const isEditable = msg.parentId && (
        msg.role === 'user' || 
        msg.role === 'tool' || 
        (msg.role === 'model' && msg.toolCalls && msg.toolCalls.length > 0)
    );

    return (
        <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} group animate-slideUp relative`}>
            <div className={`max-w-[min(90vw,700px)] md:max-w-[min(80vw,700px)] lg:max-w-[min(70vw,700px)] rounded-2xl p-5 shadow-sm relative ${msg.role === 'user'
                ? 'bg-gradient-to-br from-blue-600 to-blue-700 text-white rounded-tr-sm'
                : msg.role === 'tool'
                    ? 'bg-slate-900 border border-slate-800 text-slate-300 rounded-lg w-full'
                    : 'bg-slate-800 text-slate-100 rounded-tl-sm border border-slate-700/50'
                }`}>

                {/* Branch Navigation */}
                {siblingCount > 1 && (
                    <div className="absolute -top-3 left-0 right-0 flex justify-center z-10">
                        <div className="bg-slate-800 border border-slate-700 rounded-full px-2 py-0.5 flex items-center gap-2 text-[10px] text-slate-400 shadow-md">
                            <button
                                onClick={() => onBranchNav(msg.id, 'prev')}
                                disabled={currentSiblingIndex === 0}
                                className="hover:text-white disabled:opacity-30"
                            >
                                <Icons.ChevronLeft />
                            </button>
                            <span className="font-mono">{currentSiblingIndex + 1} / {siblingCount}</span>
                            <button
                                onClick={() => onBranchNav(msg.id, 'next')}
                                disabled={currentSiblingIndex === siblingCount - 1}
                                className="hover:text-white disabled:opacity-30"
                            >
                                <Icons.ChevronRight />
                            </button>
                        </div>
                    </div>
                )}

                {/* Role Label for Non-User */}
                {msg.role !== 'user' && (
                    <div className="text-[10px] font-bold uppercase tracking-wider mb-2 opacity-50 flex items-center gap-2">
                        {msg.role === 'model'
                            ? (msg.toolCalls && msg.toolCalls.length > 0
                                ? <><Icons.Tool /> Tool Request</>
                                : <><Icons.Brain /> {activeModel?.name || 'Model'}</>)
                            : <><Icons.Tool /> Tool Result</>}
                    </div>
                )}

                {/* Referenced Message Display */}
                {referencedMsg && (
                    <div className="mb-3 text-xs border-l-2 border-white/30 pl-3 py-1 bg-black/10 rounded-r">
                        <div className="font-bold text-[10px] uppercase opacity-60 mb-1 flex items-center gap-1">
                            <Icons.Reply /> Reply to {referencedMsg.role}
                        </div>
                        <div className="opacity-70 line-clamp-2 italic">
                            {referencedMsg.content || (referencedMsg.toolCalls ? "Function Call..." : "...")}
                        </div>
                    </div>
                )}

                {/* Content with Markdown */}
                {msg.content && (
                    <div className="prose prose-invert prose-sm max-w-none leading-7 text-sm break-words">
                        <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                                code({ node, inline, className, children, ...props }: any) {
                                    const match = /language-(\w+)/.exec(className || '');
                                    return !inline && match ? (
                                        <div className="relative my-4 rounded-lg overflow-hidden border border-slate-700/50 bg-slate-950">
                                            <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900 border-b border-slate-800">
                                                <span className="text-[10px] uppercase font-mono text-slate-400">{match[1]}</span>
                                                <CopyButton text={String(children).replace(/\n$/, '')} />
                                            </div>
                                            <div className="p-4 overflow-x-auto">
                                                <pre className="whitespace-pre-wrap break-words break-all overflow-x-auto w-full max-w-full">
                                                    <code className={`!bg-transparent text-sm font-mono block w-full ${className}`} {...props}>
                                                        {children}
                                                    </code>
                                                </pre>
                                            </div>
                                        </div>
                                    ) : (
                                        <code className="bg-slate-700/40 rounded px-1.5 py-0.5 text-xs font-mono text-slate-200" {...props}>
                                            {children}
                                        </code>
                                    );
                                },
                                a: ({ node, ...props }) => <a className="text-blue-400 hover:text-blue-300 underline underline-offset-4" target="_blank" rel="noopener noreferrer" {...props} />,
                                table: ({ node, ...props }) => <div className="overflow-x-auto my-4 rounded-lg border border-slate-700"><table className="w-full text-left" {...props} /></div>,
                                thead: ({ node, ...props }) => <thead className="bg-slate-900/50 text-slate-200" {...props} />,
                                th: ({ node, ...props }) => <th className="p-3 text-xs font-bold uppercase tracking-wider border-b border-slate-700" {...props} />,
                                td: ({ node, ...props }) => <td className="p-3 border-b border-slate-800 text-slate-300" {...props} />,
                                blockquote: ({ node, ...props }) => <blockquote className="border-l-2 border-blue-500 pl-4 italic my-4 text-slate-400" {...props} />,
                            }}
                        >
                            {msg.content}
                        </ReactMarkdown>
                    </div>
                )}

                {/* Tool Calls Rendering */}
                {msg.role === 'model' && msg.toolCalls?.map((tc, idx) => {
                    // Check if answered by looking ahead in current thread
                    const nextMsgIndex = currentThread.findIndex(m => m.id === msg.id) + 1;
                    const nextMsg = currentThread[nextMsgIndex];

                    // Robust check: Does the next message contain a result for THIS specific call ID?
                    const isAnswered = nextMsg && nextMsg.role === 'tool' && nextMsg.toolResults?.some(tr => tr.callId === tc.id);

                    // Helper to render args nicely whether string or object
                    const renderArgs = (args: any) => {
                        if (typeof args === 'string') {
                            // Streaming mode: Show raw string nicely
                            return <span className="text-orange-200 whitespace-pre-wrap break-all">{args}</span>;
                        }
                        // Completed object mode: Show stringified JSON
                        return <span className="text-orange-200">{JSON.stringify(args)}</span>;
                    };

                    return (
                        <div key={idx} className="mt-4 bg-slate-950/50 rounded-lg p-4 border border-purple-500/30 overflow-hidden">
                            <div className="flex items-center gap-2 text-purple-400 text-xs font-bold uppercase mb-2">
                                <Icons.Tool /> {isAnswered ? "Call History" : "Function Call"}
                            </div>
                            <div className="text-xs font-mono text-slate-400 mb-3 bg-slate-950 p-2 rounded">
                                <span className="text-purple-300 font-bold">{tc.name}</span>
                                <span className="text-slate-500">(</span>
                                {renderArgs(tc.args)}
                                <span className="text-slate-500">)</span>
                            </div>
                            <div className="text-[10px] text-slate-600 mb-2 font-mono">ID: {tc.id}</div>
                            {!isAnswered ? (
                                <ToolExecutor
                                    callId={tc.id}
                                    name={tc.name}
                                    onExecute={(res) => onToolExecute(tc.id, res)}
                                />
                            ) : (
                                <div className="text-[10px] text-green-500 flex items-center gap-1.5 bg-green-500/10 px-2 py-1 rounded w-fit">
                                    <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span> Executed
                                </div>
                            )}
                        </div>
                    );
                })}

                {/* Tool Result Rendering */}
                {msg.role === 'tool' && msg.toolResults?.map((tr, idx) => (
                    <div key={idx} className="mt-2">
                        <div className="text-[10px] text-slate-500 mb-1 font-mono">Result for ID: {tr.callId}</div>
                        <div className="font-mono text-xs text-green-400 bg-slate-950 p-3 rounded border border-slate-800/50 overflow-x-auto">
                            <span className="opacity-50 select-none mr-2">{'> '}</span>{tr.result}
                        </div>
                    </div>
                ))}

                <div className="text-[10px] opacity-30 mt-3 flex justify-end items-center gap-3">
                    <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        {/* Edit Button */}
                        {isEditable && !isLoading && (
                            <button
                                onClick={() => onEdit(msg.id)}
                                className="hover:text-white transition-colors flex items-center gap-1"
                                title="Edit & Branch"
                            >
                                <Icons.Edit />
                            </button>
                        )}

                         <button
                            onClick={() => onReply(msg.id)}
                            className="hover:text-white transition-colors flex items-center gap-1"
                            title="Reply to this message"
                        >
                            <Icons.Reply />
                        </button>
                        {msg.role === 'model' && !isLoading && (
                            <button
                                onClick={() => onRegenerate(msg.id)}
                                className="hover:text-white transition-colors flex items-center gap-1"
                                title="Regenerate Response"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" /></svg>
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
