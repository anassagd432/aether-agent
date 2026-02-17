/**
 * Embeddings API — Vercel Serverless Function
 *
 * Generates a 384-dim embedding for a given text.
 * Used by Web IDE Memory (pgvector) for RAG.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

function sanitizeText(input: unknown): string {
  if (typeof input !== 'string') return '';
  return input
    .replace(/<[^>]*>/g, '')
    .replace(/\0/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      return res.status(503).json({ error: 'Supabase service not configured on server' });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) {
      return res.status(401).json({ error: 'Invalid or expired auth token' });
    }

    const text = sanitizeText(req.body?.text);
    if (!text) {
      return res.status(400).json({ error: 'Missing text' });
    }

    if (!GEMINI_API_KEY) {
      return res.status(503).json({ error: 'GEMINI_API_KEY not configured on server' });
    }

    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

    // NOTE: Google embedding models typically return 768 dims.
    // We project down to 384 dims deterministically to match our pgvector schema.
    // Later we can migrate to 768 dims for higher quality.
    const embed = await ai.models.embedContent({
      model: 'text-embedding-004',
      contents: text,
    });

    const values = (embed as any)?.embedding?.values as number[] | undefined;
    if (!values?.length) {
      return res.status(500).json({ error: 'Failed to generate embedding' });
    }

    // Down-project to 384 dims (simple folding). Deterministic + fast.
    const dim = 384;
    const out = new Array(dim).fill(0);
    for (let i = 0; i < values.length; i++) out[i % dim] += values[i];

    // Normalize
    const norm = Math.sqrt(out.reduce((s, v) => s + v * v, 0)) || 1;
    const normalized = out.map((v) => v / norm);

    return res.status(200).json({ embedding: normalized, dim });
  } catch (err) {
    console.error('[embed] error', err);
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Internal error' });
  }
}
