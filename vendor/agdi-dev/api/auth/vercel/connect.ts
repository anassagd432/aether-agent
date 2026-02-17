import type { VercelRequest, VercelResponse } from '@vercel/node';
import { randomBytes } from 'crypto';

export default function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'GET') {
        return res.status(405).send('Method not allowed');
    }

    const clientId = process.env.VERCEL_CLIENT_ID;
    if (!clientId) {
        return res.status(500).json({ error: 'Missing VERCEL_CLIENT_ID configuration' });
    }

    const state = randomBytes(16).toString('hex');
    const redirectUri = `https://${req.headers.host}/api/auth/vercel/callback`;

    // Store state in a cookie to verify on callback
    res.setHeader('Set-Cookie', `vercel_oauth_state=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`);

    const params = new URLSearchParams({
        client_id: clientId,
        state: state,
        redirect_uri: redirectUri,
    });

    res.redirect(`https://vercel.com/oauth/authorize?${params.toString()}`);
}
