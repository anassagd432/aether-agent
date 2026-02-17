import { z } from 'zod';
import type { KeyValueStore, ProgressSink } from '@aether/core';

export const BuildRequestSchema = z.object({
  description: z.string().min(3),
  projectSlug: z.string().min(2).optional(),
});
export type BuildRequest = z.infer<typeof BuildRequestSchema>;

export type QAPair = { id: string; question: string; answer: string };

export type DevflowAnswers = {
  appType: 'webapp' | 'landing';
  targetUsers: string;
  coreProblem: string;
  mustHavePages: string[];
  style: 'clean' | 'bold' | 'luxury' | 'playful';
};

const DEFAULT_QUESTIONS = [
  {
    id: 'appType',
    text: 'What are we building? (webapp or landing)',
    choices: ['webapp', 'landing'],
  },
  {
    id: 'targetUsers',
    text: 'Who are the target users? (one sentence)',
  },
  {
    id: 'coreProblem',
    text: 'What problem does it solve? (one sentence)',
  },
  {
    id: 'mustHavePages',
    text: 'Must-have pages/features? (comma separated)',
  },
  {
    id: 'style',
    text: 'Preferred style? (clean, bold, luxury, playful)',
    choices: ['clean', 'bold', 'luxury', 'playful'],
  },
] as const;

export class DevflowMVP {
  constructor(private store: KeyValueStore, private sink: ProgressSink) {}

  async startBuild(req: BuildRequest) {
    const parsed = BuildRequestSchema.parse(req);

    await this.sink({
      type: 'started',
      title: 'Devflow started',
      detail: `I will ask a few questions, then generate a Next.js app and prepare it for Vercel deploy.\n\nIdea: ${parsed.description}`,
    });

    // If answers already exist for this session key, skip questions.
    const key = `devflow:answers:default`;
    const existing = await this.store.get(key);
    if (!existing) {
      for (const q of DEFAULT_QUESTIONS) {
        await this.sink({ type: 'question', id: q.id, text: q.text, choices: 'choices' in q ? [...q.choices] : undefined });
      }
      await this.sink({
        type: 'blocked',
        reason: 'Missing required inputs',
        needFromUser:
          'Reply with answers in this format:\n' +
          'appType=webapp\n' +
          'targetUsers=...\n' +
          'coreProblem=...\n' +
          'mustHavePages=Home,Pricing,Contact\n' +
          'style=clean',
      });
      return;
    }

    await this.sink({ type: 'progress', message: 'Answers found. Next: scaffold app (Next.js + Tailwind) and run tests.' });

    // Implementation placeholder: real scaffolding + coding loop comes next PR.
    await this.sink({
      type: 'result',
      ok: true,
      summary:
        'MVP devflow skeleton is wired. Next step is implementing scaffold + coder/fixer loop + deploy integration.',
      data: { description: parsed.description },
    });
  }

  async saveAnswers(raw: string) {
    const lines = raw
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    const kv: Record<string, string> = {};
    for (const line of lines) {
      const idx = line.indexOf('=');
      if (idx === -1) continue;
      kv[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
    }

    const parsed: DevflowAnswers = {
      appType: (kv.appType as DevflowAnswers['appType']) ?? 'webapp',
      targetUsers: kv.targetUsers ?? '',
      coreProblem: kv.coreProblem ?? '',
      mustHavePages: (kv.mustHavePages ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      style: (kv.style as DevflowAnswers['style']) ?? 'clean',
    };

    if (!parsed.targetUsers || !parsed.coreProblem) {
      throw new Error('targetUsers and coreProblem are required');
    }

    await this.store.set('devflow:answers:default', JSON.stringify(parsed));
    await this.sink({ type: 'progress', message: 'Saved answers. Now re-run /build to continue.' });
  }
}
