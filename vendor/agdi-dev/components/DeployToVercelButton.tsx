import React, { useState } from 'react';
import { Loader2, ExternalLink, CheckCircle, XCircle, Sparkles } from 'lucide-react';

const SparklesIcon = () => <Sparkles className="w-4 h-4" />;

interface DeployFile {
    file: string;
    data: string;
}

interface DeployToVercelButtonProps {
    projectName: string;
    files: DeployFile[];
    description?: string;
    isAuthenticated: boolean; // Supabase auth (not Vercel)
    onSignInClick?: () => void;
}

interface DeploymentResult {
    success: boolean;
    status: string;
    deploymentUrl?: string;
    claimUrl?: string;
    projectName?: string;
    error?: string;
    message?: string;
}

/**
 * Button component that deploys files to Vercel
 */
export const DeployToVercelButton: React.FC<DeployToVercelButtonProps> = ({
    projectName,
    files,
    description,
    isAuthenticated,
    onSignInClick,
}) => {
    const [isDeploying, setIsDeploying] = useState(false);
    const [result, setResult] = useState<DeploymentResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleDeploy = async () => {
        // 1) Ensure user is signed in to Agdi (optional gating)
        if (!isAuthenticated) {
            onSignInClick?.();
            return;
        }

        // 2) Ensure Vercel is connected (OAuth)
        const statusRes = await fetch('/api/auth/vercel/status');
        const status = await statusRes.json();
        if (!status?.connected) {
            // Redirect to Vercel OAuth connect flow (server sets cookie)
            window.location.href = '/api/auth/vercel/connect';
            return;
        }

        setIsDeploying(true);
        setError(null);
        setResult(null);

        try {
            const response = await fetch('/api/deploy', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    projectName,
                    files,
                    description,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Deployment failed');
            }

            setResult(data);

            // If building, poll status endpoint until READY/ERROR
            if (data?.status === 'building' && data?.deploymentId) {
                const deploymentId = data.deploymentId as string;

                const poll = async () => {
                    const sRes = await fetch(`/api/deploy/status?deploymentId=${encodeURIComponent(deploymentId)}`);
                    const sData = await sRes.json();

                    if (!sRes.ok) {
                        throw new Error(sData?.error || 'Failed to fetch deployment status');
                    }

                    if (sData?.readyState === 'READY') {
                        setResult((prev) => ({
                            ...(prev || {}),
                            success: true,
                            status: 'ready',
                            deploymentUrl: sData.url,
                            message: 'Deployment successful!',
                        }));
                        return;
                    }

                    if (sData?.readyState === 'ERROR') {
                        throw new Error('Deployment failed during build');
                    }

                    // continue polling
                    setTimeout(poll, 2500);
                };

                setTimeout(poll, 2500);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Deployment failed');
        } finally {
            setIsDeploying(false);
        }
    };

    // Not authenticated to Agdi state
    if (!isAuthenticated) {
        return (
            <div className="space-y-3">
                <p className="text-sm text-slate-400">
                    Log in to Agdi to deploy your app.
                </p>
                <button
                    onClick={onSignInClick}
                    className="w-full py-2.5 bg-white text-black font-medium rounded-lg hover:bg-slate-100 transition-colors flex items-center justify-center gap-2"
                >
                    <SparklesIcon />
                    Log in
                </button>
            </div>
        );
    }

    // Success state
    if (result?.success) {
        return (
            <div className="space-y-4">
                <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-green-400 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                        <div className="font-medium text-green-400">
                            {result.status === 'ready' ? 'Deployment Successful!' : 'Deployment Started'}
                        </div>
                        <p className="text-xs text-slate-400">{result.message}</p>
                    </div>
                </div>

                {result.deploymentUrl && (
                    <a
                        href={result.deploymentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block w-full py-2.5 bg-cyan-500 text-slate-950 font-bold rounded-lg hover:bg-cyan-400 transition-colors text-center"
                    >
                        <span className="flex items-center justify-center gap-2">
                            <ExternalLink className="w-4 h-4" />
                            Open Live Site
                        </span>
                    </a>
                )}

                {result.claimUrl && (
                    <a
                        href={result.claimUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block w-full py-2 bg-slate-700 text-white font-medium rounded-lg hover:bg-slate-600 transition-colors text-center text-sm"
                    >
                        <span className="flex items-center justify-center gap-2">
                            <svg viewBox="0 0 76 65" className="w-4 h-4" fill="currentColor">
                                <path d="M37.5274 0L75.0548 65H0L37.5274 0Z" />
                            </svg>
                            View on Vercel Dashboard
                        </span>
                    </a>
                )}

                <button
                    onClick={() => setResult(null)}
                    className="w-full py-2 text-slate-500 hover:text-white text-xs transition-colors"
                >
                    Deploy Again
                </button>
            </div>
        );
    }

    // Error state
    if (error) {
        return (
            <div className="space-y-4">
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 flex items-start gap-3">
                    <XCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                        <div className="font-medium text-red-400">Deployment Failed</div>
                        <p className="text-xs text-slate-400">{error}</p>
                    </div>
                </div>

                <button
                    onClick={() => setError(null)}
                    className="w-full py-2.5 bg-slate-700 text-white font-medium rounded-lg hover:bg-slate-600 transition-colors"
                >
                    Try Again
                </button>
            </div>
        );
    }

    // Default state - ready to deploy
    return (
        <button
            onClick={handleDeploy}
            disabled={isDeploying || files.length === 0}
            className="w-full py-3 bg-gradient-to-r from-cyan-400 to-cyan-500 text-slate-950 font-bold rounded-lg hover:from-cyan-300 hover:to-cyan-400 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
            {isDeploying ? (
                <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Deploying to Vercel...
                </>
            ) : (
                <>
                    <svg viewBox="0 0 76 65" className="w-4 h-4" fill="currentColor">
                        <path d="M37.5274 0L75.0548 65H0L37.5274 0Z" />
                    </svg>
                    Deploy to Vercel
                </>
            )}
        </button>
    );
};

export default DeployToVercelButton;
