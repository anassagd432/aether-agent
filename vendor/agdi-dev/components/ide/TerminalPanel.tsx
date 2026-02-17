import React from 'react';
import { Terminal, Maximize2, Minimize2, Copy, Check } from 'lucide-react';

interface TerminalPanelProps {
  logs: string[];
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}

export const TerminalPanel: React.FC<TerminalPanelProps> = ({ logs, isExpanded, onToggleExpand }) => {
  const [copied, setCopied] = React.useState(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  const handleCopy = () => {
    navigator.clipboard.writeText(logs.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`flex flex-col bg-[#0d1117] border-t border-white/10 transition-all duration-300 ${isExpanded ? 'h-96' : 'h-32'}`}>
      <div className="flex items-center justify-between px-4 py-2 bg-slate-900 border-b border-white/5 select-none">
        <div className="flex items-center gap-2">
          <Terminal className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-xs font-medium text-slate-300">Terminal</span>
          <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-slate-500 font-mono">bash</span>
        </div>
        <div className="flex items-center gap-1">
          <button 
            onClick={handleCopy}
            className="p-1.5 hover:bg-white/5 rounded text-slate-500 hover:text-white transition-colors"
            title="Copy logs"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
          <button 
            onClick={onToggleExpand}
            className="p-1.5 hover:bg-white/5 rounded text-slate-500 hover:text-white transition-colors"
            title={isExpanded ? "Collapse" : "Expand"}
          >
            {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 font-mono text-xs leading-relaxed scrollbar-thin scrollbar-thumb-slate-700"
      >
        {logs.length === 0 ? (
          <div className="text-slate-600 italic">Waiting for build process...</div>
        ) : (
          logs.map((log, i) => (
            <div key={i} className="whitespace-pre-wrap break-all">
              {log.startsWith('>') ? (
                <span className="text-cyan-400 font-bold">{log}</span>
              ) : log.includes('Error') || log.includes('failed') ? (
                <span className="text-red-400">{log}</span>
              ) : log.includes('Success') || log.includes('Done') ? (
                <span className="text-green-400">{log}</span>
              ) : (
                <span className="text-slate-300">{log}</span>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
