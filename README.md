# Ge Brain Studio

一个面向 AI 辅助开发的浏览器端集成环境，支持多模型对话、虚拟文件系统、动态工具调用与实时预览。

![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue)
![React](https://img.shields.io/badge/React-19.2-61dafb)
![Vite](https://img.shields.io/badge/Vite-6.0-646cff)
![License](https://img.shields.io/badge/License-MIT-green)

---

## ✨ 特性

- **多模型支持** – 无缝切换 Gemini、OpenAI 兼容模型，每个对话可独立配置 API Key。
- **对话树结构** – 支持分支对话、编辑重放、回复引用，可视化探索对话历史。
- **虚拟文件系统** – 内置编辑器（Monaco），支持 TypeScript/JSX 语法高亮、自动类型获取（ATA）。
- **本地文件夹挂载** – 通过 File System Access API 直接读写本地项目，实时同步。
- **动态工具系统** – 可视化工具管理器，支持注册 JavaScript 函数为工具，AI 自动调用并执行。
- **实时预览** – 基于 Service Worker 的沙箱环境，运行 React/Vue/Vanilla 项目，支持热更新。
- **环境变量隔离** – 安全存储 API 密钥等敏感信息，仅在工具执行时注入。

---

## 🚀 快速开始

### 环境要求

- Node.js 18+
- 浏览器需支持 [File System Access API](https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API)（Chrome 86+，Edge 86+）

### 安装与运行

```bash
# 克隆仓库
git clone https://github.com/your-username/ge-brain-studio.git
cd ge-brain-studio

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

访问 `http://localhost:3000` 即可开始使用。

### 配置 API 密钥

1. 点击左侧边栏的 `Models` 标签页。
2. 添加或编辑一个模型，填入对应的 `API Key`。
   - 对于 Gemini，使用 Google AI Studio 获取密钥。
   - 对于 OpenAI 兼容接口，需提供 `Base URL` 和 `API Key`。

> 所有密钥仅存储在浏览器本地（IndexedDB/localStorage），不会上传至任何服务器。

---

## 🧰 核心功能说明

### 1. 对话管理

- **发送消息**：底部输入框支持 Markdown、文件附件（拖拽或选择）。
- **回复引用**：点击消息上的 `↩️` 图标可引用该消息进行回复。
- **分支与重放**：编辑历史消息会自动创建分支，点击消息上的编辑图标可修改并重新生成。
- **对话树视图**：点击顶部的分支图标，以树形结构查看完整对话，支持跳转、缩放。

### 2. 文件系统

- **文件浏览**：左侧文件面板（可拖动宽度）支持新建、重命名、删除文件/文件夹。
- **代码编辑**：内置 Monaco 编辑器，支持 TypeScript/JSX 类型检查、自动补全、跨文件跳转。
- **本地项目挂载**：点击工具栏的文件夹图标，选择本地目录，即可实时读写文件（需授予权限）。
- **上下文控制**：每个文件可单独决定是否包含在 AI 系统提示词中（`inContext` 开关）。
- **入口点设置**：右键 JS/TS 文件可设为入口点，预览时会自动启动该文件。

### 3. 工具系统

#### 内置系统工具（OS Agent）

通过 `system_manager` 工具，AI 可以执行以下文件操作：

| 命令 | 描述 |
|------|------|
| `list_files` | 列出所有文件 |
| `read_file` | 读取文件内容 |
| `write_file` | 写入文件（全量） |
| `patch_file` | 模糊替换代码片段 |
| `search_files` | 搜索关键词 |
| `delete_file` | 删除文件 |
| `rename_file` | 重命名/移动文件 |
| `get_config` | 获取当前配置 |
| `set_prompt` / `append_prompt` | 修改系统提示词 |
| `register_tool` | 动态注册新工具 |

#### 自定义工具

打开「Tool Studio」（侧边栏 Tools → Open Tool Studio）：
- 编写 JavaScript 函数（支持 `async/await`），接收 `args` 和 `env` 参数。
- 定义 JSON Schema 描述参数。
- 可选择「Auto-Run」，使 AI 调用后自动执行并继续对话。

### 4. 预览环境

- 切换到 `Preview` 标签页，实时渲染 React/Vue 项目。
- 基于 Service Worker 拦截请求，动态编译 TypeScript/JSX，支持 CSS 模块。
- 控制台输出会捕获并显示在底部的「Preview Console」面板中。

### 5. 数据持久化与导入/导出

- **自动保存**：所有配置、对话历史、文件均自动存储到浏览器的 IndexedDB。
- **导出**：可导出完整会话状态（`.json`）或原始 API 请求体（用于调试）。
- **导入**：加载以前导出的会话文件，恢复所有内容。

---

## 📁 项目结构

```
ge-brain-studio/
├── components/          # React 组件
│   ├── chat/            # 聊天界面、消息项、输入区
│   ├── config/          # 侧边栏各配置面板（模型、系统提示、记忆、工具、环境变量）
│   ├── filesystem/      # 文件浏览器、代码编辑器、预览面板
│   ├── tools/           # 工具管理器（Tool Studio）
│   └── devtools/        # 控制台面板、工具调试器
├── contexts/            # BrainContext（全局状态协调）
├── stores/              # Zustand 状态管理（配置、文件、UI、日志）
├── services/            # API 调用封装（Gemini / OpenAI 流式处理）
├── hooks/               # 自定义 hooks（暴露全局 window.GeBrain API）
├── utils/               # 工具函数（文件系统、路径解析、模板转换、类型获取）
├── config/              # 默认配置、系统提示词、内置工具定义
├── public/              # Service Worker（编译与虚拟文件服务）
└── types.ts             # TypeScript 类型定义
```

---

## 🔧 开发与扩展

### 添加新的大模型提供商

在 `types.ts` 中扩展 `ModelProvider` 类型，并在 `services/geminiService.ts` 中添加对应的流式转换逻辑。

### 注册新的内置工具

1. 在 `config/tools.ts` 的 `SYSTEM_TOOLS` 数组中增加工具定义。
2. 在 `config/implementations/` 下编写实现代码（注意导出为 `?raw` 字符串）。
3. 工具实现中可调用 `window.GeBrain` 暴露的内部 API（如读写文件、修改配置等）。

### 自定义 UI 主题

项目使用 Tailwind CSS，所有颜色和样式类均可按需修改。全局暗色主题定义在 `index.css`。

---

## 🐛 已知问题

- 本地模式删除文件时，需二次确认；目前仅从 UI 移除，实际删除需通过 AI 工具或手动刷新。
- 部分老旧浏览器不支持 File System Access API，本地挂载功能不可用。
- 大型项目（>5000 文件）首次加载可能导致内存占用较高，建议按需筛选。

---

## 📄 许可证

[MIT](LICENSE)

---

## 🙏 致谢

- [Google Gemini API](https://ai.google.dev/)
- [Monaco Editor](https://microsoft.github.io/monaco-editor/)
- [Sandpack](https://sandpack.codesandbox.io/)
- [React Resizable Panels](https://github.com/bvaughn/react-resizable-panels)

---

**Made with ❤️ for AI developers**