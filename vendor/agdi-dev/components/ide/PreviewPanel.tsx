import React, { useRef, useEffect } from 'react';
import { Eye, Code2, Monitor, Smartphone, ChevronRight, RefreshCw, Globe, Terminal as TerminalIcon, Brain } from 'lucide-react';
import { LOG_COLORS, LOG_ICONS } from '../../hooks/useAutonomousAgent';

// Types
type ServerStatus = 'stopped' | 'starting' | 'running' | 'error';
type ViewMode = 'desktop' | 'tablet' | 'mobile';

interface PreviewPanelProps {
  activeTab: 'preview' | 'code';
  setActiveTab: (val: 'preview' | 'code') => void;
  serverStatus: ServerStatus;
  iframeUrl: string | null;
  setIframeUrl: (val: string | null) => void; // Should accept null
  viewMode: ViewMode;
  setViewMode: (val: ViewMode) => void;
  terminalLogs: string[];
  brainMode: boolean;
  autonomousAgent: any; // Type properly
  // For Code Tab (we'll implement this properly later, for now just a placeholder or children)
  children?: React.ReactNode;
}

export const PreviewPanel: React.FC<PreviewPanelProps> = ({
  activeTab,
  setActiveTab,
  serverStatus,
  iframeUrl,
  setIframeUrl,
  viewMode,
  setViewMode,
  terminalLogs,
  brainMode,
  autonomousAgent,
  children
}) => {
  const terminalRef = useRef<HTMLDivElement>(null);

  // Auto-scroll terminal
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [terminalLogs, autonomousAgent.logs]);

  return (
    <div className="flex-1 flex flex-col bg-slate-950/60 backdrop-blur-2xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl min-w-0">

      {/* Workbench Tabs */}
      <div className="h-12 flex items-center justify-between px-2 border-b border-white/5 bg-white/5">
        <div className="flex bg-slate-950/50 rounded-lg p-1 border border-white/5">
          <button
            onClick={() => setActiveTab('preview')}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-xs font-bold transition-all ${activeTab === 'preview' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
          >
            <Eye className="w-3 h-3" /> Preview
          </button>
          <button
            onClick={() => setActiveTab('code')}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-xs font-bold transition-all ${activeTab === 'code' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
          >
            <Code2 className="w-3 h-3" /> Code
          </button>
        </div>

        <div className="flex items-center gap-3 pr-2">
          <div className="flex items-center gap-1 text-slate-500 bg-slate-950/30 rounded-md px-2 py-1 border border-white/5">
            <Monitor className="w-3 h-3 hover:text-white cursor-pointer" />
            <div className="w-px h-3 bg-white/10"></div>
            <Smartphone className="w-3 h-3 hover:text-white cursor-pointer" />
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 relative overflow-hidden bg-slate-950/50">

        {/* PREVIEW TAB (Terminal or Mock) */}
        {activeTab === 'preview' && (
          <div className="absolute inset-0 flex flex-col">
            {/* Browser Bar - Lovable Style */}
            <div className="h-10 bg-slate-900 border-b border-white/5 flex items-center px-3 gap-2 shrink-0">
              {/* Traffic lights */}
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500/30 border border-red-500/50 hover:bg-red-500 transition-colors cursor-pointer"></div>
                <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/30 border border-yellow-500/50 hover:bg-yellow-500 transition-colors cursor-pointer"></div>
                <div className="w-2.5 h-2.5 rounded-full bg-green-500/30 border border-green-500/50 hover:bg-green-500 transition-colors cursor-pointer"></div>
              </div>

              {/* Navigation buttons */}
              <div className="flex items-center gap-1 ml-2">
                <button className="p-1 text-slate-500 hover:text-white hover:bg-white/5 rounded transition-colors">
                  <ChevronRight className="w-3.5 h-3.5 rotate-180" />
                </button>
                <button className="p-1 text-slate-500 hover:text-white hover:bg-white/5 rounded transition-colors">
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setIframeUrl(iframeUrl)} // Refresh hack
                  className="p-1 text-slate-500 hover:text-white hover:bg-white/5 rounded transition-colors"
                  title="Refresh"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* URL bar */}
              <div className="flex-1 max-w-lg mx-2 bg-slate-950/80 border border-white/10 rounded-lg px-3 py-1.5 flex items-center gap-2">
                {serverStatus === 'running' && (
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                )}
                <span className="text-[11px] text-slate-400 font-mono truncate">
                  {iframeUrl || 'http://localhost:5173/'}
                </span>
              </div>

              {/* Right controls */}
              <div className="flex items-center gap-2">
                {/* Responsive toggles */}
                <div className="flex items-center gap-0.5 bg-slate-950/50 rounded-lg p-0.5 border border-white/5">
                  <button
                    onClick={() => setViewMode('desktop')}
                    className={`p-1.5 rounded transition-colors ${viewMode === 'desktop' ? 'text-cyan-400 bg-white/10' : 'text-slate-500 hover:text-white'}`}
                    title="Desktop view"
                  >
                    <Monitor className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setViewMode('mobile')}
                    className={`p-1.5 rounded transition-colors ${viewMode === 'mobile' ? 'text-cyan-400 bg-white/10' : 'text-slate-500 hover:text-white'}`}
                    title="Mobile view"
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Open in new tab */}
                {iframeUrl && (
                  <button
                    onClick={() => window.open(iframeUrl, '_blank')}
                    className="p-1.5 text-slate-500 hover:text-white hover:bg-white/5 rounded transition-colors"
                    title="Open in new tab"
                  >
                    <Globe className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 relative bg-slate-900 overflow-hidden">

              {/* STATE 1: IDLE */}
              {serverStatus === 'stopped' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 gap-4 p-8 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-slate-800/50 border border-white/5 flex items-center justify-center">
                    <TerminalIcon className="w-8 h-8 opacity-50" />
                  </div>
                  <p className="text-sm font-medium">Ready to Build</p>
                  <p className="text-xs text-slate-600 max-w-xs">Enter a prompt in the AI Architect panel to generate a new application.</p>
                </div>
              )}

              {/* STATE 2: GENERATING (TERMINAL / NEURAL FEED) */}
              {(serverStatus === 'starting' || serverStatus === 'error') && (
                <div className="absolute inset-0 bg-[#0d1117] p-6 font-mono text-xs overflow-auto border-t border-cyan-500/10 shadow-[inset_0_0_40px_rgba(34,211,238,0.03)]" ref={terminalRef}>
                  {/* Brain Mode: Show Neural Feed */}
                  {brainMode && autonomousAgent.logs.length > 0 ? (
                    <>
                      <div className="flex items-center gap-2 mb-4 text-cyan-400 border-b border-cyan-500/20 pb-2">
                        <Brain className="w-4 h-4 animate-pulse" />
                        <span className="text-sm font-bold">Neural Feed</span>
                        <span className="text-xs text-slate-500">• {autonomousAgent.status}</span>
                      </div>
                      {autonomousAgent.logs.map((log: any) => (
                        <div key={log.id} className="mb-1.5 break-words flex items-start gap-2">
                          <span className="text-slate-600 shrink-0">{new Date(log.timestamp).toLocaleTimeString()}</span>
                          <span className="shrink-0">{LOG_ICONS[log.type]}</span>
                          <span className={LOG_COLORS[log.type]}>
                            {log.message}
                          </span>
                        </div>
                      ))}
                    </>
                  ) : (
                    /* Standard Mode: Show terminal logs */
                    terminalLogs.map((log, i) => (
                      <div key={i} className="mb-1 break-words">
                        <span className="text-slate-500">{new Date().toLocaleTimeString()}</span>{' '}
                        <span className={log.startsWith('>') ? 'text-yellow-400 font-bold' : log.startsWith('✓') ? 'text-green-400' : log.startsWith('Error') ? 'text-red-400' : 'text-slate-300'}>
                          {log}
                        </span>
                      </div>
                    ))
                  )}
                  {serverStatus === 'starting' && (
                    <div className="w-2 h-4 bg-slate-500 animate-pulse mt-1 inline-block"></div>
                  )}
                </div>
              )}

              {/* STATE 3: RUNNING (IFRAME) */}
              {serverStatus === 'running' && iframeUrl && (
                <div className={`w-full h-full bg-white transition-all duration-300 mx-auto border-x border-white/5 shadow-2xl ${viewMode === 'mobile' ? 'max-w-[375px]' : viewMode === 'tablet' ? 'max-w-[768px]' : 'w-full'
                  }`}>
                  <iframe
                    src={iframeUrl}
                    className="w-full h-full border-none"
                    title="App Preview"
                    sandbox="allow-forms allow-modals allow-pointer-lock allow-popups allow-same-origin allow-scripts allow-top-navigation-by-user-activation"
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* CODE TAB */}
        {activeTab === 'code' && (
          <div className="absolute inset-0 flex flex-col bg-[#0d1117]">
             {children}
          </div>
        )}

      </div>
    </div>
  );
};
