import { GoogleGenAI, Content, Part } from "@google/genai";
import { AppConfig, Message, ModelConfig, ToolCall } from "../types";

// --- Unified Types for Stream Consumption ---
export interface StreamChunk {
    textDelta?: string;
    toolCalls?: ToolCall[]; // Full snapshot of tool calls for this turn
}

// --- Tree Helper ---
export const getThread = (messageMap: Record<string, Message>, headId: string | null): Message[] => {
    if (!headId || !messageMap[headId]) return [];
    
    const thread: Message[] = [];
    let currentId: string | null = headId;
    
    while (currentId) {
        const msg = messageMap[currentId];
        if (!msg) break;
        thread.unshift(msg);
        currentId = msg.parentId;
    }
    
    return thread;
};

// --- Schema Converter Helper (Fix for OpenAI/Gemini case sensitivity) ---
const convertSchemaTypes = (schema: any, mode: 'upper' | 'lower'): any => {
  if (!schema || typeof schema !== 'object') return schema;
  if (Array.isArray(schema)) return schema.map(s => convertSchemaTypes(s, mode));

  const newSchema = { ...schema };

  // Convert 'type' field value
  if (newSchema.type && typeof newSchema.type === 'string') {
    newSchema.type = mode === 'upper' ? newSchema.type.toUpperCase() : newSchema.type.toLowerCase();
  }

  // Recursively handle 'properties'
  if (newSchema.properties && typeof newSchema.properties === 'object') {
    const newProps: any = {};
    Object.keys(newSchema.properties).forEach(key => {
      newProps[key] = convertSchemaTypes(newSchema.properties[key], mode);
    });
    newSchema.properties = newProps;
  }

  // Handle 'items' for arrays
  if (newSchema.items) {
    newSchema.items = convertSchemaTypes(newSchema.items, mode);
  }

  return newSchema;
};

// --- Gemini Converters ---

export const buildSystemInstruction = (config: AppConfig): string => {
    const activeMemories = config.memories
        .filter(m => m.active)
        .map(m => `<Memory name="${m.name}">\n${m.content}\n</Memory>`)
        .join("\n\n");

    // [修改] 只发送 inContext !== false 的文件
    // 默认 (undefined) 视为 true
    const activeFiles = config.files.filter(f => f.inContext !== false);

    const fileSystemContext = activeFiles
        .map(f => `<file path="${f.path || f.name}">\n${f.content}\n</file>`)
        .join("\n\n");
    
    // [新增] 告诉 AI 还有哪些文件它没看到，但依然存在
    const inactiveFiles = config.files.filter(f => f.inContext === false);
    let inactiveNote = "";
    if (inactiveFiles.length > 0) {
        const list = inactiveFiles.map(f => f.path || f.name).join(", ");
        inactiveNote = `\n\n=== HIDDEN FILES (Available via read_file) ===\nThe following files exist but are hidden from context to save space: ${list}. Use the 'read_file' tool to inspect them if needed.`;
    }

    let parts = [config.systemPrompt];

    if (activeMemories) {
        parts.push("=== VIRTUAL MEMORY CONTEXT ===");
        parts.push(activeMemories);
    }

    if (fileSystemContext) {
        parts.push(`=== FILE SYSTEM CONTEXT (Active Files: ${activeFiles.length}) ===`);
        parts.push(fileSystemContext);
    }
    
    if (inactiveNote) {
        parts.push(inactiveNote);
    }

    return parts.join("\n\n");
};

export const convertHistoryToGemini = (messages: Message[]): Content[] => {
  return messages.map(msg => {
    let parts: Part[] = [];

    if (msg.role === 'model') {
       if (msg.content) parts.push({ text: msg.content });
       if (msg.toolCalls) {
           parts.push(...msg.toolCalls.map(tc => ({
               functionCall: {
                   name: tc.name,
                   args: tc.args
               }
           })));
       }
    } else if (msg.role === 'user') {
      parts = [{ text: msg.content || '' }];
    } else if (msg.role === 'tool' && msg.toolResults) {
      parts = msg.toolResults.map(tr => {
        let parsedResult;
        try {
            parsedResult = JSON.parse(tr.result);
        } catch (e) {
            parsedResult = tr.result;
        }

        return {
          functionResponse: {
            id: tr.callId,
            name: tr.callId, 
            response: { result: parsedResult }
          }
        };
      });
    }

    return {
      role: msg.role === 'tool' ? 'tool' : (msg.role === 'model' ? 'model' : 'user'),
      parts: parts
    };
  });
};

