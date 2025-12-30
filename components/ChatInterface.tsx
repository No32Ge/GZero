import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Message, ToolCall, AttachedFile } from '../types';
import { sendMessageStream, getThread } from '../services/geminiService';
import { useBrain } from '../contexts/BrainContext';
import { Icons } from './Icon';
import { MessageItem } from './chat/MessageItem';
import { InputArea } from './chat/InputArea';
import { ToolDebugPanel } from './devtools/ToolDebugPanel';
import { useUIStore } from '../stores/useUIStore';
// @ts-ignore
import JSZip from 'jszip';


export const ChatInterface: React.FC = () => {
  const {
    config,
    currentThread,
    messageMap,
    headId,
    setMessageMap,
    setHeadId,
    toolLogs,
    addToolLog,
    updateToolLog,
    clearLogs
  } = useBrain();

  const toggleSidebar = useUIStore(s => s.toggleSidebar);
  const isSidebarOpen = useUIStore(s => s.isSidebarOpen);
  const toggleFilePanel = useUIStore(s => s.toggleFilePanel);
  const isFilePanelOpen = useUIStore(s => s.isFilePanelOpen);
  const toggleTree = useUIStore(s => s.toggleTree);


  const [inputMode, setInputMode] = useState<'user' | 'fake_tool'>('user');
  const [input, setInput] = useState('');

  // Interrupt State
  const [isGenerating, setIsGenerating] = useState(false);
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Attachments
  const [attachments, setAttachments] = useState<AttachedFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fake Tool State
  const [selectedToolName, setSelectedToolName] = useState<string>('');
  const [fakeArgs, setFakeArgs] = useState('{}');
  const [fakeOutput, setFakeOutput] = useState('{"status": "success"}');

  // Reply State
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Debug Panel
  const [isDebugPanelOpen, setIsDebugPanelOpen] = useState(false);
  const [isExecutionPaused, setIsExecutionPaused] = useState(false);

  const activeModel = config.models.find(m => m.id === config.activeModelId);

  // --- [新增] Token 估算逻辑 ---
  const contextSize = useMemo(() => {
    // 1. 系统提示词
    const systemChars = config.systemPrompt.length;

    // 2. 活跃记忆
    const memoryChars = config.memories
      .filter(m => m.active)
      .reduce((acc, m) => acc + m.content.length, 0);

    // 3. 活跃文件 (inContext !== false)
    const fileChars = config.files
      .filter(f => f.inContext !== false) // 默认为 true
      .reduce((acc, f) => acc + f.content.length, 0);

    // 4. 当前对话历史 (粗略估算)
    const historyChars = currentThread.reduce((acc, msg) => {
      return acc + (msg.content?.length || 0) + JSON.stringify(msg.toolCalls || []).length + JSON.stringify(msg.toolResults || []).length;
    }, 0);

    const totalChars = systemChars + memoryChars + fileChars + historyChars;

    // 粗略估算：1 Token ≈ 4 字符
    return Math.round(totalChars / 4);
  }, [config, currentThread]);

  // Helper to update global state
  const updateState = (newMap: Record<string, Message>, newHeadId: string | null) => {
    setMessageMap(newMap);
    setHeadId(newHeadId);
  };

  const handleStopGeneration = () => {
    if (abortController) {
      console.log('Stopping generation via AbortController...');
      abortController.abort();
      setIsGenerating(false);
      setAbortController(null);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    return () => {
      if (abortController) abortController.abort();
    };
  }, [abortController]);

  useEffect(() => {
    if (config.tools.length > 0 && !selectedToolName) {
      const firstValidTool = config.tools.find(t => t.definition?.name);
      if (firstValidTool) {
        setSelectedToolName(firstValidTool.definition.name);
      }
    }
  }, [config.tools]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [currentThread.length, isLoading]);

  const appendToTree = (parentId: string | null, newMessage: Message, updatesMap: Record<string, Message>) => {
    const updatedMap = { ...updatesMap, [newMessage.id]: newMessage };
    if (parentId && updatedMap[parentId]) {
      updatedMap[parentId] = {
        ...updatedMap[parentId],
        childrenIds: [...updatedMap[parentId].childrenIds, newMessage.id]
      };
    }
    return updatedMap;
  };

  // --- Execution Helper ---
  const executeToolWithLogs = async (toolConfig: any, args: any, callId: string, logId: string) => {
    updateToolLog(logId, { status: 'running' });
    const start = performance.now();
    const consoleLogs: string[] = [];

    const sandboxConsole = {
      log: (...a: any[]) => consoleLogs.push(a.map(String).join(' ')),
      error: (...a: any[]) => consoleLogs.push("[ERROR] " + a.map(String).join(' ')),
      warn: (...a: any[]) => consoleLogs.push("[WARN] " + a.map(String).join(' ')),
      info: (...a: any[]) => consoleLogs.push("[INFO] " + a.map(String).join(' ')),
    };

    try {
      const func = new Function('args', 'env', 'console', `return (async () => { ${toolConfig.implementation} })()`);
      const output = await func(args, config.env || {}, sandboxConsole);
      const duration = performance.now() - start;
      const resultStr = JSON.stringify(output);

      updateToolLog(logId, {
        status: 'success',
        result: output,
        duration,
        consoleLogs,
        endTime: Date.now()
      });

      return resultStr;
    } catch (e: any) {
      const duration = performance.now() - start;
      consoleLogs.push(`[SYSTEM ERROR] ${e.message}`);

      updateToolLog(logId, {
        status: 'error',
        error: e.message,
        duration,
        consoleLogs,
        endTime: Date.now()
      });

      return JSON.stringify({ error: e.message });
    }
  };

  const processConversationTurnFull = async (startMap: Record<string, Message>, startHeadId: string) => {
    setIsLoading(true);
    setIsGenerating(true);
    const modelMsgId = crypto.randomUUID();
    const controller = new AbortController();
    setAbortController(controller);

    const initialModelMsg: Message = {
      id: modelMsgId,
      role: 'model',
      content: '',
      toolCalls: [],
      timestamp: Date.now(),
      parentId: startHeadId,
      childrenIds: []
    };

    let currentMap = appendToTree(startHeadId, initialModelMsg, startMap);
    let currentHead = modelMsgId;
    updateState(currentMap, currentHead);

    try {
      const historyForApi = getThread(currentMap, startHeadId);
      const stream = await sendMessageStream(config, historyForApi, controller.signal);

      let accumulatedText = '';
      let currentToolCalls: ToolCall[] = [];

      for await (const chunk of stream) {
        if (chunk.textDelta) accumulatedText += chunk.textDelta;
        if (chunk.toolCalls) currentToolCalls = chunk.toolCalls;

        currentMap = {
          ...currentMap,
          [modelMsgId]: {
            ...currentMap[modelMsgId],
            content: accumulatedText,
            toolCalls: currentToolCalls.length > 0 ? currentToolCalls : undefined
          }
        };
        updateState(currentMap, currentHead);
      }

      // Finalize
      const finalMsg = currentMap[modelMsgId];
      let finalToolCalls = finalMsg.toolCalls || [];

      finalToolCalls = finalToolCalls.map(tc => {
        if (typeof tc.args === 'string') {
          try { return { ...tc, args: JSON.parse(tc.args) }; }
          catch (e) { return tc; }
        }
        return tc;
      });

      currentMap = { ...currentMap, [modelMsgId]: { ...currentMap[modelMsgId], toolCalls: finalToolCalls } };
      updateState(currentMap, currentHead);

      // Auto-Execute Logic
      if (finalToolCalls.length > 0) {
        const executionTasks: Promise<{ callId: string, result: string }>[] = [];
        const executedCallIds: string[] = [];

        for (const tc of finalToolCalls) {
          if (typeof tc.args === 'string') continue;

          const toolConfig = config.tools.find(t => t.definition?.name === tc.name);

          // Log Pending
          const logId = crypto.randomUUID();
          addToolLog({
            id: logId,
            toolName: tc.name,
            callId: tc.id,
            status: 'pending',
            startTime: Date.now(),
            args: tc.args,
            consoleLogs: [],
            envSnapshot: { ...config.env }
          });

          if (toolConfig && toolConfig.autoExecute && toolConfig.implementation) {
            if (!isExecutionPaused) {
              executedCallIds.push(tc.id);
              executionTasks.push(
                executeToolWithLogs(toolConfig, tc.args, tc.id, logId)
                  .then(result => ({ callId: tc.id, result }))
              );
            }
          }
        }

        if (executionTasks.length > 0) {
          const results = await Promise.all(executionTasks);

          const toolMsgId = crypto.randomUUID();
          const toolMsg: Message = {
            id: toolMsgId,
            role: 'tool',
            toolResults: results,
            timestamp: Date.now(),
            parentId: currentHead,
            childrenIds: []
          };

          currentMap = appendToTree(currentHead, toolMsg, currentMap);
          currentHead = toolMsgId;
          updateState(currentMap, currentHead);

          // Continue if ALL calls were executed
          if (executedCallIds.length === finalToolCalls.length) {
            await processConversationTurnFull(currentMap, currentHead);
          }
        }
      }

    } catch (error: any) {
      if (error.message === 'USER_ABORTED') {
        console.log('Aborted');
      } else {
        const errorMessage = `Error: ${error.message || 'Unknown error'}`;
        currentMap = {
          ...currentMap,
          [modelMsgId]: {
            ...currentMap[modelMsgId],
            content: (currentMap[modelMsgId].content || '') + `\n\n> *${errorMessage}*`
          }
        };
        updateState(currentMap, currentHead);
      }
    } finally {
      setIsLoading(false);
      setIsGenerating(false);
      setAbortController(null);
    }
  };

  const handleSend = async () => {
    if (isLoading) return;
    if (!activeModel?.apiKey) {
      alert("Please configure an API Key for the active model in the settings panel.");
      toggleSidebar();
      return;
    }

    let nextParentId = headId;
    let nextMap = { ...messageMap };

    if (inputMode === 'user') {
      if (!input.trim() && attachments.length === 0) return;

      let finalContent = input;
      if (attachments.length > 0) {
        const fileContext = attachments.map(f =>
          `\n<file name="${f.name}">\n${f.content}\n</file>`
        ).join("\n");
        finalContent = `${finalContent}\n\n=== ATTACHED FILES ===\n${fileContext}`;
      }

      const newMessage: Message = {
        id: crypto.randomUUID(),
        role: 'user',
        content: finalContent,
        timestamp: Date.now(),
        parentId: nextParentId,
        childrenIds: [],
        referencedMessageId: replyingToId || undefined
      };

      nextMap = appendToTree(nextParentId, newMessage, nextMap);
      nextParentId = newMessage.id;

      setInput('');
      setAttachments([]);
      setReplyingToId(null);

      updateState(nextMap, nextParentId);
      await processConversationTurnFull(nextMap, nextParentId);

    } else {
      if (!selectedToolName) {
        alert("No tool selected.");
        return;
      }
      try {
        const parsedArgs = JSON.parse(fakeArgs);
        const callId = `call_${crypto.randomUUID().split('-')[0]}`;

        const fakeModelCall: Message = {
          id: crypto.randomUUID(),
          role: 'model',
          timestamp: Date.now(),
          toolCalls: [{
            id: callId,
            name: selectedToolName,
            args: parsedArgs
          }],
          parentId: nextParentId,
          childrenIds: []
        };
        nextMap = appendToTree(nextParentId, fakeModelCall, nextMap);
        nextParentId = fakeModelCall.id;

        const fakeToolResponse: Message = {
          id: crypto.randomUUID(),
          role: 'tool',
          timestamp: Date.now() + 10,
          toolResults: [{
            callId: callId,
            result: fakeOutput
          }],
          parentId: nextParentId,
          childrenIds: []
        };
        nextMap = appendToTree(nextParentId, fakeToolResponse, nextMap);
        nextParentId = fakeToolResponse.id;

        setFakeOutput('');

        updateState(nextMap, nextParentId);
        await processConversationTurnFull(nextMap, nextParentId);

      } catch (e) {
        alert("Invalid JSON in Arguments or Output fields.");
        return;
      }
    }
  };

  const handleToolSubmit = async (callId: string, result: string) => {
    if (isLoading) return;

    const toolMessage: Message = {
      id: crypto.randomUUID(),
      role: 'tool',
      toolResults: [{ callId, result }],
      timestamp: Date.now(),
      parentId: headId,
      childrenIds: []
    };

    let nextMap = appendToTree(headId, toolMessage, messageMap);
    let nextHead = toolMessage.id;

    updateState(nextMap, nextHead);
    await processConversationTurnFull(nextMap, nextHead);
  };

  const handleRegenerate = async (msgId: string) => {
    if (isLoading) return;
    const msg = messageMap[msgId];
    if (!msg || !msg.parentId) return;
    const parentId = msg.parentId;
    await processConversationTurnFull(messageMap, parentId);
  };

  const navigateBranch = (msgId: string, direction: 'prev' | 'next') => {
    const msg = messageMap[msgId];
    if (!msg || !msg.parentId) return;
    const parent = messageMap[msg.parentId];
    if (!parent) return;
    const currentIndex = parent.childrenIds.indexOf(msgId);
    if (currentIndex === -1) return;
    let nextIndex = direction === 'prev' ? currentIndex - 1 : currentIndex + 1;
    if (nextIndex < 0) nextIndex = 0;
    if (nextIndex >= parent.childrenIds.length) nextIndex = parent.childrenIds.length - 1;
    const nextChildId = parent.childrenIds[nextIndex];
    let ptr = nextChildId;
    while (true) {
      const node = messageMap[ptr];
      if (!node || node.childrenIds.length === 0) break;
      ptr = node.childrenIds[node.childrenIds.length - 1];
    }
    updateState(messageMap, ptr);
  };

  const handleEdit = (msgId: string) => {
    const msg = messageMap[msgId];
    if (!msg || !msg.parentId) return;

    if (msg.role === 'user') {
      setInput(msg.content || '');
      setInputMode('user');
      setHeadId(msg.parentId);
    } else if (msg.role === 'tool') {
      const parent = messageMap[msg.parentId];
      if (parent && parent.role === 'model' && parent.toolCalls && parent.toolCalls.length > 0) {
        if (parent.parentId) {
          setHeadId(parent.parentId);
          setInputMode('fake_tool');
          setSelectedToolName(parent.toolCalls[0].name);
          setFakeArgs(JSON.stringify(parent.toolCalls[0].args, null, 2));
          const resultObj = msg.toolResults?.find(tr => tr.callId === parent.toolCalls![0].id);
          setFakeOutput(resultObj ? resultObj.result : '');
        }
      }
    } else if (msg.role === 'model' && msg.toolCalls && msg.toolCalls.length > 0) {
      if (msg.parentId) {
        setHeadId(msg.parentId);
        setInputMode('fake_tool');
        setSelectedToolName(msg.toolCalls[0].name);
        setFakeArgs(JSON.stringify(msg.toolCalls[0].args, null, 2));
        const nextMsgIndex = currentThread.findIndex(m => m.id === msgId) + 1;
        const nextMsg = currentThread[nextMsgIndex];
        if (nextMsg && nextMsg.role === 'tool') {
          const resultObj = nextMsg.toolResults?.find(tr => tr.callId === msg.toolCalls![0].id);
          setFakeOutput(resultObj ? resultObj.result : '');
        } else {
          setFakeOutput('');
        }
      }
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const newAttachments: AttachedFile[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        if (file.name.endsWith('.zip')) {
          const zip = await JSZip.loadAsync(file);
          const promises: Promise<void>[] = [];
          zip.forEach((relativePath: string, zipEntry: any) => {
            promises.push((async () => {
              if (zipEntry.dir) return;
              if (relativePath.includes('__MACOSX') || relativePath.startsWith('.')) return;
              try {
                const content = await zipEntry.async('string');
                if (content.indexOf('\0') === -1) {
                  newAttachments.push({ name: relativePath, content: content });
                }
              } catch (err) {
                console.warn(`Failed to read zip entry ${relativePath}`, err);
              }
            })());
          });
          await Promise.all(promises);
        } else {
          const text = await file.text();
          if (text.indexOf('\0') === -1) {
            newAttachments.push({ name: file.name, content: text });
          }
        }
      } catch (err) {
        console.error("Error processing file", file.name, err);
        alert(`Failed to process ${file.name}`);
      }
    }
    setAttachments(prev => [...prev, ...newAttachments]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleRunToolDebug = async (name: string, argsStr: string) => {
    try {
      const args = JSON.parse(argsStr);
      const toolConfig = config.tools.find(t => t.definition?.name === name);
      if (!toolConfig || !toolConfig.implementation) {
        alert("Tool not found or has no implementation.");
        return;
      }

      const logId = crypto.randomUUID();
      addToolLog({
        id: logId,
        toolName: name,
        callId: 'debug_run_' + Date.now(),
        status: 'pending',
        startTime: Date.now(),
        args: args,
        consoleLogs: [],
        envSnapshot: { ...config.env }
      });

      await executeToolWithLogs(toolConfig, args, 'debug_run_' + Date.now(), logId);

    } catch (e: any) {
      alert("Invalid JSON args: " + e.message);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 relative transition-all duration-300">

      {/* Header */}
      <div className="h-14 border-b border-slate-800 bg-slate-950/80 backdrop-blur-md flex items-center px-4 sticky top-0 z-20">
        <button
          onClick={toggleSidebar}
          className={`p-2 mr-2 rounded-md transition-colors ${isSidebarOpen ? 'text-blue-400 bg-blue-900/20' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
        >
          {isSidebarOpen ? <Icons.ChevronLeft /> : <Icons.Menu />}
        </button>
        <button
          onClick={toggleFilePanel}
          className={`p-2 mr-2 rounded-md transition-colors ${isFilePanelOpen ? 'text-blue-400 bg-blue-900/20' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
          title="Toggle File Workspace"
        >
          <Icons.Sidebar />
        </button>
        <button
          onClick={toggleTree}
          className="p-2 mr-4 text-slate-400 hover:text-white rounded-md hover:bg-slate-800 transition-colors"
          title="Conversation Tree"
        >
          <Icons.GitBranch />
        </button>
        <div className="flex-1">
          <h1 className="text-sm font-semibold text-slate-200">Ge Brain Studio</h1>
          <div className="flex items-center gap-2">
            <span className={`w-1.5 h-1.5 rounded-full ${activeModel ? 'bg-green-500' : 'bg-red-500'}`}></span>
            <p className="text-[10px] text-slate-500">{activeModel ? activeModel.name : 'No Model Selected'}</p>

            {/* [新增] Token 计数器 */}
            <div className="h-3 w-px bg-slate-800 mx-1"></div>
            <div className="text-[10px] font-mono text-slate-600 flex items-center gap-1" title="Estimated Context Usage (Active Files + Memories + System Prompt)">
              <Icons.Activity />
              <span className={contextSize > 30000 ? 'text-orange-400' : ''}>
                {contextSize > 1000 ? `${(contextSize / 1000).toFixed(1)}k` : contextSize} toks
              </span>
            </div>
          </div>
        </div>

        {/* Debug Toggle */}
        <button
          onClick={() => setIsDebugPanelOpen(!isDebugPanelOpen)}
          className={`p-2 rounded-md transition-colors ${isDebugPanelOpen ? 'text-blue-400 bg-blue-900/20' : 'text-slate-500 hover:text-white hover:bg-slate-800'}`}
          title="Tool Debugger"
        >
          <Icons.Bug />
        </button>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-8 scroll-smooth pb-96">
        {currentThread.length === 0 && (
          <div className="h-[60vh] flex flex-col items-center justify-center text-slate-600 animate-fadeIn">
            <div className="p-4 bg-slate-900 rounded-full mb-4">
              <Icons.Brain />
            </div>
            <h3 className="text-lg font-medium text-slate-300">Ready to Iterate</h3>
            <p className="mt-2 text-sm max-w-xs text-center">Configure your models, memories and tools in the sidebar, then start chatting.</p>
          </div>
        )}

        {currentThread.map((msg) => (
          <MessageItem
            key={msg.id}
            msg={msg}
            messageMap={messageMap}
            currentThread={currentThread}
            activeModel={activeModel}
            isLoading={isLoading}
            onRegenerate={handleRegenerate}
            onBranchNav={navigateBranch}
            onToolExecute={handleToolSubmit}
            onReply={(id) => setReplyingToId(id)}
            onEdit={handleEdit}
          />
        ))}

        {isLoading && currentThread[currentThread.length - 1]?.role !== 'model' && (
          <div className="flex justify-start animate-pulse">
            <div className="bg-slate-800/50 text-slate-400 rounded-2xl rounded-tl-sm p-4 text-xs flex items-center gap-2">
              <span className="w-2 h-2 bg-slate-500 rounded-full animate-bounce"></span>
              <span className="w-2 h-2 bg-slate-500 rounded-full animate-bounce delay-100"></span>
              <span className="w-2 h-2 bg-slate-500 rounded-full animate-bounce delay-200"></span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <InputArea
        input={input}
        setInput={setInput}
        inputMode={inputMode}
        setInputMode={setInputMode}
        attachments={attachments}
        onRemoveAttachment={removeAttachment}
        onAttach={() => fileInputRef.current?.click()}
        fileInputRef={fileInputRef}
        handleFileSelect={handleFileSelect}
        handleSend={handleSend}
        onStop={handleStopGeneration}
        isLoading={isLoading}
        config={config}
        selectedToolName={selectedToolName}
        setSelectedToolName={setSelectedToolName}
        fakeArgs={fakeArgs}
        setFakeArgs={setFakeArgs}
        fakeOutput={fakeOutput}
        setFakeOutput={setFakeOutput}
        replyingToMessage={replyingToId ? messageMap[replyingToId] : null}
        onCancelReply={() => setReplyingToId(null)}
      />

      {/* Debug Panel */}
      <ToolDebugPanel
        logs={toolLogs}
        isOpen={isDebugPanelOpen}
        onClose={() => setIsDebugPanelOpen(false)}
        onClearLogs={clearLogs}
        isPaused={isExecutionPaused}
        onTogglePause={() => setIsExecutionPaused(!isExecutionPaused)}
        config={config}
        onRunTool={handleRunToolDebug}
      />
    </div>
  );

};