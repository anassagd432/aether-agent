/**
 * Vercel Serverless Function - Mailchimp Newsletter Subscription
 * 
 * Environment Variables Required (add in Vercel Dashboard):
 * - MAILCHIMP_API_KEY: Your Mailchimp API key (e.g., abc123def456-us21)
 * - MAILCHIMP_AUDIENCE_ID: Your Mailchimp Audience/List ID
 * - MAILCHIMP_DC: Your Mailchimp data center (e.g., us21)
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

interface MailchimpError {
    title: string;
    detail: string;
    status: number;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // Only allow POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { email } = req.body;

    // Validate email
    if (!email || typeof email !== 'string') {
        return res.status(400).json({ error: 'Email is required' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return res.status(400).json({ error: 'Invalid email format' });
    }

    // Get Mailchimp credentials from environment
    const API_KEY = process.env.MAILCHIMP_API_KEY;
    const AUDIENCE_ID = process.env.MAILCHIMP_AUDIENCE_ID;
    const DC = process.env.MAILCHIMP_DC;

    if (!API_KEY || !AUDIENCE_ID || !DC) {
        console.error('Missing Mailchimp environment variables');
        return res.status(500).json({ error: 'Newsletter service not configured' });
    }

    try {
        const response = await fetch(
            `https://${DC}.api.mailchimp.com/3.0/lists/${AUDIENCE_ID}/members`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Basic ${Buffer.from(`anystring:${API_KEY}`).toString('base64')}`,
                },
                body: JSON.stringify({
                    email_address: email,
                    status: 'subscribed', // Use 'pending' for double opt-in
                    tags: ['Agdi Launch', 'Website Signup'],
                }),
            }
        );

        const data = await response.json();

        if (!response.ok) {
            const error = data as MailchimpError;

            // Handle "already subscribed" case gracefully
            if (error.title === 'Member Exists') {
                return res.status(200).json({
                    success: true,
                    message: "You're already on our list! We'll notify you when we launch."
                });
            }

            console.error('Mailchimp error:', error);
            return res.status(response.status).json({
                error: error.detail || 'Failed to subscribe'
            });
        }

        return res.status(200).json({
            success: true,
            message: "You're on the list! We'll notify you when Agdi launches."
        });

    } catch (error) {
        console.error('Newsletter subscription error:', error);
        return res.status(500).json({ error: 'Failed to subscribe. Please try again.' });
    }
}
