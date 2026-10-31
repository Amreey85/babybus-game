/**
 * Merges keyboard and multi-touch input into one InputState.
 * Touch buttons track each pointer id separately so a child can hold
 * "right" and tap "jump" at the same time.
 */
import type { InputState } from '../core/types';

type Action = keyof InputState;

const KEYMAP: Record<string, Action> = {
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
  ArrowUp: 'jump',
  KeyW: 'jump',
  Space: 'jump',
  KeyE: 'interact',
  Enter: 'interact',
};

export class InputManager {
  private keys = new Set<Action>();
  private pointers = new Map<number, Action>();
  private onPause: (() => void) | null = null;
  private listeners: Array<() => void> = [];
  /** Virtual input used by automated tests and the intro. */
  readonly virtual: InputState = { left: false, right: false, jump: false, interact: false };
  /** True once the player has used touch. */
  usingTouch = false;
  enabled = true;

  constructor() {
    const down = (e: KeyboardEvent) => {
      if (e.code === 'Escape' || e.code === 'KeyP') {
        if (!e.repeat) this.onPause?.();
        return;
      }
      const a = KEYMAP[e.code];
      if (!a) return;
      if (this.enabled) e.preventDefault();
      this.keys.add(a);
      if (this.usingTouch) {
        this.usingTouch = false;
        document.body.classList.remove('touch-mode');
      }
    };
    const up = (e: KeyboardEvent) => {
      const a = KEYMAP[e.code];
      if (a) this.keys.delete(a);
    };
    const blur = () => this.reset();
    const touch = () => {
      if (!this.usingTouch) {
        this.usingTouch = true;
        document.body.classList.add('touch-mode');
      }
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    window.addEventListener('touchstart', touch, { passive: true });
    this.listeners.push(
      () => window.removeEventListener('keydown', down),
      () => window.removeEventListener('keyup', up),
      () => window.removeEventListener('blur', blur),
      () => window.removeEventListener('touchstart', touch),
    );
    if (window.matchMedia?.('(pointer: coarse)').matches) touch();
  }

  setPauseHandler(fn: (() => void) | null): void {
    this.onPause = fn;
  }

  /** Wire touch buttons. Each element needs data-action="left|right|jump|interact". */
  bindTouchButtons(root: HTMLElement): void {
    const release = (e: PointerEvent) => {
      const a = this.pointers.get(e.pointerId);
      if (!a) return;
      this.pointers.delete(e.pointerId);
      this.refreshPressed(root);
    };
    root.querySelectorAll<HTMLElement>('[data-action]').forEach((el) => {
      const action = el.dataset.action as Action;
      el.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        el.setPointerCapture?.(e.pointerId);
        this.pointers.set(e.pointerId, action);
        this.refreshPressed(root);
      });
      // Sliding a thumb from one arrow to the other switches direction.
      el.addEventListener('pointerenter', (e) => {
        if (e.pointerType !== 'mouse' && this.pointers.has(e.pointerId)) {
          this.pointers.set(e.pointerId, action);
          this.refreshPressed(root);
        }
      });
      el.addEventListener('pointerup', release);
      el.addEventListener('pointercancel', release);
      el.addEventListener('lostpointercapture', release);
      el.addEventListener('contextmenu', (e) => e.preventDefault());
    });
  }

  private refreshPressed(root: HTMLElement): void {
    const active = new Set(this.pointers.values());
    root.querySelectorAll<HTMLElement>('[data-action]').forEach((el) => {
      el.classList.toggle('pressed', active.has(el.dataset.action as Action));
    });
  }

  get state(): InputState {
    const touch = new Set(this.pointers.values());
    const v = this.virtual;
    const get = (a: Action) => this.enabled && (this.keys.has(a) || touch.has(a) || v[a]);
    return { left: get('left'), right: get('right'), jump: get('jump'), interact: get('interact') };
  }

  reset(): void {
    this.keys.clear();
    this.pointers.clear();
    this.virtual.left = this.virtual.right = this.virtual.jump = this.virtual.interact = false;
    document.querySelectorAll('[data-action].pressed').forEach((el) => el.classList.remove('pressed'));
  }

  dispose(): void {
    this.listeners.forEach((l) => l());
  }
}
