import React from 'react';
import { Zap, ArrowLeft, Settings, Download, Share2, Upload } from 'lucide-react';
import ModelSelector from '../ModelSelector';
import { ProjectPicker } from '../ProjectPicker';
import { TimelineCompact } from '../TimelineSlider';

interface BuilderHeaderProps {
  onBack?: () => void;
  selectedModel: string;
  setSelectedModel: (model: string) => void;
  persistence: {
    currentProject: { id: string } | null;
    savedProjects: any[];
    lastSavedAt: number | null;
    isLoading: boolean;
    loadProject: (id: string) => Promise<void>;
    deleteProject: (id: string) => Promise<void>;
  };
  serverStatus: 'stopped' | 'starting' | 'running' | 'error';
  hasAPIKeys: boolean;
  setShowAPIKeySettings: (value: boolean) => void;
  handleImportProject: () => void;
  handleExportProject: () => void;
  handleNewProject: () => void;
  handleLoadProject: (id: string) => Promise<void>;
  canExport: boolean;
  timeTravel: {
    snapshots: any[];
    currentIndex: number;
    canUndo: boolean;
    canRedo: boolean;
    undo: () => void;
    redo: () => void;
  };
  setShowVercelModal: (value: boolean) => void;
}

export const BuilderHeader: React.FC<BuilderHeaderProps> = ({
  onBack,
  selectedModel,
  setSelectedModel,
  persistence,
  serverStatus,
  hasAPIKeys,
  setShowAPIKeySettings,
  handleImportProject,
  handleExportProject,
  handleNewProject,
  handleLoadProject,
  canExport,
  timeTravel,
  setShowVercelModal,
}) => {
  return (
    <header className="flex items-center justify-between px-2 shrink-0 h-12">
      <div className="flex items-center gap-4">
        <button onClick={onBack} className="p-2 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500/20 to-cyan-500/20 border border-white/10 flex items-center justify-center">
            <Zap className="w-4 h-4 text-cyan-400" />
          </div>
          <span className="font-bold text-white tracking-tight">Agdi<span className="text-cyan-400">.build</span></span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <ModelSelector selectedModel={selectedModel} onModelSelect={setSelectedModel} className="hidden md:block" />
        <ProjectPicker 
          currentProjectId={persistence.currentProject?.id || null} 
          savedProjects={persistence.savedProjects} 
          lastSavedAt={persistence.lastSavedAt} 
          isLoading={persistence.isLoading} 
          onNewProject={handleNewProject} 
          onLoadProject={handleLoadProject} 
          onDeleteProject={persistence.deleteProject} 
        />
        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-slate-900/50 border border-white/5 rounded-full mr-2">
          <div className={`w-2 h-2 rounded-full ${serverStatus === 'running' ? 'bg-green-500 animate-pulse' : serverStatus === 'starting' ? 'bg-yellow-500 animate-pulse' : 'bg-slate-500'}`}></div>
          <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">{serverStatus === 'running' ? 'Connected' : serverStatus === 'starting' ? 'Building' : 'Idle'}</span>
        </div>
        <button onClick={() => { console.log('Clicked Setup API Keys'); setShowAPIKeySettings(true); }} className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium border rounded-lg transition-all ${hasAPIKeys ? 'bg-white/5 backdrop-blur-xl border-white/10 text-slate-300' : 'text-cyan-300 bg-cyan-500/10 border-cyan-500/30 animate-pulse'}`} title={hasAPIKeys ? 'API Settings' : 'Configure API Keys to start'}>
          <Settings className="w-3.5 h-3.5" />{!hasAPIKeys && <span>Setup API Keys</span>}
        </button>
        <button onClick={handleImportProject} className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 border border-white/10 text-slate-300 hover:text-white rounded-lg transition-all" title="Import Project from ZIP">
          <Upload className="w-3.5 h-3.5" /><span className="hidden lg:inline">Import</span>
        </button>
        <button onClick={handleExportProject} disabled={!canExport} className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium bg-cyan-600 hover:bg-cyan-500 border border-cyan-500/50 text-white rounded-lg transition-all disabled:opacity-40" title="Download Project as ZIP">
          <Download className="w-3.5 h-3.5" /><span className="hidden lg:inline">Download</span>
        </button>
        <TimelineCompact snapshotCount={timeTravel.snapshots.length} currentIndex={timeTravel.currentIndex} canUndo={timeTravel.canUndo} canRedo={timeTravel.canRedo} onUndo={() => timeTravel.undo()} onRedo={() => timeTravel.redo()} />
        <button onClick={() => alert('Share feature coming soon!')} className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-300 bg-white/5 backdrop-blur-xl border border-white/10 rounded-lg hover:bg-white/10 transition-all">
          <Share2 className="w-3.5 h-3.5" />Share
        </button>
        <button onClick={() => setShowVercelModal(true)} disabled={serverStatus !== 'running'} className="flex items-center gap-2 px-4 py-1.5 text-xs font-bold text-slate-950 bg-gradient-to-r from-cyan-400 to-cyan-500 hover:from-cyan-300 hover:to-cyan-400 rounded-lg transition-all shadow-[0_0_20px_rgba(34,211,238,0.3)] disabled:opacity-50">
          <Zap className="w-3.5 h-3.5" />Publish
        </button>
      </div>
    </header>
  );
};
