import React, { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Folder,
  Clock,
  ArrowRight,
  LogOut,
  Sparkles,
  Layers,
  Search,
  Trash2,
  ArrowUpDown,
  Rocket,
  X,
} from 'lucide-react';
import { useProjectPersistence } from '../hooks/useProjectPersistence';
import type { ProjectMeta } from '../lib/persistence/types';

// ==================== TYPES ====================

interface DashboardProps {
  onCreateNew: () => void;
  onOpenBuilder: () => void;
  onOpenProject: (projectId: string) => Promise<void> | void;
  onSignOut?: () => void;
  userEmail?: string | null;
}

type SortMode = 'recent' | 'oldest' | 'az';

// ==================== HELPERS ====================

function formatRelativeTime(ts: number) {
  const diffMs = Date.now() - ts;
  const sec = Math.max(1, Math.round(diffMs / 1000));
  if (sec < 60) return `${sec}s ago`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.round(hr / 24);
  return `${days}d ago`;
}

/** Strip markdown bold/italic/etc from project names */
function sanitizeName(raw: string): string {
  return raw
    .replace(/\*\*([^*]+)\*\*/g, '$1')  // **bold** → bold
    .replace(/\*([^*]+)\*/g, '$1')       // *italic* → italic
    .replace(/__([^_]+)__/g, '$1')       // __bold__ → bold
    .replace(/_([^_]+)_/g, '$1')         // _italic_ → italic
    .replace(/~~([^~]+)~~/g, '$1')       // ~~strike~~ → strike
    .replace(/`([^`]+)`/g, '$1')         // `code` → code
    .trim();
}

function sortProjects(projects: ProjectMeta[], mode: SortMode): ProjectMeta[] {
  const sorted = [...projects];
  switch (mode) {
    case 'recent':
      return sorted.sort((a, b) => b.savedAt - a.savedAt);
    case 'oldest':
      return sorted.sort((a, b) => a.savedAt - b.savedAt);
    case 'az':
      return sorted.sort((a, b) => sanitizeName(a.name).localeCompare(sanitizeName(b.name)));
    default:
      return sorted;
  }
}

const SORT_LABELS: Record<SortMode, string> = {
  recent: 'Recent',
  oldest: 'Oldest',
  az: 'A → Z',
};

// ==================== ANIMATION VARIANTS ====================

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.07, delayChildren: 0.1 },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.97 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: 'spring', damping: 22, stiffness: 260 },
  },
} as const;

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45 } },
};

// ==================== SUB COMPONENTS ====================

/** Shimmer loading skeleton card */
const SkeletonCard: React.FC = () => (
  <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1 space-y-3">
        <div className="h-4 w-32 rounded-md bg-white/[0.06] animate-pulse" />
        <div className="h-3 w-48 rounded-md bg-white/[0.04] animate-pulse" style={{ animationDelay: '150ms' }} />
        <div className="h-3 w-20 rounded-md bg-white/[0.03] animate-pulse" style={{ animationDelay: '300ms' }} />
      </div>
      <div className="w-10 h-10 rounded-xl bg-white/[0.04] animate-pulse" />
    </div>
  </div>
);

/** Delete confirmation modal */
const DeleteConfirmDialog: React.FC<{
  projectName: string;
  onConfirm: () => void;
  onCancel: () => void;
}> = ({ projectName, onConfirm, onCancel }) => {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onCancel]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onCancel}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 12 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 12 }}
        transition={{ type: 'spring', damping: 24, stiffness: 300 }}
        className="relative w-full max-w-sm mx-4 p-6 rounded-2xl border border-white/10 bg-slate-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 text-slate-500 hover:text-white transition cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-red-500/15 border border-red-500/20 flex items-center justify-center">
            <Trash2 className="w-5 h-5 text-red-400" />
          </div>
          <div className="text-base font-semibold text-white">Delete project</div>
        </div>

        <p className="text-sm text-slate-400 mb-6">
          Are you sure you want to delete <span className="text-white font-medium">"{sanitizeName(projectName)}"</span>? This action cannot be undone.
        </p>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] text-slate-200 text-sm font-medium transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-2.5 rounded-xl bg-red-500/80 hover:bg-red-500 text-white text-sm font-semibold transition cursor-pointer shadow-[0_0_16px_rgba(239,68,68,0.2)] hover:shadow-[0_0_24px_rgba(239,68,68,0.35)]"
          >
            Delete
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

/** Sort dropdown */
const SortDropdown: React.FC<{
  value: SortMode;
  onChange: (mode: SortMode) => void;
}> = ({ value, onChange }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-3 rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] text-slate-200 text-sm transition cursor-pointer"
      >
        <ArrowUpDown className="w-4 h-4 text-slate-500" />
        {SORT_LABELS[value]}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-2 w-36 rounded-xl border border-white/10 bg-slate-900 shadow-xl z-20 overflow-hidden"
          >
            {(['recent', 'oldest', 'az'] as SortMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => {
                  onChange(mode);
                  setOpen(false);
                }}
                className={`w-full text-left px-4 py-2.5 text-sm transition cursor-pointer ${value === mode
                  ? 'bg-cyan-500/10 text-cyan-300'
                  : 'text-slate-300 hover:bg-white/[0.05]'
                  }`}
              >
                {SORT_LABELS[mode]}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

/** Onboarding empty state (0 projects, no search) */
const OnboardingCard: React.FC<{ onCreateNew: () => void }> = ({ onCreateNew }) => (
  <motion.div
    initial={{ opacity: 0, y: 24, scale: 0.98 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    transition={{ duration: 0.6, type: 'spring', damping: 20 }}
    className="md:col-span-2 lg:col-span-3 rounded-2xl border border-dashed border-cyan-500/20 bg-gradient-to-br from-cyan-500/[0.04] to-cyan-500/[0.04] p-10 flex flex-col items-center text-center"
  >
    <motion.div
      animate={{ y: [0, -6, 0] }}
      transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-cyan-400/10 border border-white/10 flex items-center justify-center mb-5"
    >
      <Rocket className="w-8 h-8 text-cyan-300" />
    </motion.div>
    <h3 className="text-lg font-bold text-white mb-2">No projects yet</h3>
    <p className="text-sm text-slate-400 mb-6 max-w-md">
      Create your first project to start building. The AI-powered wizard will guide you through setup in under a minute.
    </p>
    <button
      onClick={onCreateNew}
      className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-cyan-400 text-white font-semibold text-sm shadow-[0_0_24px_rgba(34,211,238,0.25)] hover:shadow-[0_0_34px_rgba(34,211,238,0.35)] transition cursor-pointer"
    >
      <Plus className="w-4 h-4" />
      Create your first project
    </button>
  </motion.div>
);

/** Individual project card */
const ProjectCard: React.FC<{
  project: ProjectMeta;
  onOpen: () => void;
  onDelete: () => void;
}> = ({ project, onOpen, onDelete }) => {
  return (
    <motion.div variants={cardVariants} whileHover={{ y: -3, transition: { duration: 0.2 } }}>
      <div className="relative text-left rounded-2xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.05] hover:border-cyan-500/15 transition-all duration-300 p-5 group">
        {/* Delete button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="absolute top-3 right-3 w-8 h-8 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-all cursor-pointer z-10"
          title="Delete project"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>

        <button onClick={onOpen} className="w-full text-left cursor-pointer">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 pr-6">
              <div className="flex items-center gap-2">
                <Folder className="w-4 h-4 text-slate-500 group-hover:text-cyan-400 transition-colors flex-shrink-0" />
                <div className="text-sm font-semibold text-slate-200 truncate">
                  {sanitizeName(project.name)}
                </div>
              </div>
              {project.description && (
                <div className="mt-1.5 text-[12px] text-slate-500 line-clamp-2 leading-relaxed">
                  {sanitizeName(project.description)}
                </div>
              )}
              <div className="mt-2 text-[12px] text-slate-500 flex items-center gap-2">
                <span>{project.fileCount ?? 0} files</span>
                <span className="text-slate-700">•</span>
                <span>{formatRelativeTime(project.savedAt)}</span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-white/[0.03] border border-white/10 flex items-center justify-center flex-shrink-0 group-hover:border-cyan-500/20 transition-colors">
              <ArrowRight className="w-5 h-5 text-slate-500 group-hover:text-white transition-colors" />
            </div>
          </div>
        </button>
      </div>
    </motion.div>
  );
};

// ==================== MAIN COMPONENT ====================

const Dashboard: React.FC<DashboardProps> = ({
  onCreateNew,
  onOpenBuilder,
  onOpenProject,
  onSignOut,
  userEmail,
}) => {
  const persistence = useProjectPersistence();
  const [query, setQuery] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('recent');
  const [deleteTarget, setDeleteTarget] = useState<ProjectMeta | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcut: Ctrl/Cmd+K focuses search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const projects = useMemo(() => {
    const q = query.trim().toLowerCase();
    let filtered = persistence.savedProjects;
    if (q) {
      filtered = filtered.filter((p) => sanitizeName(p.name).toLowerCase().includes(q));
    }
    return sortProjects(filtered, sortMode);
  }, [persistence.savedProjects, query, sortMode]);

  const stats = useMemo(() => {
    const count = persistence.savedProjects.length;
    const last = persistence.savedProjects
      .map((p) => p.savedAt)
      .filter(Boolean)
      .sort((a, b) => b - a)[0];
    return { count, last };
  }, [persistence.savedProjects]);

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;
    await persistence.deleteProject(deleteTarget.id);
    setDeleteTarget(null);
  }, [deleteTarget, persistence]);

  const isInitialLoad = persistence.isLoading && persistence.savedProjects.length === 0;
  const isEmptyState = !isInitialLoad && persistence.savedProjects.length === 0 && !query;
  const isSearchEmpty = !isInitialLoad && projects.length === 0 && !!query;

  return (
    <div className="min-h-screen bg-[#07080f] text-white relative overflow-hidden">
      {/* Background glow — Cyan + Gold */}
      <div className="absolute inset-0 pointer-events-none">
        <motion.div
          animate={{ scale: [1, 1.08, 1], opacity: [0.08, 0.12, 0.08] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute -top-32 -left-24 w-[520px] h-[520px] rounded-full bg-cyan-500/10 blur-3xl"
        />
        <motion.div
          animate={{ scale: [1, 1.1, 1], opacity: [0.07, 0.11, 0.07] }}
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
          className="absolute top-40 -right-28 w-[560px] h-[560px] rounded-full bg-cyan-500/10 blur-3xl"
        />
        <motion.div
          animate={{ x: [-20, 20, -20] }}
          transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute bottom-0 left-1/3 w-[480px] h-[480px] rounded-full bg-cyan-500/5 blur-3xl"
        />
      </div>

      {/* Top bar */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative z-10 px-6 py-6 lg:px-12 border-b border-white/5 bg-slate-950/40 backdrop-blur-md"
      >
        <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-cyan-400/10 border border-white/10 flex items-center justify-center overflow-hidden">
                <img src="/agdi-logo.png" alt="Agdi.dev" className="w-8 h-8 object-contain" />
              </div>
              <div>
                <div className="text-lg font-bold tracking-tight font-tech">
                  Agdi<span className="text-cyan-400">.dev</span>
                </div>
                <div className="text-[11px] text-slate-500">
                  {userEmail ? `Signed in as ${userEmail}` : 'Welcome back'}
                </div>
              </div>
            </div>

          <div className="flex items-center gap-2">
            {onSignOut && (
              <button
                onClick={onSignOut}
                className="flex items-center gap-2 px-3 py-2 rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] text-slate-200 text-sm transition cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Sign out</span>
              </button>
            )}
            <button
              onClick={onCreateNew}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-cyan-400 text-white font-semibold text-sm shadow-[0_0_24px_rgba(34,211,238,0.25)] hover:shadow-[0_0_34px_rgba(34,211,238,0.35)] transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              New project
            </button>
          </div>
        </div>
      </motion.div>

      <main className="relative z-10 px-6 py-10 lg:px-12 max-w-6xl mx-auto">
        {/* Header */}
        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 mb-8"
        >
          <div>
            <h1 className="text-3xl lg:text-4xl font-bold font-tech">
              Your workspace
            </h1>
            <p className="text-slate-400 text-sm mt-2 max-w-xl">
              Pick up where you left off. Open a past project, or create a new one and start building.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 w-full lg:w-auto">
            <motion.div
              whileHover={{ scale: 1.03 }}
              transition={{ type: 'spring', stiffness: 400 }}
              className="rounded-2xl border border-white/10 bg-white/[0.02] p-4"
            >
              <div className="text-[11px] text-slate-500">Projects</div>
              <div className="mt-1 text-xl font-semibold flex items-center gap-2">
                <Layers className="w-4 h-4 text-cyan-300" />
                {stats.count}
              </div>
            </motion.div>
            <motion.div
              whileHover={{ scale: 1.03 }}
              transition={{ type: 'spring', stiffness: 400 }}
              className="rounded-2xl border border-white/10 bg-white/[0.02] p-4"
            >
              <div className="text-[11px] text-slate-500">Last saved</div>
              <div className="mt-1 text-sm font-semibold flex items-center gap-2 text-slate-200">
                <Clock className="w-4 h-4 text-cyan-400" />
                {stats.last ? formatRelativeTime(stats.last) : '—'}
              </div>
            </motion.div>
          </div>
        </motion.div>

        {/* Search + sort + quick actions */}
        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          className="flex flex-col md:flex-row md:items-center gap-3 mb-6"
        >
          <div className="flex-1 relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search projects…"
              className="w-full bg-white/[0.03] border border-white/[0.06] rounded-xl pl-11 pr-16 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/15 transition-all"
            />
            <kbd className="absolute right-3.5 top-1/2 -translate-y-1/2 hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md border border-white/10 bg-white/[0.04] text-[10px] text-slate-500 font-mono">
              ⌘K
            </kbd>
          </div>

          <SortDropdown value={sortMode} onChange={setSortMode} />

          <button
            onClick={onOpenBuilder}
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] text-slate-200 text-sm transition cursor-pointer"
            title="Open builder"
          >
            Open builder
            <ArrowRight className="w-4 h-4" />
          </button>
        </motion.div>

        {/* Projects grid */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          {/* New project card (always visible unless initial load) */}
          {!isInitialLoad && (
            <motion.div variants={cardVariants} whileHover={{ y: -3, transition: { duration: 0.2 } }}>
              <button
                onClick={onCreateNew}
                className="w-full text-left rounded-2xl border border-white/10 bg-gradient-to-br from-cyan-500/10 to-cyan-400/05 hover:from-cyan-500/15 hover:to-cyan-500/15 transition-all duration-300 p-5 cursor-pointer h-full"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm text-slate-200 font-semibold">Create a new project</div>
                    <div className="text-[12px] text-slate-400 mt-1">
                      Start with the wizard and go straight to building.
                    </div>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-white/[0.06] border border-white/10 flex items-center justify-center flex-shrink-0">
                    <Plus className="w-5 h-5 text-cyan-300" />
                  </div>
                </div>
              </button>
            </motion.div>
          )}

          {/* Loading skeletons */}
          {isInitialLoad && (
            <>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </>
          )}

          {/* Onboarding empty state */}
          {isEmptyState && <OnboardingCard onCreateNew={onCreateNew} />}

          {/* Search no results */}
          {isSearchEmpty && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="md:col-span-2 lg:col-span-2 rounded-2xl border border-white/10 bg-white/[0.02] p-6"
            >
              <div className="text-sm font-semibold text-slate-200">No projects found</div>
              <div className="text-sm text-slate-500 mt-1">
                {persistence.isPersistenceAvailable
                  ? 'Try a different search, or create a new project.'
                  : 'Project storage is not available in this browser.'}
              </div>
            </motion.div>
          )}

          {/* Project cards */}
          {!isInitialLoad &&
            projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onOpen={async () => {
                  await onOpenProject(project.id);
                }}
                onDelete={() => setDeleteTarget(project)}
              />
            ))}
        </motion.div>
      </main>

      {/* Delete confirmation dialog */}
      <AnimatePresence>
        {deleteTarget && (
          <DeleteConfirmDialog
            projectName={deleteTarget.name}
            onConfirm={handleDelete}
            onCancel={() => setDeleteTarget(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default Dashboard;
