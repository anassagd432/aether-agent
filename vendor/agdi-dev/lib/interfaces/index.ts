/**
 * Interfaces Module Exports
 * 
 * External integrations for Agdi.
 */

// WhatsApp Interface - Voice command integration
export {
    // Types
    type WhatsAppConfig,
    type VoiceSource,
    type VoiceCommandResult,
    type TranscriptionResult,
    type WhatsAppMessage,
    type MessageHandler,
    type ConnectionHandler,

    // Classes
    VoicePermissionGate,
    WhatsAppSession,

    // Factory
    createWhatsAppInterface,

    // Constants
    DEFAULT_WHATSAPP_CONFIG,
} from './whatsapp-interface';
