/**
 * Agdi Voice Transcriber
 * 
 * Transcribes audio messages using OpenAI Whisper API.
 * Handles <media:audio> detection and buffer processing.
 */

import { EventEmitter } from 'events';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Transcription result
 */
export interface TranscriptionResult {
    /** Transcribed text */
    text: string;
    /** Language detected */
    language?: string;
    /** Duration in seconds */
    duration?: number;
    /** Confidence score (0-1) */
    confidence?: number;
}

/**
 * Transcriber configuration
 */
export interface TranscriberConfig {
    /** OpenAI API key */
    openaiApiKey: string;
    /** Whisper model to use */
    model?: 'whisper-1';
    /** Target language (auto-detect if not set) */
    language?: string;
    /** Response format */
    responseFormat?: 'json' | 'text' | 'srt' | 'vtt' | 'verbose_json';
    /** Temperature for sampling */
    temperature?: number;
    /** Max audio file size in bytes (default 25MB) */
    maxFileSizeBytes?: number;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const OPENAI_WHISPER_URL = 'https://api.openai.com/v1/audio/transcriptions';
const DEFAULT_MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB
const SUPPORTED_FORMATS = ['mp3', 'mp4', 'mpeg', 'mpga', 'm4a', 'wav', 'webm', 'ogg'];

// =============================================================================
// TRANSCRIBER CLASS
// =============================================================================

export class VoiceTranscriber extends EventEmitter {
    private config: TranscriberConfig;

    constructor(config: TranscriberConfig) {
        super();

        if (!config.openaiApiKey) {
            throw new Error('OpenAI API key is required for voice transcription');
        }

        this.config = {
            ...config,
            model: config.model || 'whisper-1',
            responseFormat: config.responseFormat || 'verbose_json',
            maxFileSizeBytes: config.maxFileSizeBytes || DEFAULT_MAX_FILE_SIZE,
        };
    }

    /**
     * Transcribe an audio buffer using OpenAI Whisper
     */
    async transcribe(
        audioBuffer: Buffer,
        options?: {
            mimetype?: string;
            filename?: string;
            language?: string;
        }
    ): Promise<TranscriptionResult> {
        // Validate file size
        if (audioBuffer.length > (this.config.maxFileSizeBytes || DEFAULT_MAX_FILE_SIZE)) {
            throw new Error(`Audio file too large. Max size: ${this.config.maxFileSizeBytes} bytes`);
        }

        // Determine file extension from mimetype
        const mimetype = options?.mimetype || 'audio/ogg';
        const extension = this.getExtensionFromMimetype(mimetype);
        const filename = options?.filename || `audio.${extension}`;

        // Create FormData for multipart upload
        const formData = new FormData();

        // Create a Blob from the buffer
        const blob = new Blob([audioBuffer], { type: mimetype });
        formData.append('file', blob, filename);
        formData.append('model', this.config.model || 'whisper-1');
        formData.append('response_format', this.config.responseFormat || 'verbose_json');

        if (options?.language || this.config.language) {
            formData.append('language', options?.language || this.config.language!);
        }

        if (this.config.temperature !== undefined) {
            formData.append('temperature', String(this.config.temperature));
        }

        try {
            this.emit('transcription_start', { filename, size: audioBuffer.length });

            const response = await fetch(OPENAI_WHISPER_URL, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.config.openaiApiKey}`,
                },
                body: formData,
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Whisper API error: ${response.status} - ${errorText}`);
            }

            const data = await response.json();

            const result: TranscriptionResult = {
                text: data.text || '',
                language: data.language,
                duration: data.duration,
            };

            this.emit('transcription_complete', result);
            return result;

        } catch (error) {
            this.emit('transcription_error', error);
            throw error;
        }
    }

    /**
     * Transcribe from a file path
     */
    async transcribeFile(filePath: string): Promise<TranscriptionResult> {
        const fs = await import('fs');
        const path = await import('path');

        if (!fs.existsSync(filePath)) {
            throw new Error(`Audio file not found: ${filePath}`);
        }

        const buffer = fs.readFileSync(filePath);
        const extension = path.extname(filePath).slice(1).toLowerCase();
        const mimetype = this.getMimetypeFromExtension(extension);
        const filename = path.basename(filePath);

        return this.transcribe(buffer, { mimetype, filename });
    }

    /**
     * Detect if content contains audio/media tags
     */
    detectAudioTag(content: string): { hasAudio: boolean; format?: string } {
        // Check for <media:audio> tag pattern
        const audioTagMatch = content.match(/<media:audio[^>]*>/i);
        if (audioTagMatch) {
            const formatMatch = audioTagMatch[0].match(/format=["']?([^"'\s>]+)/i);
            return {
                hasAudio: true,
                format: formatMatch?.[1],
            };
        }

        // Check for [audio] markdown pattern
        if (content.includes('[audio]') || content.includes('[voice]')) {
            return { hasAudio: true };
        }

        return { hasAudio: false };
    }

    /**
     * Get file extension from mimetype
     */
    private getExtensionFromMimetype(mimetype: string): string {
        const mimeMap: Record<string, string> = {
            'audio/ogg': 'ogg',
            'audio/mpeg': 'mp3',
            'audio/mp4': 'm4a',
            'audio/wav': 'wav',
            'audio/webm': 'webm',
            'audio/x-m4a': 'm4a',
            'audio/mp3': 'mp3',
        };

        return mimeMap[mimetype.toLowerCase()] || 'ogg';
    }

    /**
     * Get mimetype from file extension
     */
    private getMimetypeFromExtension(extension: string): string {
        const extMap: Record<string, string> = {
            'ogg': 'audio/ogg',
            'mp3': 'audio/mpeg',
            'm4a': 'audio/mp4',
            'wav': 'audio/wav',
            'webm': 'audio/webm',
            'mp4': 'audio/mp4',
            'mpeg': 'audio/mpeg',
            'mpga': 'audio/mpeg',
        };

        return extMap[extension.toLowerCase()] || 'audio/ogg';
    }

    /**
     * Check if format is supported
     */
    isFormatSupported(format: string): boolean {
        return SUPPORTED_FORMATS.includes(format.toLowerCase());
    }
}

// =============================================================================
// INTEGRATION WITH WHATSAPP CLIENT
// =============================================================================

/**
 * Create a transcriber that listens to WhatsApp voice messages
 */
export function createWhatsAppVoiceHandler(
    transcriber: VoiceTranscriber,
    onTranscription: (text: string, originalMessage: any) => void
): (message: any, buffer: Buffer) => Promise<void> {
    return async (message: any, buffer: Buffer) => {
        try {
            const result = await transcriber.transcribe(buffer, {
                mimetype: message.media?.mimetype || 'audio/ogg',
            });

            if (result.text) {
                onTranscription(result.text, message);
            }
        } catch (error) {
            console.error('[VoiceTranscriber] Transcription failed:', error);
        }
    };
}

// =============================================================================
// SINGLETON
// =============================================================================

let transcriberInstance: VoiceTranscriber | null = null;

export function getVoiceTranscriber(config?: TranscriberConfig): VoiceTranscriber {
    if (!transcriberInstance && config) {
        transcriberInstance = new VoiceTranscriber(config);
    }
    if (!transcriberInstance) {
        throw new Error('Voice transcriber not initialized. Provide config first.');
    }
    return transcriberInstance;
}

export function resetVoiceTranscriber(): void {
    transcriberInstance = null;
}

// =============================================================================
// EXPORTS
// =============================================================================

export default {
    VoiceTranscriber,
    getVoiceTranscriber,
    resetVoiceTranscriber,
    createWhatsAppVoiceHandler,
};
