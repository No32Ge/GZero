import React, { useEffect } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { BrainProvider, useBrain } from './contexts/BrainContext';
import { ConfigPanel } from './components/ConfigPanel';
import { ChatInterface } from './components/ChatInterface';
import { TreeViewPanel } from './components/TreeViewPanel';
import { FileWorkspace } from './components/filesystem/FileWorkspace';
import { ToolManager } from './components/tools/ToolManager';
import { useUIStore } from './stores/useUIStore';
import { ConsolePanel } from './components/devtools/ConsolePanel'; // [新增]
import { useLogStore } from './stores/useLogStore'; // [新增]

// Layout Component
const MainLayout = () => {
  const isSidebarOpen = useUIStore(s => s.isSidebarOpen);
  const isFilePanelOpen = useUIStore(s => s.isFilePanelOpen);
  const isTreeOpen = useUIStore(s => s.isTreeOpen);
  const isToolManagerOpen = useUIStore(s => s.isToolManagerOpen);
  const toggleTree = useUIStore(s => s.toggleTree);
  const toggleSidebar = useUIStore(s => s.toggleSidebar);
  const toggleToolManager = useUIStore(s => s.toggleToolManager);

  // [新增] 日志监听逻辑
  const addLog = useLogStore(s => s.addLog);
  useEffect(() => {
      const handleMessage = (e: MessageEvent) => {
          if (e.data && e.data.type === 'PREVIEW_CONSOLE') {
              addLog(e.data.level, e.data.content);
          }
      };
      window.addEventListener('message', handleMessage);
      return () => window.removeEventListener('message', handleMessage);
  }, [addLog]);

  const { setHeadId } = useBrain();

  return (
    <div className="h-screen w-screen overflow-hidden bg-slate-950 text-slate-200 font-sans selection:bg-blue-500/30 flex flex-col">

      {/* Overlays */}
      {isToolManagerOpen && <ToolManager onClose={toggleToolManager} />}
      
      {isTreeOpen && (
        <TreeViewPanel 
          onSelectNode={(nodeId) => {
            setHeadId(nodeId);
            toggleTree();
          }}
          onClose={toggleTree}
        />
      )}

      {/* [新增] 控制台面板 (覆盖在底部) */}
      <ConsolePanel />

      <PanelGroup direction="horizontal" className="flex-1">
        {/* Left Sidebar */}
        {isSidebarOpen && (
          <>
            <Panel defaultSize={20} minSize={15} maxSize={30} order={1}>
              <ConfigPanel onCloseMobile={toggleSidebar} />
            </Panel>
            <PanelResizeHandle className="w-1 bg-slate-800 hover:bg-blue-600 transition-colors" />
          </>
        )}

        {/* Middle Workspace */}
        {isFilePanelOpen && (
          <>
            <Panel defaultSize={40} minSize={20} order={2}>
               <FileWorkspace />
            </Panel>
            <PanelResizeHandle className="w-1 bg-slate-800 hover:bg-blue-600 transition-colors" />
          </>
        )}

        {/* Right Chat */}
        <Panel order={3} minSize={30}>
           <ChatInterface />
        </Panel>
      </PanelGroup>
    </div>
  );
};

function App() {
  return (
    <BrainProvider>
      <MainLayout />
    </BrainProvider>
  );
}

export default App;