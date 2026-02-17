/**
 * Webhook Notifications
 * 
 * Send build/deploy notifications to Discord and Slack.
 * Integrates with the Builder component to provide real-time alerts.
 */

// ==================== TYPES ====================

export interface WebhookConfig {
    discordUrl?: string;
    slackUrl?: string;
}

export interface NotificationDetails {
    projectName: string;
    message: string;
    url?: string;
    files?: number;
    duration?: number;
}

export type NotificationEvent = 'build_start' | 'build_success' | 'build_failure' | 'deploy_success' | 'deploy_failure';

// ==================== STORAGE ====================

const STORAGE_KEYS = {
    discord: 'agdi_webhook_discord',
    slack: 'agdi_webhook_slack',
} as const;

/**
 * Get saved webhook URLs from localStorage
 */
export function getWebhookConfig(): WebhookConfig {
    try {
        return {
            discordUrl: localStorage.getItem(STORAGE_KEYS.discord) || undefined,
            slackUrl: localStorage.getItem(STORAGE_KEYS.slack) || undefined,
        };
    } catch {
        return {};
    }
}

/**
 * Save webhook URLs to localStorage
 */
export function saveWebhookConfig(config: WebhookConfig): void {
    try {
        if (config.discordUrl) {
            localStorage.setItem(STORAGE_KEYS.discord, config.discordUrl);
        } else {
            localStorage.removeItem(STORAGE_KEYS.discord);
        }
        if (config.slackUrl) {
            localStorage.setItem(STORAGE_KEYS.slack, config.slackUrl);
        } else {
            localStorage.removeItem(STORAGE_KEYS.slack);
        }
    } catch (error) {
        console.error('[Webhook] Failed to save config:', error);
    }
}

// ==================== DISCORD ====================

const DISCORD_COLORS = {
    build_start: 0x3498db,    // Blue
    build_success: 0x2ecc71,  // Green
    build_failure: 0xe74c3c,  // Red
    deploy_success: 0x9b59b6, // Purple
    deploy_failure: 0xe74c3c, // Red
} as const;

const EVENT_EMOJIS = {
    build_start: '🚀',
    build_success: '✅',
    build_failure: '❌',
    deploy_success: '🌐',
    deploy_failure: '💥',
} as const;

async function sendDiscordNotification(
    webhookUrl: string,
    event: NotificationEvent,
    details: NotificationDetails
): Promise<void> {
    const embed = {
        title: `${EVENT_EMOJIS[event]} Agdi ${event.replace('_', ' ').toUpperCase()}`,
        description: details.message,
        color: DISCORD_COLORS[event],
        fields: [
            {
                name: 'Project',
                value: details.projectName,
                inline: true,
            },
            ...(details.files ? [{
                name: 'Files',
                value: details.files.toString(),
                inline: true,
            }] : []),
            ...(details.duration ? [{
                name: 'Duration',
                value: `${details.duration}s`,
                inline: true,
            }] : []),
        ],
        footer: {
            text: 'Agdi AI Builder',
        },
        timestamp: new Date().toISOString(),
    };

    // Add URL button if available
    const components = details.url ? [{
        type: 1, // Action Row
        components: [{
            type: 2, // Button
            style: 5, // Link
            label: 'View Live',
            url: details.url,
        }],
    }] : undefined;

    await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            embeds: [embed],
            components,
        }),
    });
}

// ==================== SLACK ====================

async function sendSlackNotification(
    webhookUrl: string,
    event: NotificationEvent,
    details: NotificationDetails
): Promise<void> {
    const isSuccess = event.includes('success');
    const color = isSuccess ? 'good' : (event.includes('failure') ? 'danger' : '#3498db');

    const payload = {
        attachments: [{
            color,
            title: `${EVENT_EMOJIS[event]} ${event.replace('_', ' ').toUpperCase()}`,
            text: details.message,
            fields: [
                {
                    title: 'Project',
                    value: details.projectName,
                    short: true,
                },
                ...(details.files ? [{
                    title: 'Files',
                    value: details.files.toString(),
                    short: true,
                }] : []),
                ...(details.duration ? [{
                    title: 'Duration',
                    value: `${details.duration}s`,
                    short: true,
                }] : []),
            ],
            footer: 'Agdi AI Builder',
            ts: Math.floor(Date.now() / 1000),
            actions: details.url ? [{
                type: 'button',
                text: 'View Live',
                url: details.url,
            }] : undefined,
        }],
    };

    await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
}

// ==================== MAIN FUNCTION ====================

/**
 * Send notification to all configured webhooks
 */
export async function sendNotification(
    event: NotificationEvent,
    details: NotificationDetails
): Promise<void> {
    const config = getWebhookConfig();
    const promises: Promise<void>[] = [];

    if (config.discordUrl) {
        promises.push(
            sendDiscordNotification(config.discordUrl, event, details)
                .catch(err => console.error('[Webhook] Discord failed:', err))
        );
    }

    if (config.slackUrl) {
        promises.push(
            sendSlackNotification(config.slackUrl, event, details)
                .catch(err => console.error('[Webhook] Slack failed:', err))
        );
    }

    if (promises.length > 0) {
        await Promise.all(promises);
        console.log(`[Webhook] Sent ${event} notification to ${promises.length} channel(s)`);
    }
}

/**
 * Check if any webhooks are configured
 */
export function hasWebhooksConfigured(): boolean {
    const config = getWebhookConfig();
    return !!(config.discordUrl || config.slackUrl);
}

export default sendNotification;
