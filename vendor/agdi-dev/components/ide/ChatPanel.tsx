import React, { useRef, useEffect } from 'react';
import { Bot, ChevronDown, Loader2, Send, Mic, Brain, Square } from 'lucide-react';
import ModelSelector from '../ModelSelector';

// Types (Shared)
export interface GenerationStep {
  type: 'install' | 'create' | 'edit' | 'info';
  target: string;
  status: 'pending' | 'done';
}

export interface ChatMessage {
  role: 'user' | 'ai';
  text: string;
  isThinking?: boolean;
  thinkingTime?: number;
  steps?: GenerationStep[];
  isStepsExpanded?: boolean;
}

interface ChatPanelProps {
  chatMessages: ChatMessage[];
  chatInput: string;
  setChatInput: (val: string) => void;
  onSendMessage: (e: React.FormEvent) => void;
  isThinking: boolean;
  thinkingElapsed: number;
  serverStatus: string;
  brainMode: boolean;
  setBrainMode: (val: boolean) => void;
  selectedModel: string;
  setSelectedModel: (val: string) => void;
  autonomousAgent: any; // Type this properly if possible
  voice: any; // Type this properly if possible
  showSuggestions: boolean;
  setShowSuggestions: (val: boolean) => void;
  suggestionPills: Array<{ label: string, icon: string }>;
  showSteps: boolean;
  setShowSteps: (val: boolean) => void;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({
  chatMessages,
  chatInput,
  setChatInput,
  onSendMessage,
  isThinking,
  thinkingElapsed,
  serverStatus,
  brainMode,
  setBrainMode,
  selectedModel,
  setSelectedModel,
  autonomousAgent,
  voice,
  showSuggestions,
  setShowSuggestions,
  suggestionPills,
  showSteps,
  setShowSteps
}) => {
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, isThinking]);

  return (
    <div className="w-full lg:w-[400px] xl:w-[450px] flex flex-col bg-slate-950/60 backdrop-blur-2xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl shrink-0">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-white/5">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
          <Bot className="w-3 h-3 text-cyan-400" />
          Architect AI
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {chatMessages.map((msg, idx) => (
          <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            {msg.role === 'ai' && (
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-cyan-500/20 to-cyan-500/20 border border-white/10 flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4 text-cyan-300" />
              </div>
            )}
            <div className={`max-w-[85%] ${msg.role === 'user' ? '' : ''}`}>
              {/* Thinking time badge */}
              {msg.thinkingTime !== undefined && (
                <div className="flex items-center gap-2 mb-2">
                  <div className="px-2 py-1 bg-cyan-500/20 border border-cyan-500/30 rounded-full text-[10px] text-cyan-300 font-medium flex items-center gap-1">
                    <span>🧠</span> Thought for {msg.thinkingTime}s
                  </div>
                </div>
              )}

              {/* Message content */}
              <div className={`text-sm p-4 rounded-2xl leading-relaxed ${msg.role === 'ai'
                ? 'bg-white/5 text-slate-300 rounded-tl-none border border-white/5'
                : 'bg-cyan-600/20 text-cyan-50 border border-cyan-500/20 rounded-tr-none'
                }`}>
                {msg.text}
              </div>

              {/* Expandable steps */}
              {msg.steps && msg.steps.length > 0 && (
                <div className="mt-2">
                  <button
                    onClick={() => setShowSteps(!showSteps)}
                    className="flex items-center gap-2 text-[11px] text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    <ChevronDown className={`w-3 h-3 transition-transform ${showSteps ? 'rotate-180' : ''}`} />
                    {showSteps ? 'Hide' : 'Show'} {msg.steps.length} tool uses
                  </button>

                  {showSteps && (
                    <div className="mt-2 space-y-1 pl-2 border-l border-white/10">
                      {msg.steps.map((step, stepIdx) => (
                        <div key={stepIdx} className="flex items-center gap-2 text-[11px] text-slate-400">
                          <span className="text-green-400">✓</span>
                          <span className={step.type === 'install' ? 'text-yellow-300' : 'text-cyan-300'}>
                            {step.type === 'install' ? 'Installed' : step.type === 'create' ? 'Created' : 'Edited'}
                          </span>
                          <span className="text-slate-500 font-mono">{step.target}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Thinking indicator with live timer */}
        {isThinking && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-cyan-500/20 to-cyan-500/20 border border-white/10 flex items-center justify-center shrink-0">
              <Bot className="w-4 h-4 text-cyan-300" />
            </div>
            <div className="bg-white/5 text-slate-300 rounded-2xl rounded-tl-none border border-white/5 p-4">
              <div className="flex items-center gap-3">
                <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />
                <span className="text-sm">Thinking...</span>
                <span className="text-[11px] text-slate-500 font-mono">{thinkingElapsed}s</span>
              </div>
            </div>
          </div>
        )}

        {/* Suggestion pills */}
        {showSuggestions && (
          <div className="pt-2">
            <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Quick Actions</div>
            <div className="flex flex-wrap gap-2">
              {suggestionPills.map((pill, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setChatInput(pill.label);
                    setShowSuggestions(false);
                  }}
                  className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-cyan-500/30 rounded-full text-xs text-slate-400 hover:text-white transition-all flex items-center gap-1.5"
                >
                  <span>{pill.icon}</span>
                  <span>{pill.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      <div className="p-4 bg-slate-900/40 border-t border-white/5">
        {/* Model selector and Brain Mode toggle */}
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <ModelSelector
              selectedModel={selectedModel}
              onModelSelect={setSelectedModel}
              variant="compact"
              dropdownPosition="above"
            />
          </div>

          {/* Brain Mode Toggle */}
          <button
            onClick={() => setBrainMode(!brainMode)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${brainMode
              ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50 shadow-lg shadow-cyan-500/20'
              : 'bg-slate-800/50 text-slate-400 border-white/10 hover:text-cyan-300 hover:border-cyan-500/30'
              }`}
            title={brainMode ? 'Brain Mode: ON - Agent will autonomously build and iterate' : 'Brain Mode: OFF - Standard generation'}
          >
            <Brain className={`w-4 h-4 ${brainMode ? 'text-cyan-400' : ''}`} />
            <span>{brainMode ? 'Brain Mode' : 'Standard'}</span>
            <div className={`w-2 h-2 rounded-full ${brainMode ? 'bg-cyan-400 animate-pulse' : 'bg-slate-600'}`} />
          </button>
        </div>

        <form onSubmit={onSendMessage} className="relative group">
          <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/20 to-cyan-500/20 rounded-xl blur opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
          <input
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            className="w-full relative bg-slate-950/80 border border-white/10 rounded-xl pl-4 pr-24 py-3 text-sm text-white focus:outline-none focus:border-cyan-500/50 transition-all placeholder-slate-500"
            placeholder={brainMode ? 'Describe your goal (Agent will autonomously iterate)...' : 'Describe your app (e.g., "A Kanban board with dark mode")...'}
            disabled={serverStatus === 'starting' || autonomousAgent.isRunning}
          />

          {/* Abort button (when agent running) */}
          {autonomousAgent.isRunning && (
            <button
              type="button"
              onClick={() => autonomousAgent.stop()}
              className="absolute right-14 top-1/2 -translate-y-1/2 p-2 text-orange-400 hover:text-red-400 transition-colors z-10"
              title="Stop Agent"
            >
              <Square className="w-4 h-4" />
            </button>
          )}

          {/* Voice Input Button */}
          <button
            type="button"
            onClick={() => {
              if (voice.isListening) {
                voice.stopListening();
                if (voice.transcript) {
                  setChatInput((prev: string) => prev + voice.transcript);
                }
              } else {
                voice.startListening();
              }
            }}
            disabled={!voice.isSupported || serverStatus === 'starting'}
            className={`absolute right-14 top-1/2 -translate-y-1/2 p-2 transition-colors z-10 ${voice.isListening
              ? 'text-red-400 animate-pulse'
              : 'text-slate-400 hover:text-cyan-400'
              } disabled:opacity-30`}
            title={voice.isListening ? 'Stop recording' : 'Voice input (hold Space)'}
          >
            <Mic className="w-4 h-4" />
          </button>

          <button
            type="submit"
            disabled={serverStatus === 'starting' || autonomousAgent.isRunning}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-cyan-400 transition-colors z-10 disabled:opacity-50"
          >
            {brainMode ? <Brain className="w-4 h-4" /> : <Send className="w-4 h-4" />}
          </button>
        </form>

        {/* Voice Transcript Preview */}
        {voice.isListening && (voice.transcript || voice.interimTranscript) && (
          <div className="mt-2 px-3 py-2 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-300">
            <span className="text-red-400 mr-2">🎤</span>
            {voice.transcript}
            <span className="text-red-400/60">{voice.interimTranscript}</span>
          </div>
        )}
      </div>
    </div>
  );
};
