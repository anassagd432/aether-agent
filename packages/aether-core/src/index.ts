export type ProgressEvent =
  | { type: 'started'; title: string; detail?: string }
  | { type: 'question'; id: string; text: string; choices?: string[] }
  | { type: 'progress'; message: string }
  | { type: 'result'; ok: boolean; summary: string; data?: Record<string, unknown> }
  | { type: 'blocked'; reason: string; needFromUser: string }
  | { type: 'error'; message: string };

export type ProgressSink = (evt: ProgressEvent) => void | Promise<void>;

export type KeyValueStore = {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
};

export class MemoryStore implements KeyValueStore {
  private map = new Map<string, string>();
  async get(key: string) {
    return this.map.get(key) ?? null;
  }
  async set(key: string, value: string) {
    this.map.set(key, value);
  }
}
