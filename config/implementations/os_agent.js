// Ge Brain OS Agent v3.1 (Async I/O Support)
try { 
    if (!window.GeBrain) return "Error: GeBrain API not found. Please refresh.";
    const cmd = args.command;

    // Argument Parsing
    let data = {};
    if (args.data) {
        if (typeof args.data === 'string') {
            try { data = JSON.parse(args.data); } 
            catch (e) { return "Error: args.data is not valid JSON string."; }
        } else if (typeof args.data === 'object') {
            data = args.data;
        }
    }

    // Helper: Fuzzy Replace
    const fuzzyReplace = (fullText, search, replace) => {
        if (fullText.includes(search)) return fullText.replace(search, replace);
        const escapeRegExp = (string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\\\$&');
        const searchPattern = search.trim().split(/\\s+/).map(escapeRegExp).join('\\\\s+');
        const regex = new RegExp(searchPattern);
        if (!regex.test(fullText)) return null;
        return fullText.replace(regex, replace);
    };

    switch(cmd) {
        case 'list_files': 
            const files = window.GeBrain.listFiles();
            return files
                .filter(f => !f.path.includes('node_modules/'))
                .map(f => `${f.path} (${f.size}b)`).join('\n');
            
        case 'read_file':
            if (!data.path) return "Error: path required";
            return JSON.stringify(window.GeBrain.readFile(data.path));

        case 'write_file':
            if (!data.path || data.content === undefined) return "Error: path and content required";
            // [Async]
            return JSON.stringify(await window.GeBrain.writeFile(data.path, data.content));

        case 'patch_file':
            if (!data.path || !data.old_str || !data.new_str) return "Error: path, old_str, and new_str required";
            
            const readRes = window.GeBrain.readFile(data.path);
            if (!readRes.success) return JSON.stringify(readRes);
            
            const oldContent = readRes.content;
            const newContent = fuzzyReplace(oldContent, data.old_str, data.new_str);
            
            if (newContent === null) {
                return JSON.stringify({ 
                    success: false, 
                    message: "Patch failed: Target string not found. Check indentation or try a unique snippet.",
                    file_head: oldContent.slice(0, 200) + "..." 
                });
            }
            // [Async]
            return JSON.stringify(await window.GeBrain.writeFile(data.path, newContent));

        case 'search_files':
            if (!data.keyword) return "Error: keyword required";
            const allFiles = window.GeBrain.listFiles();
            const results = [];
            for (const f of allFiles) {
                if (f.size > 20000 || f.path.endsWith('.json')) continue; 
                const contentRes = window.GeBrain.readFile(f.path);
                if (contentRes.success && contentRes.content.includes(data.keyword)) {
                    const idx = contentRes.content.indexOf(data.keyword);
                    const snippet = contentRes.content.substring(Math.max(0, idx - 30), Math.min(contentRes.content.length, idx + 50));
                    results.push(`Found in ${f.path}: "...${snippet.replace(/\n/g, ' ')}..."`);
                }
            }
            return results.length > 0 ? results.join('\n') : "No matches found.";

        case 'delete_file':
            if (!data.path) return "Error: path required";
            // [Async]
            return JSON.stringify(await window.GeBrain.deleteFile(data.path));

        case 'get_config': 
            const rawConfig = window.GeBrain.getConfig();
            const safeConfig = {
                activeModelId: rawConfig.activeModelId,
                models: rawConfig.models.map(m => ({ name: m.name, provider: m.provider })),
                files_count: rawConfig.files.length,
                tools_active: rawConfig.tools.filter(t => t.active).map(t => t.definition.name),
                prompt_len: rawConfig.systemPrompt.length
            };
            return JSON.stringify(safeConfig);

        case 'set_prompt': return JSON.stringify(window.GeBrain.updateSystemPrompt(data.prompt));
        case 'append_prompt': return JSON.stringify(window.GeBrain.appendSystemPrompt(data.prompt));
        case 'get_tools': return JSON.stringify(window.GeBrain.getTools());
        
        case 'register_tool': 
             if (!data.definition || !data.implementation) return "Error: definition and implementation required";
             let def = data.definition;
             if (typeof def === 'string') {
                try { def = JSON.parse(def); } 
                catch (e) { return "Error: definition must be valid JSON object or string."; }
             }
             return JSON.stringify(window.GeBrain.registerTool(def, data.implementation, data.autoExecute || false));

        default: return "Unknown command: " + cmd;
    }
} catch (e) { return "System Error: " + e.message; }