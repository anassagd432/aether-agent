import React, { Suspense, lazy } from 'react';
import APIKeySettings from './APIKeySettings';
import { useTimeTravel } from '../hooks/useTimeTravel';
import { useProjectPersistence } from '../hooks/useProjectPersistence';
import { useBuilderLogic } from '../hooks/useBuilderLogic';

// IDE Components
import { BuilderHeader } from './ide/BuilderHeader';

const ChatPanel = lazy(() => import('./ide/ChatPanel').then(m => ({ default: m.ChatPanel })));
const PreviewPanel = lazy(() => import('./ide/PreviewPanel').then(m => ({ default: m.PreviewPanel })));
const EditorPanel = lazy(() => import('./ide/EditorPanel').then(m => ({ default: m.EditorPanel })));

interface BuilderProps {
  onBack?: () => void;
  wizardSpec?: string;
}

const SUGGESTION_PILLS = [
  { label: 'Add Authentication', icon: '🔐' },
  { label: 'Add Dark Mode Toggle', icon: '🌙' },
  { label: 'Add Analytics Charts', icon: '📊' },
  { label: 'Deploy to Vercel', icon: '🚀' },
];

const PanelFallback: React.FC = () => (
  <div className="flex items-center justify-center h-full w-full text-slate-500 text-sm">
    Loading...
  </div>
);

const Builder: React.FC<BuilderProps> = ({ onBack, wizardSpec }) => {
  // Logic extracted to hook
  const { state, hooks, handlers } = useBuilderLogic();
  const timeTravel = useTimeTravel();
  const persistence = useProjectPersistence();

  // Auto-start generation from wizard spec
  React.useEffect(() => {
    if (wizardSpec && !state.isThinking && state.fileTree.length === 0) {
      // Check if API key is available before auto-triggering
      if (!state.hasAPIKeys) {
        // Show the API key settings so the user can configure one
        state.setShowAPIKeySettings(true);
        // Put the wizard spec into the chat input so the user can send it once key is set
        state.setChatInput(wizardSpec);
        return;
      }

      // API key is set — auto-trigger generation
      state.setChatInput(wizardSpec);
      const timer = setTimeout(() => {
        handlers.handleGenerateApp(wizardSpec);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [wizardSpec, state.hasAPIKeys]);

  return (
    <div className="h-screen w-full flex flex-col p-2 md:p-4 gap-4 overflow-hidden bg-transparent">
      <BuilderHeader
        onBack={onBack}
        selectedModel={state.selectedModel}
        setSelectedModel={state.setSelectedModel}
        persistence={persistence}
        serverStatus={state.serverStatus}
        hasAPIKeys={state.hasAPIKeys}
        setShowAPIKeySettings={state.setShowAPIKeySettings}
        handleImportProject={handlers.handleImportProject}
        handleExportProject={handlers.handleExportProject}
        handleNewProject={() => {
          handlers.handleNewProject();
          persistence.clearCurrentProject();
        }}
        handleLoadProject={(id) => handlers.handleLoadProject(id, persistence.loadProject)}
        canExport={state.fileTree.length > 0}
        timeTravel={timeTravel}
        setShowVercelModal={state.setShowVercelModal}
      />

      {/* Main Workspace */}
      <div className="flex-1 flex flex-col lg:flex-row gap-4 min-h-0">
        <Suspense fallback={<PanelFallback />}>
          <ChatPanel
            chatMessages={state.chatMessages}
            chatInput={state.chatInput}
            setChatInput={state.setChatInput}
            onSendMessage={handlers.handleSendMessage}
            isThinking={state.isThinking}
            thinkingElapsed={state.thinkingElapsed}
            serverStatus={state.serverStatus}
            brainMode={state.brainMode}
            setBrainMode={state.setBrainMode}
            selectedModel={state.selectedModel}
            setSelectedModel={state.setSelectedModel}
            autonomousAgent={hooks.autonomousAgent}
            voice={hooks.voice}
            showSuggestions={state.showSuggestions}
            setShowSuggestions={state.setShowSuggestions}
            suggestionPills={SUGGESTION_PILLS}
            showSteps={state.showSteps}
            setShowSteps={state.setShowSteps}
          />
        </Suspense>

        <Suspense fallback={<PanelFallback />}>
          <PreviewPanel
            activeTab={state.activeTab}
            setActiveTab={state.setActiveTab}
            serverStatus={state.serverStatus}
            iframeUrl={state.iframeUrl}
            setIframeUrl={state.setIframeUrl}
            viewMode={state.viewMode}
            setViewMode={state.setViewMode}
            terminalLogs={state.terminalLogs}
            brainMode={state.brainMode}
            autonomousAgent={hooks.autonomousAgent}
          >
            <Suspense fallback={<PanelFallback />}>
              <EditorPanel
                fileTree={state.fileTree}
                activeFile={state.activeFile}
                activeFileContent={state.activeFileContent}
                handleFileSelect={handlers.handleFileSelect}
              />
            </Suspense>
          </PreviewPanel>
        </Suspense>
      </div>

      {/* Modals */}
      {state.showAPIKeySettings && <APIKeySettings onClose={() => state.setShowAPIKeySettings(false)} />}
    </div>
  );
};

export default Builder;
