/** Minimal typed event emitter. */
export class Emitter<Events extends Record<string, unknown>> {
  private handlers: { [K in keyof Events]?: Array<(payload: Events[K]) => void> } = {};

  on<K extends keyof Events>(event: K, handler: (payload: Events[K]) => void): () => void {
    (this.handlers[event] ??= []).push(handler);
    return () => this.off(event, handler);
  }

  off<K extends keyof Events>(event: K, handler: (payload: Events[K]) => void): void {
    const list = this.handlers[event];
    if (!list) return;
    const i = list.indexOf(handler);
    if (i >= 0) list.splice(i, 1);
  }

  emit<K extends keyof Events>(event: K, payload: Events[K]): void {
    const list = this.handlers[event];
    if (!list) return;
    for (const h of [...list]) h(payload);
  }

  clear(): void {
    this.handlers = {};
  }
}
