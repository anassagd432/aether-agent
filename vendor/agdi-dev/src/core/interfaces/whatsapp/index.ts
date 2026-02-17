/**
 * Agdi WhatsApp Interface Module
 * 
 * Unified exports for WhatsApp integration.
 */

// Client
export {
    WhatsAppClient,
    getWhatsAppClient,
    resetWhatsAppClient,
    isAuthorizedNumber,
    isMentioned,
    type WhatsAppMessage,
    type WhatsAppClientConfig,
    type WhatsAppClientEvents,
} from './client';

// Transcriber
export {
    VoiceTranscriber,
    getVoiceTranscriber,
    resetVoiceTranscriber,
    createWhatsAppVoiceHandler,
    type TranscriptionResult,
    type TranscriberConfig,
} from './transcriber';
