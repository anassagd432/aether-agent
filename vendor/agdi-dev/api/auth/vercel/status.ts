import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const sessionCookie = req.cookies?.vercel_session;
  if (!sessionCookie) {
    return res.status(200).json({ connected: false });
  }

  try {
    const session = JSON.parse(Buffer.from(sessionCookie, 'base64').toString('utf-8')) as {
      vercelAccessToken?: string;
      vercelTeamId?: string | null;
    };

    return res.status(200).json({
      connected: Boolean(session.vercelAccessToken),
      teamId: session.vercelTeamId ?? null,
    });
  } catch {
    return res.status(200).json({ connected: false });
  }
}
