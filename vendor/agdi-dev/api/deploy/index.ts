import type { VercelRequest, VercelResponse } from '@vercel/node';

interface DeployFile {
    file: string;
    data: string;
}

interface DeployRequest {
    projectName: string;
    files: DeployFile[];
    description?: string;
}

/**
 * POST /api/deploy
 * Deploys files to Vercel and returns deployment URL
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Get session from cookie
    const sessionCookie = req.cookies?.vercel_session;
    if (!sessionCookie) {
        return res.status(401).json({ error: 'Not authenticated. Please sign in with Vercel.' });
    }

    let session;
    try {
        session = JSON.parse(Buffer.from(sessionCookie, 'base64').toString('utf-8'));
    } catch {
        return res.status(401).json({ error: 'Invalid session' });
    }

    const { vercelAccessToken, vercelTeamId } = session;
    if (!vercelAccessToken) {
        return res.status(401).json({ error: 'No Vercel access token. Please reconnect your account.' });
    }

    // Parse request body
    const { projectName, files, description } = req.body as DeployRequest;

    if (!projectName || !files || !Array.isArray(files)) {
        return res.status(400).json({ error: 'Missing projectName or files' });
    }

    // Sanitize project name (Vercel requirements)
    const sanitizedName = projectName
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 50);

    const teamQuery = vercelTeamId ? `?teamId=${vercelTeamId}` : '';

    try {
        // Step 1: Create or get project
        let projectId: string;

        const checkProjectRes = await fetch(
            `https://api.vercel.com/v9/projects/${sanitizedName}${teamQuery}`,
            {
                headers: { Authorization: `Bearer ${vercelAccessToken}` },
            }
        );

        if (checkProjectRes.ok) {
            const existingProject = await checkProjectRes.json();
            projectId = existingProject.id;
        } else {
            // Create new project
            const createProjectRes = await fetch(
                `https://api.vercel.com/v10/projects${teamQuery}`,
                {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${vercelAccessToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        name: sanitizedName,
                        framework: 'vite',
                    }),
                }
            );

            if (!createProjectRes.ok) {
                const error = await createProjectRes.json();
                console.error('Failed to create project:', error);
                return res.status(500).json({ error: `Failed to create project: ${error.error?.message || 'Unknown error'}` });
            }

            const newProject = await createProjectRes.json();
            projectId = newProject.id;
        }

        // Step 2: Prepare files for deployment
        const deploymentFiles = files.map((f) => ({
            file: f.file.startsWith('/') ? f.file.slice(1) : f.file,
            data: f.data,
        }));

        // Step 3: Create deployment
        const deployRes = await fetch(
            `https://api.vercel.com/v13/deployments${teamQuery}`,
            {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${vercelAccessToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name: sanitizedName,
                    project: projectId,
                    target: 'production',
                    files: deploymentFiles,
                    projectSettings: {
                        framework: 'vite',
                        buildCommand: 'npm run build',
                        outputDirectory: 'dist',
                        installCommand: 'npm install',
                    },
                }),
            }
        );

        if (!deployRes.ok) {
            const error = await deployRes.json();
            console.error('Deployment failed:', error);
            return res.status(500).json({ error: `Deployment failed: ${error.error?.message || 'Unknown error'}` });
        }

        const deployment = await deployRes.json();
        const deploymentId = deployment.id;
        const deploymentUrl = `https://${deployment.url}`;

        // Step 4: Return immediately. Frontend will poll /api/deploy/status
        // We can't reliably build a team/project dashboard URL without the team slug, so use a safe generic.
        const claimUrl = `https://vercel.com/dashboard`;

        return res.status(200).json({
            success: true,
            status: 'building',
            deploymentId,
            deploymentUrl,
            projectId,
            projectName: sanitizedName,
            claimUrl,
            message: 'Deployment started. We will update status automatically.',
        });

    } catch (err) {
        console.error('Deploy error:', err);
        return res.status(500).json({ error: 'Internal server error during deployment' });
    }
}
