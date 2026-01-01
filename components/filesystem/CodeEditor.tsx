
import React, { useEffect, useRef, useState } from 'react';
import Editor, { OnMount } from '@monaco-editor/react';
import { VirtualFile } from '../../types';
import { Icons } from '../Icon';
import { useFileStore } from '../../stores/useFileStore';
import { extractDependencies, injectLibraryTypes } from '../../utils/typeAcquisition';
import { normalizePath } from '../../utils/fileSystem';

interface CodeEditorProps {
    file: VirtualFile | null;
    onSave: (id: string, newContent: string) => void;
    onClose: () => void;
}

export const CodeEditor: React.FC<CodeEditorProps> = ({ file, onSave, onClose }) => {
    const files = useFileStore(s => s.files); // 获取所有文件以建立上下文
    
    const editorRef = useRef<any>(null);
    const monacoRef = useRef<any>(null);
    const [isDirty, setIsDirty] = useState(false);
    const [isATARunning, setIsATARunning] = useState(false);

    // 1. 初始化 TypeScript 编译器配置 & 依赖注入
    const handleEditorDidMount: OnMount = async (editor, monaco) => {
        editorRef.current = editor;
        monacoRef.current = monaco;

        // 配置 TS 编译器选项 (LSP 核心)
        const compilerOptions = {
            target: monaco.languages.typescript.ScriptTarget.ES2020,
            allowNonTsExtensions: true, // 允许解析 .ts/.tsx
            moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
            module: monaco.languages.typescript.ModuleKind.CommonJS,
            noEmit: true, // 只做类型检查，不输出
            jsx: monaco.languages.typescript.JsxEmit.React,
            reactNamespace: 'React',
            allowSyntheticDefaultImports: true,
            typeRoots: ["node_modules/@types"],
            // 【关键】配置 BaseUrl 和 Paths 以支持绝对路径导入
            baseUrl: '/',
            paths: {
                "*": ["*"]
            }
        };

        monaco.languages.typescript.typescriptDefaults.setCompilerOptions(compilerOptions);
        monaco.languages.typescript.javascriptDefaults.setCompilerOptions(compilerOptions);
        
        // 绑定保存快捷键
        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
             // 触发外部保存逻辑 (通过 Ref 或 event 传递)
             // 由于闭包问题，这里建议触发一个自定义事件或者使用 ref 获取最新 file
             document.dispatchEvent(new CustomEvent('code-editor-save'));
        });

        // 初始同步所有文件
        syncModels(monaco, files);

        // 触发初始 ATA
        triggerATA(monaco);
    };

    // 2. 监听保存事件 (解决闭包陈旧问题)
    useEffect(() => {
        const handleSaveEvent = () => {
            if (file && editorRef.current) {
                onSave(file.id, editorRef.current.getValue());
                setIsDirty(false);
            }
        };
        document.addEventListener('code-editor-save', handleSaveEvent);
        return () => document.removeEventListener('code-editor-save', handleSaveEvent);
    }, [file, onSave]);

    // 3. 同步 VFS -> Monaco Models (实现跨文件跳转的关键)
    const syncModels = (monaco: any, currentFiles: VirtualFile[]) => {
        currentFiles.forEach(f => {
            // 确保路径以 / 开头
            const path = normalizePath(f.path || f.name);
            const uri = monaco.Uri.parse(`file://${path}`);
            
            let model = monaco.editor.getModel(uri);
            
            if (!model) {
                // 如果模型不存在，创建它
                model = monaco.editor.createModel(
                    f.content,
                    undefined, // 自动检测语言
                    uri
                );
            } else {
                // 如果模型已存在 (可能由 AI 在后台修改)，更新内容
                // 注意：为了不打断用户输入，只在非当前编辑文件时更新，或者内容差异大时更新
                if (model.getValue() !== f.content && (!file || f.id !== file.id)) {
                    model.setValue(f.content);
                }
            }
        });
        
        // (可选) 清理已被删除的文件的 Model，防止内存泄漏
        // const currentUris = new Set(currentFiles.map(f => `file://${normalizePath(f.path||f.name)}`));
        // monaco.editor.getModels().forEach(m => {
        //    if (m.uri.scheme === 'file' && !currentUris.has(m.uri.toString())) {
        //        m.dispose();
        //    }
        // });
    };

    // 监听文件列表变化，持续同步
    useEffect(() => {
        if (monacoRef.current) {
            syncModels(monacoRef.current, files);
            
            // 如果 package.json 变了，重新触发 ATA
            const pkg = files.find(f => f.path.endsWith('package.json'));
            // 这里简单处理：每次文件变更都检查依赖不太好，实际可以加 debounce 或 diff
            // 为了演示，我们假设在组件加载或 package.json 内容显著变化时触发
            if (pkg) triggerATA(monacoRef.current);
        }
    }, [files]);

    // 4. 触发 ATA 逻辑
    const triggerATA = async (monaco: any) => {
        if (isATARunning) return;
        const deps = extractDependencies(files);
        if (Object.keys(deps).length === 0) return;

        setIsATARunning(true);
        // console.log("Starting ATA for:", Object.keys(deps));
        await injectLibraryTypes(monaco, deps);
        setIsATARunning(false);
    };

    // 处理当前选中文件变化
    useEffect(() => {
        setIsDirty(false);
    }, [file?.id]);


    if (!file) {
        return (
            <div className="flex-1 bg-[#1e1e1e] flex flex-col items-center justify-center text-slate-500 gap-3 select-none">
                <div className="scale-150 opacity-30"><Icons.File /></div>
                <p className="text-sm font-medium">Select a file to edit</p>
            </div>
        );
    }

    const cleanPath = normalizePath(file.path || file.name);

    return (
        <div className="flex-1 flex flex-col h-full bg-[#1e1e1e] min-w-0 overflow-hidden">
            {/* Header */}
            <div className="h-9 bg-[#1e1e1e] border-b border-[#333] flex items-center justify-between px-3 select-none shrink-0">
                <div className="flex items-center gap-2 max-w-[70%] text-slate-400">
                    <Icons.File />
                    <span className="text-xs text-slate-300 font-mono truncate" title={cleanPath}>
                        {file.name}
                    </span>
                    {isDirty && <div className="w-2 h-2 rounded-full bg-blue-500" title="Unsaved changes" />}
                </div>
                <div className="flex items-center gap-3">
                    {isATARunning && (
                        <span className="text-[10px] text-slate-500 animate-pulse flex items-center gap-1">
                            <Icons.Activity /> Fetching Types...
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
                    // 重要：使用 path 属性让 Editor 组件自动关联到我们在 syncModels 中创建的 Model
                    // path 必须匹配 URI 的 path 部分 (例如 /src/App.tsx)
                    path={cleanPath} 
                    defaultValue={file.content}
                    // 移除 value 绑定，让 Model 自管，除非需要强制重置
                    // value={file.content} 
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
                        // 启用语义高亮
                        'semanticHighlighting.enabled': true,
                    }}
                />
            </div>
        </div>
    );
};