// --- OpenAI Converters ---

const convertHistoryToOpenAI = (messages: Message[], systemInstruction: string): any[] => {
    const openaiMsgs: any[] = [
        { role: 'system', content: systemInstruction }
    ];

    for (const m of messages) {
        if (m.role === 'user') {
            openaiMsgs.push({ role: 'user', content: m.content || '' });
        } else if (m.role === 'model') {
            const msg: any = { role: 'assistant' };
            if (m.content) msg.content = m.content;
            if (m.toolCalls && m.toolCalls.length > 0) {
                msg.tool_calls = m.toolCalls.map(tc => ({
                    id: tc.id,
                    type: 'function',
                    function: {
                        name: tc.name,
                        arguments: JSON.stringify(tc.args)
                    }
                }));
                if (!msg.content) msg.content = null; 
            }
            openaiMsgs.push(msg);
        } else if (m.role === 'tool' && m.toolResults) {
            for (const tr of m.toolResults) {
                openaiMsgs.push({
                    role: 'tool',
                    tool_call_id: tr.callId,
                    content: tr.result
                });
            }
        }
    }
    return openaiMsgs;
};

const mapToolsToOpenAI = (tools: any[]) => {
    return tools.map(t => ({
        type: 'function',
        function: {
            name: t.name || 'unknown_tool',
            description: t.description,
            // Force lowercase types for OpenAI compatibility
            parameters: convertSchemaTypes(t.parameters, 'lower')
        }
    }));
};

// --- Debug / Export Helper ---

export const getRawRequest = (config: AppConfig, messages: Message[]) => {
    const activeModel = config.models.find(m => m.id === config.activeModelId);
    if (!activeModel) throw new Error("No active model selected.");

    const systemInstruction = buildSystemInstruction(config);
    const activeTools = config.tools
        .filter(t => t.active && t.definition)
        .map(t => t.definition);

    if (activeModel.provider === 'openai') {
        const msgs = convertHistoryToOpenAI(messages, systemInstruction);
        const body: any = {
            model: activeModel.modelId,
            messages: msgs,
            stream: true
        };
        if (activeTools.length > 0) {
            body.tools = mapToolsToOpenAI(activeTools);
        }
        return body;
    } else {
        const contents = convertHistoryToGemini(messages);
        // Force uppercase types for Gemini
        const geminiTools = activeTools.map(t => ({
            ...t,
            parameters: convertSchemaTypes(t.parameters, 'upper')
        }));
        const toolsConfig = geminiTools.length > 0 ? [{ functionDeclarations: geminiTools }] : undefined;
        
        return {
            model: activeModel.modelId,
            contents: contents,
            config: {
                systemInstruction: systemInstruction,
                tools: toolsConfig,
            }
        };
    }
};

// --- Streamers ---

async function* streamGemini(
  model: ModelConfig,
  history: Message[],
  systemInstruction: string,
  tools: any[],
  signal?: AbortSignal
): AsyncGenerator<StreamChunk> {
  const ai = new GoogleGenAI({ apiKey: model.apiKey });
  const contents = convertHistoryToGemini(history);
  
  // Convert tool schemas to uppercase for Gemini
  const geminiTools = tools.map(t => ({
      ...t,
      parameters: convertSchemaTypes(t.parameters, 'upper')
  }));
  const toolsConfig = geminiTools.length > 0 ? [{ functionDeclarations: geminiTools }] : undefined;

  try {
    const result = await ai.models.generateContentStream({
      model: model.modelId,
      contents: contents,
      config: {
        systemInstruction: systemInstruction,
        tools: toolsConfig,
      }
    });

    for await (const chunk of result) {
      if (signal?.aborted) {
        throw new Error('USER_ABORTED');
      }
      
      const text = chunk.text;
      let toolCalls: ToolCall[] | undefined;

      const parts = chunk.candidates?.[0]?.content?.parts;
      if (parts) {
        const fcs = parts.filter((p: any) => p.functionCall).map((p: any) => p.functionCall);
        if (fcs.length > 0) {
          toolCalls = fcs.map((fc: any) => ({
            id: fc.id || `call_${crypto.randomUUID().split('-')[0]}`,
            name: fc.name,
            args: fc.args
          }));
        }
      }

      yield { textDelta: text, toolCalls };
    }
  } catch (e: any) {
    if (signal?.aborted || e.message === 'USER_ABORTED') {
       throw new Error('USER_ABORTED');
    }
    throw e;
  }
}

