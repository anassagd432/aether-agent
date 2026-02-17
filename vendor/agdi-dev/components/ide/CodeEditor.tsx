import React from 'react';
// Editor component removed - using inline implementation

interface CodeEditorProps {
  activeFile: string | null;
  content: string;
  readOnly?: boolean;
}

export const CodeEditor: React.FC<CodeEditorProps> = ({ activeFile, content, readOnly = true }) => {
  if (!activeFile) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-[#0d1117] text-slate-500">
        <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-4">
          <span className="text-4xl">📝</span>
        </div>
        <p className="text-sm font-medium">Select a file to view code</p>
        <p className="text-xs text-slate-600 mt-2">Generated source code will appear here</p>
      </div>
    );
  }

  // Simple syntax highlighting simulation for now
  return (
    <div className="flex-1 flex flex-col h-full bg-[#0d1117]">
      <div className="flex items-center justify-between px-4 py-2 bg-slate-900/50 border-b border-white/5">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-slate-400">{activeFile}</span>
          {readOnly && <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-slate-500">Read-only</span>}
        </div>
        <div className="text-[10px] text-slate-600">TypeScript</div>
      </div>
      <div className="flex-1 overflow-auto relative">
        <textarea
          value={content}
          readOnly={readOnly}
          className="w-full h-full bg-transparent p-4 font-mono text-sm text-slate-300 focus:outline-none resize-none leading-6 tab-4"
          spellCheck={false}
        />
      </div>
    </div>
  );
};
