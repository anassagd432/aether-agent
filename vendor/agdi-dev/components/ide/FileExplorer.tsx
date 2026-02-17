import React, { useState } from 'react';
import { Folder, FolderOpen, FileText, FileCode, ChevronRight, Package, Cog, Palette, Braces, FileType, Hash, FileJson, Zap } from 'lucide-react';
import { FileNode } from '../../lib/agdi-architect';

// File icon configuration
const getFileIcon = (filename: string) => {
  const ext = filename.split('.').pop()?.toLowerCase();
  const name = filename.toLowerCase();
  if (name === 'package.json') return { icon: Package, color: 'text-green-400' };
  if (name === 'tsconfig.json') return { icon: Cog, color: 'text-blue-400' };
  if (name === 'tailwind.config.js' || name === 'tailwind.config.ts') return { icon: Palette, color: 'text-cyan-400' };
  if (name === 'vite.config.ts' || name === 'vite.config.js') return { icon: Zap, color: 'text-cyan-400' };
  if (name.includes('.env')) return { icon: FileText, color: 'text-yellow-400' };
  switch (ext) {
    case 'tsx': return { icon: Braces, color: 'text-blue-400' };
    case 'ts': return { icon: FileType, color: 'text-blue-500' };
    case 'jsx': return { icon: Braces, color: 'text-yellow-400' };
    case 'js': return { icon: FileType, color: 'text-yellow-500' };
    case 'css': return { icon: Hash, color: 'text-cyan-400' };
    case 'json': return { icon: FileJson, color: 'text-yellow-300' };
    case 'html': return { icon: FileCode, color: 'text-orange-400' };
    case 'md': return { icon: FileText, color: 'text-blue-300' };
    default: return { icon: FileText, color: 'text-slate-400' };
  }
};

const getFolderIcon = (folderName: string, isOpen: boolean) => {
  const name = folderName.toLowerCase();
  const Icon = isOpen ? FolderOpen : Folder;
  if (name === 'components') return { icon: Icon, color: 'text-cyan-400' };
  if (name === 'src') return { icon: Icon, color: 'text-blue-400' };
  return { icon: Icon, color: 'text-slate-400' };
};

interface FileExplorerProps {
  files: FileNode[];
  activeFile: string | null;
  onFileSelect: (filename: string, content: string) => void;
}

export const FileExplorer: React.FC<FileExplorerProps> = ({ files, activeFile, onFileSelect }) => {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['src', 'components', 'lib']));

  const toggleFolder = (folderPath: string) => {
    setExpandedFolders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(folderPath)) newSet.delete(folderPath); else newSet.add(folderPath);
      return newSet;
    });
  };

  const renderTree = (nodes: FileNode[], depth = 0, parentPath = '') => {
    return nodes.map((node) => {
      const nodePath = parentPath ? `${parentPath}/${node.name}` : node.name;
      const isExpanded = expandedFolders.has(node.name) || expandedFolders.has(nodePath);
      
      if (node.type === 'folder') {
        const { icon: FolderIcon, color } = getFolderIcon(node.name, isExpanded);
        return (
          <div key={nodePath} className="select-none">
            <div 
              className="flex items-center gap-1.5 py-1 px-2 cursor-pointer hover:bg-white/5 rounded-md transition-colors group" 
              style={{ paddingLeft: `${depth * 16 + 8}px` }} 
              onClick={() => toggleFolder(node.name)}
            >
              <ChevronRight className={`w-3 h-3 text-slate-500 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`} />
              <FolderIcon className={`w-4 h-4 ${color}`} />
              <span className="text-sm font-medium text-slate-300 group-hover:text-white truncate">{node.name}</span>
            </div>
            {isExpanded && node.children && <div className="border-l border-white/5 ml-4">{renderTree(node.children, depth + 1, nodePath)}</div>}
          </div>
        );
      } else {
        const { icon: FileIcon, color } = getFileIcon(node.name);
        return (
          <div key={nodePath} className="select-none">
            <div 
              className={`flex items-center gap-2 py-1 px-2 cursor-pointer hover:bg-white/5 rounded-md transition-colors group ${activeFile === node.name ? 'bg-cyan-900/30 border-l-2 border-cyan-400' : ''}`} 
              style={{ paddingLeft: `${depth * 16 + 24}px` }} 
              onClick={() => onFileSelect(node.name, node.content || '')}
            >
              <FileIcon className={`w-4 h-4 ${activeFile === node.name ? 'text-cyan-400' : color}`} />
              <span className={`text-sm font-mono truncate ${activeFile === node.name ? 'text-cyan-300' : 'text-slate-400 group-hover:text-white'}`}>{node.name}</span>
            </div>
          </div>
        );
      }
    });
  };

  return (
    <div className="w-64 bg-slate-900/50 border-r border-white/5 flex flex-col h-full">
      <div className="p-3 border-b border-white/5 flex items-center justify-between shrink-0">
        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Explorer</span>
        <span className="text-[10px] text-slate-600 font-mono">{files.length} files</span>
      </div>
      <div className="flex-1 overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
        {files.length > 0 ? renderTree(files) : (
          <div className="flex flex-col items-center justify-center h-40 text-slate-600 text-sm italic">
            <span>No files generated yet</span>
          </div>
        )}
      </div>
    </div>
  );
};