async function* streamOpenAI(
  model: ModelConfig,
  history: Message[],
  systemInstruction: string,
  tools: any[],
  signal?: AbortSignal
): AsyncGenerator<StreamChunk> {
  const messages = convertHistoryToOpenAI(history, systemInstruction);
  const baseUrl = model.baseUrl ? model.baseUrl.replace(/\/$/, '') : 'https://api.openai.com/v1';

  const body: any = {
    model: model.modelId,
    messages: messages,
    stream: true
  };

  if (tools.length > 0) {
    body.tools = mapToolsToOpenAI(tools);
  }

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${model.apiKey}`
    },
    body: JSON.stringify(body),
    signal
  });

  if (!res.ok) {
    if (signal?.aborted) {
      throw new Error('USER_ABORTED');
    }
    
    let errorMsg = res.statusText;
    try {
      const errJson = await res.json();
      errorMsg = errJson.error?.message || errorMsg;
    } catch {}
    throw new Error(`OpenAI API Error (${res.status}): ${errorMsg}`);
  }

  const reader = res.body?.getReader();
  const decoder = new TextDecoder();
  if (!reader) return;

  let buffer = '';
  // Buffer to accumulate tool calls (index -> {id, name, argsString})
  const toolCallsBuffer: Record<number, { id: string, name: string, args: string }> = {};

  try {
    while (true) {
      if (signal?.aborted) {
        throw new Error('USER_ABORTED');
      }
      
      let readResult;
      try {
          readResult = await reader.read();
      } catch (readError: any) {
          if (readError.name === 'AbortError' || 
              readError.message?.includes('aborted') || 
              signal?.aborted) {
              throw new Error('USER_ABORTED');
          }
          throw readError;
      }

      const { done, value } = readResult;
      if (done) break;
      
      buffer += decoder.decode(value, { stream: true });
      
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data: ')) continue;
        if (trimmed === 'data: [DONE]') return;
        
        try {
          const json = JSON.parse(trimmed.slice(6));
          const delta = json.choices[0]?.delta;
          
          // 1. Handle Text Content
          if (delta?.content) {
            yield { textDelta: delta.content };
          }
          
          // 2. Handle Streaming Tool Calls
          if (delta?.tool_calls) {
             for (const tc of delta.tool_calls) {
                 const idx = tc.index;
                 if (!toolCallsBuffer[idx]) {
                     toolCallsBuffer[idx] = { id: '', name: '', args: '' };
                 }
                 
                 // Accumulate ID (usually only in first chunk)
                 if (tc.id) {
                     toolCallsBuffer[idx].id = tc.id;
                 }
                 
                 // Accumulate Name
                 if (tc.function?.name) {
                     toolCallsBuffer[idx].name += tc.function.name;
                 }
                 
                 // Accumulate Arguments (String)
                 if (tc.function?.arguments) {
                     toolCallsBuffer[idx].args += tc.function.arguments;
                 }
             }

             // Convert buffer to array and yield
             // Note: We yield 'args' as a raw string during streaming
             const currentToolCalls = Object.values(toolCallsBuffer).map(t => ({
                 id: t.id || `pending_${t.name}`,
                 name: t.name,
                 args: t.args 
             }));
             
             yield { textDelta: null, toolCalls: currentToolCalls };
          }

        } catch (e) {
          // Ignore parse errors from chunk
        }
      }
    }
  } catch (e: any) {
    if (e.message === 'USER_ABORTED') {
        throw e;
    }
    throw e;
  } finally {
    reader.releaseLock();
  }
}



export const sendMessageStream = async (
  config: AppConfig, 
  history: Message[],
  signal?: AbortSignal
): Promise<AsyncGenerator<StreamChunk>> => {
  const activeModel = config.models.find(m => m.id === config.activeModelId);
  if (!activeModel) throw new Error("No active model selected.");
  if (!activeModel.apiKey) throw new Error("API Key is missing for the selected model.");

  const systemInstruction = buildSystemInstruction(config);
  const activeTools = config.tools
      .filter(t => t.active && t.definition)
      .map(t => t.definition);

  if (activeModel.provider === 'openai') {
    return streamOpenAI(activeModel, history, systemInstruction, activeTools, signal);
  } else {
    return streamGemini(activeModel, history, systemInstruction, activeTools, signal);
  }
};