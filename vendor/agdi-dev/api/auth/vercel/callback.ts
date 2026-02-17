import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'GET') {
        return res.status(405).send('Method not allowed');
    }

    const { code, state } = req.query;
    const storedState = req.cookies?.vercel_oauth_state;

    // Validate state to prevent CSRF
    if (!state || !storedState || state !== storedState) {
        return res.status(400).send('Invalid state parameter');
    }

    const clientId = process.env.VERCEL_CLIENT_ID;
    const clientSecret = process.env.VERCEL_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
        return res.status(500).json({ error: 'Missing Vercel OAuth configuration' });
    }

    const redirectUri = `https://${req.headers.host}/api/auth/vercel/callback`;

    try {
        const tokenRes = await fetch('https://api.vercel.com/v2/oauth/access_token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                client_id: clientId,
                client_secret: clientSecret,
                code: code as string,
                redirect_uri: redirectUri,
            }),
        });

        const data = await tokenRes.json();

        if (!tokenRes.ok) {
            console.error('Vercel OAuth Error:', data);
            return res.status(500).send(`Failed to authenticate with Vercel: ${data.error_description || 'Unknown error'}`);
        }

        const { access_token, team_id } = data;

        // Create a session object
        const session = {
            vercelAccessToken: access_token,
            vercelTeamId: team_id || null,
        };

        const sessionStr = Buffer.from(JSON.stringify(session)).toString('base64');

        // Set secure session cookie
        res.setHeader('Set-Cookie', [
            `vercel_session=${sessionStr}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000`, // 30 days
            `vercel_oauth_state=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0` // clear state cookie
        ]);

        // Redirect back to the app (SPA). Query param can be used to show a toast.
        res.redirect('/?vercel_connected=true');

    } catch (error) {
        console.error('Vercel Callback Error:', error);
        res.status(500).send('Internal Server Error during Vercel authentication');
    }
}
