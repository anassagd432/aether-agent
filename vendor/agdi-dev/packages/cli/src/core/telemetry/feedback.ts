/**
 * RLHF Feedback Collection
 * 
 * Collects user feedback on task completion for model improvement.
 * Always optional - user can skip with Enter.
 */

import * as readline from 'readline';
import chalk from 'chalk';
import type { FeedbackResponse } from './types.js';
import { isTelemetryEnabled } from './config.js';

/**
 * Request feedback after task completion
 * Returns null if user skips or telemetry is disabled
 */
export async function requestFeedback(): Promise<FeedbackResponse | null> {
    if (!isTelemetryEnabled()) {
        return null;
    }

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    return new Promise((resolve) => {
        console.log();
        rl.question(
            chalk.dim('Did Agdi complete this task successfully? [Y/n/skip] '),
            (answer) => {
                const normalized = answer.trim().toLowerCase();

                // Skip feedback
                if (normalized === 'skip' || normalized === 's' || normalized === '') {
                    rl.close();
                    resolve(null);
                    return;
                }

                // Success
                if (normalized === 'y' || normalized === 'yes') {
                    rl.close();
                    resolve({ success: true });
                    return;
                }

                // Failure - ask for optional reason
                rl.question(
                    chalk.dim('What went wrong? (optional, press Enter to skip) '),
                    (reason) => {
                        rl.close();
                        resolve({
                            success: false,
                            reason: reason.trim() || undefined,
                        });
                    }
                );
            }
        );

        // Auto-skip after 30 seconds
        const timeout = setTimeout(() => {
            rl.close();
            resolve(null);
        }, 30000);

        rl.on('close', () => clearTimeout(timeout));
    });
}

/**
 * Quick thumbs up/down feedback (non-blocking)
 */
export function showFeedbackHint(): void {
    if (!isTelemetryEnabled()) return;

    console.log(
        chalk.dim('\n💡 Tip: Run ') +
        chalk.cyan('agdi feedback') +
        chalk.dim(' to help improve Agdi')
    );
}
