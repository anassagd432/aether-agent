import React, { useRef, useEffect } from 'react';
import { Send, Mic, StopCircle, Sparkles, Brain, Loader2 } from 'lucide-react';
import { ChatMessage } from './ChatPanel';

interface AgentChatProps {
  messages: ChatMessage[];
  input: string;
  setInput: (value: string) => void;
  onSend: (e: React.FormEvent) => void;
  isThinking: boolean;
  isListening?: boolean;
  onToggleVoice?: () => void;
  showSuggestions?: boolean;
  suggestions?: { label: string; icon: string }[];
  onSuggestionClick?: (suggestion: string) => void;
}

export const AgentChat: React.FC<AgentChatProps> = ({
  messages,
  input,
  setInput,
  onSend,
  isThinking,
  isListening,
  onToggleVoice,
  showSuggestions,
  suggestions = [],
  onSuggestionClick
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isThinking]);

  return (
    <div className="flex flex-col h-full bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-white/5 bg-white/5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-sm font-medium text-white">Agdi Architect</span>
        </div>
        <div className="text-[10px] text-slate-500 font-mono">v{APP_VERSION}</div>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-thin scrollbar-thumb-slate-700"
      >
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
          >
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${msg.role === 'ai' ? 'bg-cyan-500/20 text-cyan-400' : 'bg-cyan-500/20 text-cyan-400'
              }`}>
              {msg.role === 'ai' ? <Brain size={16} /> : <span className="text-xs font-bold">YOU</span>}
            </div>
            <div className={`max-w-[85%] rounded-2xl p-4 text-sm leading-relaxed shadow-lg ${msg.role === 'ai'
                ? 'bg-slate-800 text-slate-200 rounded-tl-none border border-white/5'
                : 'bg-gradient-to-br from-cyan-600 to-blue-600 text-white rounded-tr-none'
              }`}>
              {msg.text}
              {msg.steps && (
                <div className="mt-4 space-y-2 border-t border-white/10 pt-3">
                  {msg.steps.map((step, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <div className={`w-1.5 h-1.5 rounded-full ${step.status === 'done' ? 'bg-green-400' : 'bg-slate-500'}`} />
                      <span className="text-slate-400 font-mono">{step.target}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {isThinking && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/20 flex items-center justify-center shrink-0">
              <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />
            </div>
            <div className="bg-slate-800 rounded-2xl rounded-tl-none p-4 border border-white/5">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <Sparkles className="w-3 h-3 text-yellow-400" />
                <span>Generating application plan...</span>
              </div>
            </div>
          </div>
        )}

        {/* Suggestions */}
        {showSuggestions && !isThinking && suggestions.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4">
            {suggestions.map((suggestion, idx) => (
              <button
                key={idx}
                onClick={() => onSuggestionClick?.(suggestion.label)}
                className="flex items-center gap-2 p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 text-left transition-all hover:scale-[1.02] group"
              >
                <span className="text-lg">{suggestion.icon}</span>
                <span className="text-xs text-slate-300 group-hover:text-white font-medium">{suggestion.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="p-4 bg-slate-900 border-t border-white/5">
        <form onSubmit={onSend} className="relative flex items-end gap-2 bg-slate-800/50 rounded-xl border border-white/10 p-2 focus-within:border-cyan-500/50 focus-within:ring-1 focus-within:ring-cyan-500/20 transition-all">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                onSend(e);
              }
            }}
            placeholder="Describe your app..."
            className="flex-1 bg-transparent border-0 focus:ring-0 text-white placeholder-slate-500 text-sm resize-none max-h-32 py-2 px-2"
            rows={1}
            disabled={isThinking}
          />
          <div className="flex items-center gap-1 pb-1">
            {onToggleVoice && (
              <button
                type="button"
                onClick={onToggleVoice}
                className={`p-2 rounded-lg transition-colors ${isListening
                    ? 'bg-red-500/20 text-red-400 animate-pulse'
                    : 'hover:bg-white/10 text-slate-400 hover:text-white'
                  }`}
              >
                {isListening ? <StopCircle size={18} /> : <Mic size={18} />}
              </button>
            )}
            <button
              type="submit"
              disabled={!input.trim() || isThinking}
              className="p-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Send size={18} />
            </button>
          </div>
        </form>
        <div className="mt-2 text-center">
          <p className="text-[10px] text-slate-600">
            Press <kbd className="font-sans px-1 py-0.5 rounded bg-white/10 border border-white/5 text-slate-400">Enter</kbd> to send
          </p>
        </div>
      </div>
    </div>
  );
};
