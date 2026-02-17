/**
 * Ambient type declarations for @xenova/transformers
 * No official types exist for this package; this provides minimal coverage.
 */
declare module '@xenova/transformers' {
    export function pipeline(
        task: string,
        model: string,
        options?: Record<string, unknown>
    ): Promise<(input: string, options?: Record<string, unknown>) => Promise<{ data: Float32Array }>>;
}
