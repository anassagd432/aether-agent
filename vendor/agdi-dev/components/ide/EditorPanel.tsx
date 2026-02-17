import React, { Suspense, lazy } from 'react';
import { FileNode } from '../../lib/agdi-architect';

const FileExplorer = lazy(() => import('./FileExplorer').then(m => ({ default: m.FileExplorer })));
const CodeEditor = lazy(() => import('./CodeEditor').then(m => ({ default: m.CodeEditor })));

interface EditorPanelProps {
  fileTree: FileNode[];
  activeFile: string | null;
  activeFileContent: string;
  handleFileSelect: (filename: string, content: string) => void;
}

export const EditorPanel: React.FC<EditorPanelProps> = ({
  fileTree,
  activeFile,
  activeFileContent,
  handleFileSelect,
}) => {
  return (
    <div className="flex h-full w-full">
      <Suspense fallback={<div className="w-64 h-full bg-slate-900 animate-pulse" />}>
        <FileExplorer
          files={fileTree}
          activeFile={activeFile}
          onFileSelect={handleFileSelect}
        />
      </Suspense>
      <Suspense fallback={<div className="flex-1 h-full bg-slate-950 animate-pulse" />}>
        <CodeEditor
          activeFile={activeFile}
          content={activeFileContent}
          readOnly={true}
        />
      </Suspense>
    </div>
  );
};
