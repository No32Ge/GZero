import { UserTool } from '../types';
// 【关键】使用 ?raw 后缀导入文件内容作为字符串
import osImpl from './implementations/os_agent.js?raw';

const createTool = (
    name: string,
    description: string,
    parameters: any,
    implementation: string
): UserTool => ({
    id: crypto.randomUUID(),
    active: true,
    autoExecute: true,
    definition: { name, description, parameters },
    implementation
});

export const SYSTEM_TOOLS: UserTool[] = [
    createTool(
        'system_manager',
        'The Primary OS Agent. Use this for ALL file system operations, code manipulation, and system configuration.',
        {
            type: 'OBJECT',
            properties: {
                command: {
                    type: 'STRING',
                    description: 'The operation to execute.',
                    enum: [
                        'list_files', 'read_file', 'write_file', 'patch_file', 'search_files', 
                        'delete_file', 'get_config', 'set_prompt', 'append_prompt', 
                        'get_tools', 'register_tool'
                    ]
                },
                data: {
                    type: 'STRING',
                    description: `Arguments encoded as a JSON STRING.
Required structure per command:
- list_files: {} or null
- read_file: { "path": "src/App.tsx" }
- write_file: { "path": "src/App.tsx", "content": "..." }
- patch_file: { "path": "src/App.tsx", "old_str": "original code", "new_str": "new code" } (Smart fuzzy match enabled)
- search_files: { "keyword": "Button" }
- delete_file: { "path": "src/temp.ts" }
- register_tool: { "definition": {name...}, "implementation": "js code...", "autoExecute": true }
- set_prompt/append_prompt: { "prompt": "..." }

IMPORTANT: 'data' must be a valid JSON string.`
                }
            },
            required: ['command']
        },
        osImpl 
    )
];