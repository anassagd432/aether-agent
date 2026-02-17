/**
 * Cloud Memory (Web IDE) — Supabase + pgvector
 *
 * Stores:
 *  - projects
 *  - project_messages
 *  - memory_chunks (with embedding)
 *
 * Uses /api/embed to generate embeddings securely on server.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export type MemoryRole = 'system' | 'user' | 'assistant' | 'tool';

type ProjectRow = {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
};

type MessageRow = {
  id: string;
  project_id: string;
  user_id: string;
  role: MemoryRole;
  content: string;
  created_at: string;
};

const CLOUD_MAP_KEY = 'agdi_cloud_project_map_v1';

type CloudProjectMap = Record<string, string>; // localProjectId -> supabase project uuid

function loadMap(): CloudProjectMap {
  try {
    return JSON.parse(localStorage.getItem(CLOUD_MAP_KEY) || '{}') as CloudProjectMap;
  } catch {
    return {};
  }
}

function saveMap(map: CloudProjectMap) {
  localStorage.setItem(CLOUD_MAP_KEY, JSON.stringify(map));
}

export async function ensureCloudProject(opts: {
  supabase: SupabaseClient;
  localProjectId: string;
  userId: string;
  name: string;
  description?: string;
}): Promise<string> {
  const map = loadMap();
  const existing = map[opts.localProjectId];
  if (existing) return existing;

  // Create a new project row
  const { data, error } = await opts.supabase
    .from('projects')
    .insert({
      user_id: opts.userId,
      name: opts.name,
      description: opts.description || null,
    })
    .select('id')
    .single();

  if (error) throw new Error(error.message);

  map[opts.localProjectId] = data.id;
  saveMap(map);

  return data.id as string;
}

export async function addProjectMessage(opts: {
  supabase: SupabaseClient;
  projectId: string;
  userId: string;
  role: MemoryRole;
  content: string;
}): Promise<string> {
  const { data, error } = await opts.supabase
    .from('project_messages')
    .insert({
      project_id: opts.projectId,
      user_id: opts.userId,
      role: opts.role,
      content: opts.content,
    })
    .select('id')
    .single();

  if (error) throw new Error(error.message);
  return data.id as string;
}

export async function getProjectMessages(opts: {
  supabase: SupabaseClient;
  projectId: string;
}): Promise<MessageRow[]> {
  const { data, error } = await opts.supabase
    .from('project_messages')
    .select('*')
    .eq('project_id', opts.projectId)
    .order('created_at', { ascending: true });

  if (error) throw new Error(error.message);
  return data as MessageRow[];
}

export async function upsertMemoryChunk(opts: {
  supabase: SupabaseClient;
  projectId: string;
  userId: string;
  sourceType: 'message' | 'file' | 'summary' | 'note';
  sourceId?: string;
  path?: string;
  chunkIndex?: number;
  content: string;
  embedding: number[];
}): Promise<void> {
  const { error } = await opts.supabase
    .from('memory_chunks')
    .insert({
      project_id: opts.projectId,
      user_id: opts.userId,
      source_type: opts.sourceType,
      source_id: opts.sourceId || null,
      path: opts.path || null,
      chunk_index: opts.chunkIndex ?? 0,
      content: opts.content,
      embedding: opts.embedding,
    });

  if (error) throw new Error(error.message);
}

export async function embedTextServer(opts: {
  accessToken: string;
  text: string;
}): Promise<number[]> {
  const res = await fetch('/api/embed', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${opts.accessToken}`,
    },
    body: JSON.stringify({ text: opts.text }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || 'Embedding failed');
  return data.embedding as number[];
}

function chunkText(text: string, chunkSize = 1200, overlap = 150): string[] {
  const t = text.trim();
  if (!t) return [];
  if (t.length <= chunkSize) return [t];

  const chunks: string[] = [];
  let i = 0;
  while (i < t.length) {
    const end = Math.min(i + chunkSize, t.length);
    const slice = t.slice(i, end).trim();
    if (slice) chunks.push(slice);
    if (end >= t.length) break;
    i = Math.max(0, end - overlap);
  }
  return chunks;
}

export async function indexProjectFiles(opts: {
  supabase: SupabaseClient;
  projectId: string;
  accessToken: string;
  userId: string;
  files: Array<{ path: string; content: string }>;
  limits?: {
    maxFiles?: number;
    maxChunks?: number;
    chunkSize?: number;
    overlap?: number;
  };
}): Promise<{ indexedFiles: number; indexedChunks: number }> {
  const maxFiles = opts.limits?.maxFiles ?? 40;
  const maxChunks = opts.limits?.maxChunks ?? 80;
  const chunkSize = opts.limits?.chunkSize ?? 1200;
  const overlap = opts.limits?.overlap ?? 150;

  let indexedFiles = 0;
  let indexedChunks = 0;

  // Prefer smaller + "source" files first
  const sorted = [...opts.files]
    .filter((f) => f?.path && typeof f.content === 'string')
    .filter((f) => !f.path.includes('node_modules'))
    .sort((a, b) => a.content.length - b.content.length)
    .slice(0, maxFiles);

  for (const f of sorted) {
    if (indexedChunks >= maxChunks) break;

    const chunks = chunkText(f.content, chunkSize, overlap);
    if (!chunks.length) continue;

    indexedFiles++;

    for (let ci = 0; ci < chunks.length; ci++) {
      if (indexedChunks >= maxChunks) break;

      const c = chunks[ci];
      // Embed + store
      const emb = await embedTextServer({ accessToken: opts.accessToken, text: c });
      await upsertMemoryChunk({
        supabase: opts.supabase,
        projectId: opts.projectId,
        userId: opts.userId,
        sourceType: 'file',
        path: f.path,
        chunkIndex: ci,
        content: c,
        embedding: emb,
      });

      indexedChunks++;
    }
  }

  return { indexedFiles, indexedChunks };
}

export async function retrieveMemoryContext(opts: {
  supabase: SupabaseClient;
  projectId: string;
  accessToken: string;
  query: string;
  topK?: number;
}): Promise<string> {
  const embedding = await embedTextServer({ accessToken: opts.accessToken, text: opts.query });

  const { data, error } = await opts.supabase.rpc('match_memory_chunks', {
    p_project_id: opts.projectId,
    p_query_embedding: embedding,
    p_match_count: opts.topK ?? 8,
    p_min_similarity: 0.7,
  });

  if (error) throw new Error(error.message);

  const rows = (data || []) as Array<{ content: string; path: string | null; source_type: string; similarity: number }>;
  if (!rows.length) return '';

  const lines: string[] = ['# Project Memory (RAG)', ''];
  for (const r of rows) {
    const where = r.path ? `(${r.source_type}: ${r.path})` : `(${r.source_type})`;
    lines.push(`- ${where} sim=${r.similarity.toFixed(2)}: ${r.content.slice(0, 400)}`);
  }

  return lines.join('\n');
}
