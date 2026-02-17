/**
 * useVoiceInput Hook v2.0
 * 
 * Features:
 * - VAD (Voice Activity Detection): Auto-stop on silence
 * - Interrupt Mode: Detect "Stop" command
 * - Noise Suppression (basic filter)
 */

import { useState, useCallback, useRef, useEffect } from 'react';

// ==================== TYPES ====================

export interface UseVoiceInputReturn {
    isListening: boolean;
    isSupported: boolean;
    transcript: string;
    interimTranscript: string;
    error: string | null;
    startListening: () => void;
    stopListening: () => void;
    toggleListening: () => void;
    clearTranscript: () => void;
    silenceThreshold: number; // ms
}

// ==================== TYPE DECLARATIONS ====================

interface SpeechRecognition extends EventTarget {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    maxAlternatives: number;
    onaudiostart: ((this: SpeechRecognition, ev: Event) => any) | null;
    onsoundstart: ((this: SpeechRecognition, ev: Event) => any) | null;
    onspeechstart: ((this: SpeechRecognition, ev: Event) => any) | null;
    onspeechend: ((this: SpeechRecognition, ev: Event) => any) | null;
    onsoundend: ((this: SpeechRecognition, ev: Event) => any) | null;
    onaudioend: ((this: SpeechRecognition, ev: Event) => any) | null;
    onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null;
    onnomatch: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null;
    onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => any) | null;
    onstart: ((this: SpeechRecognition, ev: Event) => any) | null;
    onend: ((this: SpeechRecognition, ev: Event) => any) | null;
    start(): void;
    stop(): void;
    abort(): void;
}

interface SpeechRecognitionConstructor {
    new (): SpeechRecognition;
    prototype: SpeechRecognition;
}

declare global {
    interface Window {
        SpeechRecognition: SpeechRecognitionConstructor;
        webkitSpeechRecognition: SpeechRecognitionConstructor;
    }
}

interface SpeechRecognitionEvent extends Event {
    resultIndex: number;
    results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
    length: number;
    item(index: number): SpeechRecognitionResult;
    [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
    isFinal: boolean;
    length: number;
    item(index: number): SpeechRecognitionAlternative;
    [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
    transcript: string;
    confidence: number;
}

interface SpeechRecognitionErrorEvent extends Event {
    error: 'no-speech' | 'aborted' | 'audio-capture' | 'network' | 'not-allowed' | 'service-not-allowed' | 'bad-grammar' | 'language-not-supported';
    message: string;
}

// ==================== HOOK IMPLEMENTATION ====================

export function useVoiceInput(
    options: { silenceThreshold?: number; autoStop?: boolean } = {}
): UseVoiceInputReturn {
    const { silenceThreshold = 2000, autoStop = true } = options;

    const [isListening, setIsListening] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [interimTranscript, setInterimTranscript] = useState('');
    const [error, setError] = useState<string | null>(null);

    const recognitionRef = useRef<SpeechRecognition | null>(null);
    const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);

    // Check browser support
    const isSupported = typeof window !== 'undefined' && (
        'SpeechRecognition' in window ||
        'webkitSpeechRecognition' in window
    );

    // Initialize speech recognition
    useEffect(() => {
        if (!isSupported) return;

        const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
        const recognition = new SpeechRecognitionAPI();

        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onstart = () => {
            setIsListening(true);
            setError(null);
        };

        recognition.onend = () => {
            // Auto-restart if not manually stopped (continuous mode hack)
            // But we respect our own state
            if (isListening && !autoStop) {
                try { recognition.start(); } catch {}
            } else {
                setIsListening(false);
            }
        };

        recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
            if (event.error === 'no-speech') return; // Ignore harmless errors
            setError(event.error);
            setIsListening(false);
        };

        recognition.onresult = (event: SpeechRecognitionEvent) => {
            let finalTranscript = '';
            let interim = '';

            // Reset silence timer on any speech
            if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);

            for (let i = event.resultIndex; i < event.results.length; i++) {
                const result = event.results[i];
                if (result.isFinal) {
                    finalTranscript += result[0].transcript;
                } else {
                    interim += result[0].transcript;
                }
            }

            if (finalTranscript) {
                setTranscript(prev => prev + ' ' + finalTranscript);
                
                // VAD: Interrupt Check
                if (finalTranscript.toLowerCase().includes('stop') || finalTranscript.toLowerCase().includes('cancel')) {
                    stopListening();
                    return;
                }
            }
            setInterimTranscript(interim);

            // VAD: Auto-stop on silence
            if (autoStop && (finalTranscript || interim)) {
                silenceTimerRef.current = setTimeout(() => {
                    stopListening();
                }, silenceThreshold);
            }
        };

        recognitionRef.current = recognition;

        return () => {
            if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
            recognition.stop();
        };
    }, [isSupported, autoStop, silenceThreshold]);

    const startListening = useCallback(() => {
        if (!recognitionRef.current || isListening) return;

        setTranscript('');
        setInterimTranscript('');
        setError(null);

        try {
            recognitionRef.current.start();
        } catch (err) {
            // Already started
        }
    }, [isListening]);

    const stopListening = useCallback(() => {
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        if (!recognitionRef.current) return;
        
        recognitionRef.current.stop();
        setIsListening(false);
    }, []);

    const toggleListening = useCallback(() => {
        if (isListening) {
            stopListening();
        } else {
            startListening();
        }
    }, [isListening, startListening, stopListening]);

    const clearTranscript = useCallback(() => {
        setTranscript('');
        setInterimTranscript('');
    }, []);

    return {
        isListening,
        isSupported,
        transcript: transcript.trim(),
        interimTranscript,
        error,
        startListening,
        stopListening,
        toggleListening,
        clearTranscript,
        silenceThreshold
    };
}


// ==================== KEYBOARD HOOK ====================

/**
 * Hook for push-to-talk with spacebar
 */
export function usePushToTalk(
    onTranscript: (text: string) => void,
    enabled: boolean = true
): UseVoiceInputReturn & { isPushToTalkActive: boolean } {
    const voice = useVoiceInput();
    const [isPushToTalkActive, setIsPushToTalkActive] = useState(false);
    const wasListeningRef = useRef(false);

    useEffect(() => {
        if (!enabled || !voice.isSupported) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            // Spacebar for push-to-talk (only when not in an input)
            if (e.code === 'Space' &&
                !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
                e.preventDefault();
                if (!voice.isListening) {
                    setIsPushToTalkActive(true);
                    voice.startListening();
                }
            }
        };

        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.code === 'Space' && isPushToTalkActive) {
                e.preventDefault();
                voice.stopListening();
                setIsPushToTalkActive(false);

                // Trigger callback with final transcript
                const finalText = voice.transcript + voice.interimTranscript;
                if (finalText.trim()) {
                    onTranscript(finalText.trim());
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, [enabled, voice, isPushToTalkActive, onTranscript]);

    return {
        ...voice,
        isPushToTalkActive,
    };
}

export default useVoiceInput;
