import { useState, useEffect, useRef } from 'react';
import type React from 'react';
import { generateAppPlan, buildFileTree, FileNode, AppPlan } from '../lib/agdi-architect';
import { hasAnyAPIKey } from '../components/APIKeySettings';
import { useAutonomousAgent } from './useAutonomousAgent';
import { localProjectManager } from '../lib/local-project-manager';
import { sendNotification, hasWebhooksConfigured } from '../lib/notifications/webhook';
import { WebContainerService } from '../lib/webcontainer';
import type { ChatMessage, GenerationStep } from '../components/ide/ChatPanel';
import { useVoiceInput } from './useVoiceInput';

export type ServerStatus = 'stopped' | 'starting' | 'running' | 'error';

import { exportProjectAsZip } from '../lib/project-export';
import { importProjectFromZip } from '../lib/project-import';

export const useBuilderLogic = () => {
  // State
  const [activeTab, setActiveTab] = useState<'preview' | 'code'>('preview');
  const [chatInput, setChatInput] = useState('');
  const [fileTree, setFileTree] = useState<FileNode[]>([]);
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [activeFileContent, setActiveFileContent] = useState<string>('');
  const [serverStatus, setServerStatus] = useState<ServerStatus>('stopped');
  const [terminalLogs, setTerminalLogs] = useState<string[]>([]);
  const [iframeUrl, setIframeUrl] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<string>('gemini-2.5-flash');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { role: 'ai', text: 'Agdi Engine initialized. I can scaffold a full-stack application for you. What shall we build today?' }
  ]);
  const [isThinking, setIsThinking] = useState(false);
  const [thinkingStartTime, setThinkingStartTime] = useState<number | null>(null);
  const [thinkingElapsed, setThinkingElapsed] = useState(0);
  const [generationSteps, setGenerationSteps] = useState<GenerationStep[]>([]);
  const [showSteps, setShowSteps] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [viewMode, setViewMode] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [showVercelModal, setShowVercelModal] = useState(false);
  const [showAPIKeySettings, setShowAPIKeySettings] = useState(false);
  const [hasAPIKeys, setHasAPIKeys] = useState(hasAnyAPIKey());
  const [brainMode, setBrainMode] = useState(false);

  // Hooks
  const autonomousAgent = useAutonomousAgent();
  const voice = useVoiceInput();

  // Effects
  useEffect(() => { setHasAPIKeys(hasAnyAPIKey()); }, [showAPIKeySettings]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isThinking && thinkingStartTime) {
      interval = setInterval(() => setThinkingElapsed(Math.floor((Date.now() - thinkingStartTime) / 1000)), 100);
    }
    return () => clearInterval(interval);
  }, [isThinking, thinkingStartTime]);

  // Voice Auto-Submit Logic
  const voiceAutoSubmitRef = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    if (voice.isListening && (voice.transcript + voice.interimTranscript)) {
      setChatInput(voice.transcript + voice.interimTranscript);
    }
  }, [voice.transcript, voice.interimTranscript, voice.isListening]);

  useEffect(() => {
    if (voiceAutoSubmitRef.current) {
      clearTimeout(voiceAutoSubmitRef.current);
      voiceAutoSubmitRef.current = null;
    }
    if (!voice.isListening && voice.transcript && chatInput === voice.transcript) {
      voiceAutoSubmitRef.current = setTimeout(() => {
        if (chatInput.trim() && !isThinking && serverStatus !== 'starting') {
          const event = { preventDefault: () => { } } as React.FormEvent;
          handleSendMessage(event);
        }
      }, 1500);
    }
    return () => { if (voiceAutoSubmitRef.current) clearTimeout(voiceAutoSubmitRef.current); };
  }, [voice.isListening, voice.transcript, chatInput, isThinking, serverStatus]);

  const handleGenerateApp = async (prompt: string) => {
    if (!hasAPIKeys) {
      // Still allow generation — offline fallback will handle it
      setChatMessages(prev => [...prev, { role: 'ai', text: '⚡ No API keys configured — generating with offline templates. Add a Gemini key in ⚙️ Settings for AI-powered generation.' }]);
    }
    setServerStatus('starting');
    setActiveTab('preview');
    setIframeUrl(null);
    setShowSuggestions(false);
    setGenerationSteps([]);
    setShowSteps(false);
    setIsThinking(true);
    setThinkingStartTime(Date.now());
    setThinkingElapsed(0);
    setTerminalLogs([`> agdi-architect init --prompt "${prompt.substring(0, 30)}..."`]);

    const project = localProjectManager.createProject(`App: ${prompt.substring(0, 50)}`, prompt);
    setTerminalLogs(prev => [...prev, `📦 Local project created (ID: ${project.id.substring(0, 8)}...)`]);

    try {
      if (hasWebhooksConfigured()) sendNotification('build_start', { projectName: project.name, message: `Started building: ${prompt.substring(0, 100)}...` }).catch(() => { });

      // Cloud Memory: retrieve relevant past context (if signed in)
    let promptWithMemory = prompt;
    try {
      const { getSupabase } = await import('../lib/supabase');
      const supabase = getSupabase();
      if (supabase) {
        const { data: sess } = await supabase.auth.getSession();
        const accessToken = sess.session?.access_token;
        const userId = sess.session?.user?.id;
        const localProject = localProjectManager.getCurrentProject();

        if (accessToken && userId && localProject) {
          const { ensureCloudProject, retrieveMemoryContext } = await import('../lib/cloud-memory');
          const cloudProjectId = await ensureCloudProject({
            supabase,
            localProjectId: localProject.id,
            userId,
            name: localProject.name,
            description: localProject.initialPrompt,
          });

          const mem = await retrieveMemoryContext({
            supabase,
            projectId: cloudProjectId,
            accessToken,
            query: prompt,
            topK: 8,
          });

          if (mem) promptWithMemory = `${prompt}\n\n${mem}`;
        }
      }
    } catch {
      // ignore memory failures
    }

    const plan: AppPlan = await generateAppPlan(promptWithMemory, selectedModel);

      const finalThinkingTime = Math.floor((Date.now() - (thinkingStartTime || Date.now())) / 1000);
      setIsThinking(false);
      setChatMessages(prev => [...prev, { role: 'ai', text: `Thought for ${finalThinkingTime}s`, isThinking: false, thinkingTime: finalThinkingTime }]);
      setTerminalLogs(prev => [...prev, `Blueprint generated: ${plan.explanation}`]);
      setFileTree(buildFileTree(plan.files));

      // Cloud Memory: index generated files (best effort, capped)
      (async () => {
        try {
          const { getSupabase } = await import('../lib/supabase');
          const supabase = getSupabase();
          if (!supabase) return;

          const { data: sess } = await supabase.auth.getSession();
          const accessToken = sess.session?.access_token;
          const userId = sess.session?.user?.id;
          const localProject = localProjectManager.getCurrentProject();
          if (!accessToken || !userId || !localProject) return;

          const { ensureCloudProject, indexProjectFiles } = await import('../lib/cloud-memory');
          const cloudProjectId = await ensureCloudProject({
            supabase,
            localProjectId: localProject.id,
            userId,
            name: localProject.name,
            description: localProject.initialPrompt,
          });

          const { indexedFiles, indexedChunks } = await indexProjectFiles({
            supabase,
            projectId: cloudProjectId,
            accessToken,
            userId,
            files: plan.files.map((f) => ({ path: f.path, content: f.content })),
            limits: { maxFiles: 40, maxChunks: 80, chunkSize: 1200, overlap: 150 },
          });

          setTerminalLogs(prev => [...prev, `🧠 Memory indexed: ${indexedFiles} files / ${indexedChunks} chunks`]);
        } catch {
          // ignore
        }
      })();

      const steps: GenerationStep[] = [];
      if (plan.dependencies) plan.dependencies.forEach(dep => steps.push({ type: 'install', target: dep, status: 'done' }));
      plan.files.forEach(f => steps.push({ type: 'create', target: f.path, status: 'done' }));
      setGenerationSteps(steps);
      setChatMessages(prev => [...prev, { role: 'ai', text: plan.explanation, steps: steps }]);

      // Cloud Memory: store assistant summary (best effort)
      (async () => {
        try {
          const { getSupabase } = await import('../lib/supabase');
          const supabase = getSupabase();
          if (!supabase) return;

          const { data: sess } = await supabase.auth.getSession();
          const accessToken = sess.session?.access_token;
          const userId = sess.session?.user?.id;
          const localProject = localProjectManager.getCurrentProject();
          if (!accessToken || !userId || !localProject) return;

          const { ensureCloudProject, addProjectMessage, embedTextServer, upsertMemoryChunk } = await import('../lib/cloud-memory');
          const cloudProjectId = await ensureCloudProject({
            supabase,
            localProjectId: localProject.id,
            userId,
            name: localProject.name,
            description: localProject.initialPrompt,
          });

          const summary = plan.explanation;
          const messageId = await addProjectMessage({
            supabase,
            projectId: cloudProjectId,
            userId,
            role: 'assistant',
            content: summary,
          });

          const emb = await embedTextServer({ accessToken, text: summary });
          await upsertMemoryChunk({
            supabase,
            projectId: cloudProjectId,
            userId,
            sourceType: 'message',
            sourceId: messageId,
            chunkIndex: 0,
            content: summary,
            embedding: emb,
          });
        } catch {
          // ignore
        }
      })();

      const appFile = plan.files.find(f => f.name.includes('App'));
      if (appFile) { setActiveFile(appFile.name); setActiveFileContent(appFile.content); }

      setTerminalLogs(prev => [...prev, '\n🚀 Booting WebContainer...']);
      await WebContainerService.mountFiles(plan.files, plan.dependencies, (log) => setTerminalLogs(prev => [...prev, log]));
      setTerminalLogs(prev => [...prev, '\n📦 Installing dependencies...']);
      const exitCode = await WebContainerService.installDependencies((log) => setTerminalLogs(prev => [...prev, log]));
      if (exitCode !== 0) throw new Error(`npm install failed with exit code ${exitCode}`);

      setTerminalLogs(prev => [...prev, '\n⚡ Starting dev server...']);
      const url = await WebContainerService.startDevServer((log) => {
        setTerminalLogs(prev => [...prev, log]);
      });

      setIframeUrl(url);
      setServerStatus('running');
      setTerminalLogs(prev => [...prev, '\n✅ Application is live!']);
      setShowSuggestions(true);
      if (hasWebhooksConfigured()) sendNotification('build_success', { projectName: project.name, message: `Built ${plan.files.length} files`, url: url, files: plan.files.length, duration: finalThinkingTime }).catch(() => { });

    } catch (error) {
      console.error(error);
      setIsThinking(false);
      setServerStatus('error');
      const errorMessage = error instanceof Error ? error.message : String(error);
      setTerminalLogs(prev => [...prev, `\n❌ ${errorMessage}`]);

      // Only attempt auto-healing if AI is available
      if (hasAPIKeys) {
        setChatMessages(prev => [...prev, { role: 'ai', text: 'Build failed. Activating QA Agent for auto-repair...' }]);
        try {
          const healResult = await autonomousAgent.run(`Fix this build error: ${errorMessage}`);
          if (healResult.success) {
            setChatMessages(prev => [...prev, { role: 'ai', text: '✅ Auto-healing successful! Retrying build...' }]);
          } else {
            setChatMessages(prev => [...prev, { role: 'ai', text: '❌ Auto-healing failed. Please check logs.' }]);
          }
        } catch (healError) {
          setChatMessages(prev => [...prev, { role: 'ai', text: '❌ Critical failure in self-healing protocol.' }]);
        }
      } else {
        setChatMessages(prev => [...prev, { role: 'ai', text: `❌ Build failed: ${errorMessage}. Add a Gemini API key in ⚙️ Settings for AI-powered auto-repair.` }]);
      }

      if (hasWebhooksConfigured()) sendNotification('build_failure', { projectName: project.name, message: errorMessage }).catch(() => { });
    }
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    const newMsg: ChatMessage = { role: 'user', text: chatInput };
    setChatMessages(prev => [...prev, newMsg]);

    // Cloud Memory: store user message + embedding (best effort)
    (async () => {
      try {
        const { getSupabase } = await import('../lib/supabase');
        const supabase = getSupabase();
        if (!supabase) return;

        const { data: sess } = await supabase.auth.getSession();
        const accessToken = sess.session?.access_token;
        const userId = sess.session?.user?.id;
        const localProject = localProjectManager.getCurrentProject();
        if (!accessToken || !userId || !localProject) return;

        const { ensureCloudProject, addProjectMessage, embedTextServer, upsertMemoryChunk } = await import('../lib/cloud-memory');

        const cloudProjectId = await ensureCloudProject({
          supabase,
          localProjectId: localProject.id,
          userId,
          name: localProject.name,
          description: localProject.initialPrompt,
        });

        const messageId = await addProjectMessage({
          supabase,
          projectId: cloudProjectId,
          userId,
          role: 'user',
          content: chatInput,
        });

        const emb = await embedTextServer({ accessToken, text: chatInput });
        await upsertMemoryChunk({
          supabase,
          projectId: cloudProjectId,
          userId,
          sourceType: 'message',
          sourceId: messageId,
          chunkIndex: 0,
          content: chatInput,
          embedding: emb,
        });
      } catch {
        // ignore
      }
    })();
    const prompt = chatInput;
    setChatInput('');

    if (brainMode) {
      setServerStatus('starting');
      setActiveTab('preview');
      autonomousAgent.run(prompt).then((result) => {
        if (result.success) {
          setServerStatus('running');
          setChatMessages(prev => [...prev, { role: 'ai', text: `✅ Agent completed! ${result.report.filesCreated.length} files created.` }]);
        } else {
          setServerStatus('stopped');
          setChatMessages(prev => [...prev, { role: 'ai', text: `❌ Agent finished with errors: ${result.report.summary}` }]);
        }
      });
    } else {
      setTimeout(() => handleGenerateApp(prompt), 500);
    }
  };

  const handleExportProject = async () => {
    const project = localProjectManager.getCurrentProject();
    if (!project) return alert('No project to export. Generate an app first!');
    try {
      await exportProjectAsZip(project);
      setTerminalLogs(prev => [...prev, `✅ Project exported as ZIP file`]);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Failed to export project.');
    }
  };

  const handleImportProject = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.zip';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const project = await importProjectFromZip(file);
        localProjectManager.loadProject(project);
        setFileTree(buildFileTree(project.files));
        setChatMessages([
          { role: 'ai', text: `Project "${project.name}" imported successfully!` },
          { role: 'ai', text: `Original prompt: ${project.initialPrompt}` }
        ]);
        setTerminalLogs([`> Project imported: ${project.name}`, `📦 Loaded ${project.files.length} files`]);
        if (project.files.length > 0) {
          setActiveFile(project.files[0]?.name || '');
          setActiveFileContent(project.files[0]?.content || '');
        }

        // Cloud Memory: index imported files (best effort)
        (async () => {
          try {
            const { getSupabase } = await import('../lib/supabase');
            const supabase = getSupabase();
            if (!supabase) return;

            const { data: sess } = await supabase.auth.getSession();
            const accessToken = sess.session?.access_token;
            const userId = sess.session?.user?.id;
            const localProject = localProjectManager.getCurrentProject();
            if (!accessToken || !userId || !localProject) return;

            const { ensureCloudProject, indexProjectFiles } = await import('../lib/cloud-memory');
            const cloudProjectId = await ensureCloudProject({
              supabase,
              localProjectId: localProject.id,
              userId,
              name: localProject.name,
              description: localProject.initialPrompt,
            });

            await indexProjectFiles({
              supabase,
              projectId: cloudProjectId,
              accessToken,
              userId,
              files: localProject.files.map((f) => ({ path: f.path, content: f.content })),
              limits: { maxFiles: 40, maxChunks: 80, chunkSize: 1200, overlap: 150 },
            });
          } catch {
            // ignore
          }
        })();
      } catch (error) {
        console.error('Import failed:', error);
        alert(`Failed to import: ${error}`);
      }
    };
    input.click();
  };

  const handleNewProject = () => {
    localProjectManager.clearProject();
    setFileTree([]);
    setActiveFile(null);
    setActiveFileContent('');
    setChatMessages([{ role: 'ai', text: 'Starting fresh! What shall we build?' }]);
  };

  const handleLoadProject = async (id: string, persistenceLoadProject: (id: string) => Promise<void>) => {
    await persistenceLoadProject(id);
    const project = localProjectManager.getCurrentProject();
    if (project) {
      setFileTree(buildFileTree(project.files));
      setChatMessages([{ role: 'ai', text: `Loaded "${project.name}".` }]);
      if (project.files.length) {
        setActiveFile(project.files[0].name);
        setActiveFileContent(project.files[0].content);
      }

      // Cloud Memory: best-effort index loaded project files (helps with long-term recall)
      (async () => {
        try {
          const { getSupabase } = await import('../lib/supabase');
          const supabase = getSupabase();
          if (!supabase) return;

          const { data: sess } = await supabase.auth.getSession();
          const accessToken = sess.session?.access_token;
          const userId = sess.session?.user?.id;
          const localProject = localProjectManager.getCurrentProject();
          if (!accessToken || !userId || !localProject) return;

          const { ensureCloudProject, indexProjectFiles, getProjectMessages } = await import('../lib/cloud-memory');
          const cloudProjectId = await ensureCloudProject({
            supabase,
            localProjectId: localProject.id,
            userId,
            name: localProject.name,
            description: localProject.initialPrompt,
          });

          // Restore chat history
          const history = await getProjectMessages({ supabase, projectId: cloudProjectId });
          if (history.length > 0) {
             const restoredMessages = history.map(m => ({
                 role: m.role === 'assistant' ? 'ai' : (m.role === 'user' ? 'user' : 'system'),
                 text: m.content
             })).filter(m => m.role === 'ai' || m.role === 'user') as ChatMessage[];
             
             if (restoredMessages.length > 0) {
                 setChatMessages(restoredMessages);
             }
          }

          await indexProjectFiles({
            supabase,
            projectId: cloudProjectId,
            accessToken,
            userId,
            files: localProject.files.map((f) => ({ path: f.path, content: f.content })),
            limits: { maxFiles: 40, maxChunks: 80, chunkSize: 1200, overlap: 150 },
          });
        } catch {
          // ignore
        }
      })();
    }
  };

  const handleFileSelect = (filename: string, content: string) => {
    setActiveFile(filename);
    setActiveFileContent(content);
  };

  return {
    state: {
      activeTab, setActiveTab,
      chatInput, setChatInput,
      fileTree, setFileTree,
      activeFile, setActiveFile,
      activeFileContent, setActiveFileContent,
      serverStatus, setServerStatus,
      terminalLogs, setTerminalLogs,
      iframeUrl, setIframeUrl,
      selectedModel, setSelectedModel,
      chatMessages, setChatMessages,
      isThinking, setIsThinking,
      thinkingElapsed,
      generationSteps, setGenerationSteps,
      showSteps, setShowSteps,
      showSuggestions, setShowSuggestions,
      viewMode, setViewMode,
      showVercelModal, setShowVercelModal,
      showAPIKeySettings, setShowAPIKeySettings,
      hasAPIKeys, setHasAPIKeys,
      brainMode, setBrainMode,
    },
    hooks: {
      autonomousAgent,
      voice,
    },
    handlers: {
      handleGenerateApp,
      handleSendMessage,
      handleFileSelect,
      handleExportProject,
      handleImportProject,
      handleNewProject,
      handleLoadProject,
    },
  };
};
