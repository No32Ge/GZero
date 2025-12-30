import React, { useEffect, useRef, useState } from 'react';
import Editor, { OnMount } from '@monaco-editor/react';
import { VirtualFile } from '../../types';
import { Icons } from '../Icon';
import { useFileStore } from '../../stores/useFileStore';

interface CodeEditorProps {
    file: VirtualFile | null;
    onSave: (id: string, newContent: string) => void;
    onClose: () => void;
}

export const CodeEditor: React.FC<CodeEditorProps> = ({ file, onSave, onClose }) => {
    const files = useFileStore(s => s.files);
    const editorRef = useRef<any>(null);
    const monacoRef = useRef<any>(null);
    const [isDirty, setIsDirty] = useState(false);

    // 监听文件内容变化（当从外部修改文件时更新 dirty 状态）
    useEffect(() => {
        setIsDirty(false);
    }, [file?.id, file?.content]);

    // 【核心修复】：同步所有文件到 Monaco 模型系统
    useEffect(() => {
        if (!monacoRef.current || !files) return;
        const monaco = monacoRef.current;

        // 遍历所有虚拟文件，注册为 Monaco Model
        files.forEach(f => {
            // 创建标准 URI。注意：这里必须与下方 Editor 组件的 path 属性逻辑一致
            // path="/src/App.tsx" -> file:///src/App.tsx
            const uri = monaco.Uri.parse(`file:///${f.path}`);
            let model = monaco.editor.getModel(uri);

            if (!model) {
                // 如果模型不存在，创建它
                model = monaco.editor.createModel(
                    f.content,
                    undefined, // 自动推断语言
                    uri
                );
            } else {
                // 如果模型已存在，且内容不一致（比如 AI 在后台修改了文件），则更新模型
                // 注意：为了避免光标跳动，通常我们只在非当前编辑文件或内容确实改变时更新
                if (model.getValue() !== f.content) {
                    model.setValue(f.content);
                }
            }
        });
    }, [files]); // 依赖全局文件列表的变化

    const handleEditorDidMount: OnMount = (editor, monaco) => {
        editorRef.current = editor;
        monacoRef.current = monaco;

        // 【核心修复】：配置 TypeScript 编译器
        monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
            target: monaco.languages.typescript.ScriptTarget.ES2020,
            allowNonTsExtensions: true,
            moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
            module: monaco.languages.typescript.ModuleKind.CommonJS,
            noEmit: true,
            jsx: monaco.languages.typescript.JsxEmit.React,
            reactNamespace: 'React',
            allowSyntheticDefaultImports: true,
            // 添加以下两行以支持绝对路径和目录索引
            baseUrl: '/', 
            paths: { "*": ["*"] } 
        });

        // 立即触发一次模型同步，确保初始加载时所有文件都在内存中
        files.forEach(f => {
             const uri = monaco.Uri.parse(`file:///${f.path}`);
             if (!monaco.editor.getModel(uri)) {
                 monaco.editor.createModel(f.content, undefined, uri);
             }
        });

        // 绑定保存快捷键
        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
            // 使用 editorRef.current 获取最新状态
            if (file) { // 这里闭包可能捕获旧的 file，但在 React 重新渲染后会更新
                // 更好的做法是直接从 editor 获取 model uri 反查，但为了简化：
                // 这里的 file 依赖于组件的重新渲染，由于移除了 key，需要确保 props 更新
                onSave(file.id, editor.getValue());
                setIsDirty(false);
            }
        });
    };
    
    // 由于移除了 key，我们需要手动处理 Save Command 里的闭包问题
    // 或者简单地，每次 file id 变化时重新绑定 command 是不现实的
    // 最好的方式是使用 ref 追踪当前的 fileId
    const currentFileIdRef = useRef<string | null>(null);
    useEffect(() => {
        currentFileIdRef.current = file?.id || null;
    }, [file?.id]);

    // 重新覆盖 handleEditorDidMount 中的保存逻辑（更稳健的写法）
    useEffect(() => {
        if (!editorRef.current || !monacoRef.current) return;
        const editor = editorRef.current;
        const monaco = monacoRef.current;
        
        // 重新添加 Command 以捕获最新的 onSave
        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
             if (currentFileIdRef.current) {
                 onSave(currentFileIdRef.current, editor.getValue());
                 setIsDirty(false);
             }
        });
    }, [file?.id, onSave]); // 当文件ID变化时刷新命令绑定


    if (!file) {
        return (
            <div className="flex-1 bg-[#1e1e1e] flex flex-col items-center justify-center text-slate-500 gap-3 select-none">
                <div className="scale-150 opacity-30"><Icons.File /></div>
                <p className="text-sm font-medium">Select a file to edit</p>
            </div>
        );
    }

    const getLanguage = (path: string) => {
        const p = path.toLowerCase();
        if (p.endsWith('.tsx') || p.endsWith('.ts')) return 'typescript';
        if (p.endsWith('.js') || p.endsWith('.jsx')) return 'javascript';
        if (p.endsWith('.css')) return 'css';
        if (p.endsWith('.json')) return 'json';
        if (p.endsWith('.html')) return 'html';
        return 'plaintext';
    };

    return (
        <div className="flex-1 flex flex-col h-full bg-[#1e1e1e] min-w-0 overflow-hidden">
            {/* Header */}
            <div className="h-9 bg-[#1e1e1e] border-b border-[#333] flex items-center justify-between px-3 select-none shrink-0">
                <div className="flex items-center gap-2 max-w-[70%] text-slate-400">
                    <Icons.File />
                    <span className="text-xs text-slate-300 font-mono truncate" title={file.path}>
                        {file.name}
                    </span>
                    {isDirty && <div className="w-2 h-2 rounded-full bg-blue-500" title="Unsaved changes" />}
                </div>
                <div className="flex items-center gap-2">
                    {isDirty && (
                        <span className="text-[10px] text-slate-500 italic hidden md:block">
                            Cmd+S to save
                        </span>
                    )}
                    <button onClick={onClose} className="p-1 hover:bg-white/10 rounded text-slate-400 transition-colors">
                        <Icons.X />
                    </button>
                </div>
            </div>

            {/* Monaco Editor */}
            <div className="flex-1 relative">
                <Editor
                    height="100%"
                    theme="vs-dark"
                    // 确保 path 属性与上面手动创建 Model 的 URI 逻辑一致
                    path={`/${file.path}`} 
                    defaultLanguage={getLanguage(file.path)}
                    // 移除 defaultValue，因为我们希望通过 path 自动加载对应的 Model
                    // 并且我们已经手动同步了 Model 的 value
                    value={file.content} 
                    onChange={(val) => setIsDirty(val !== file.content)}
                    onMount={handleEditorDidMount}
                    options={{
                        minimap: { enabled: false },
                        fontSize: 13,
                        lineHeight: 22,
                        padding: { top: 16 },
                        fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
                        scrollBeyondLastLine: false,
                        automaticLayout: true,
                        tabSize: 2,
                    }}
                />
            </div>
        </div>
    );
};