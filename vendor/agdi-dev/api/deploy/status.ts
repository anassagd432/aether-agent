import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Auth
  const sessionCookie = req.cookies?.vercel_session;
  if (!sessionCookie) {
    return res.status(401).json({ error: 'Not authenticated. Please sign in with Vercel.' });
  }

  let session: { vercelAccessToken?: string; vercelTeamId?: string | null };
  try {
    session = JSON.parse(Buffer.from(sessionCookie, 'base64').toString('utf-8')) as {
      vercelAccessToken?: string;
      vercelTeamId?: string | null;
    };
  } catch {
    return res.status(401).json({ error: 'Invalid session' });
  }

  const { vercelAccessToken, vercelTeamId } = session;
  if (!vercelAccessToken) {
    return res.status(401).json({ error: 'No Vercel access token. Please reconnect your account.' });
  }

  const deploymentId = String(req.query.deploymentId || '').trim();
  if (!deploymentId) {
    return res.status(400).json({ error: 'Missing deploymentId' });
  }

  const teamQuery = vercelTeamId ? `?teamId=${vercelTeamId}` : '';

  const statusRes = await fetch(
    `https://api.vercel.com/v13/deployments/${deploymentId}${teamQuery}`,
    {
      headers: { Authorization: `Bearer ${vercelAccessToken}` },
    }
  );

  const data = await statusRes.json();

  if (!statusRes.ok) {
    return res.status(500).json({ error: data?.error?.message || 'Failed to fetch deployment status' });
  }

  const deploymentUrl = data?.url ? `https://${data.url}` : undefined;

  return res.status(200).json({
    deploymentId,
    readyState: data?.readyState,
    url: deploymentUrl,
    error: data?.error || null,
  });
}
