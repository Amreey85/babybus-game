/** Owns the Babylon engine, canvas sizing and quality decisions. */
import { Engine } from './babylon';
import type { QualityMode } from '../core/types';

export type QualityLevel = 'high' | 'low';

export function detectQuality(): QualityLevel {
  const nav = navigator as Navigator & { deviceMemory?: number };
  const cores = nav.hardwareConcurrency ?? 4;
  const mem = nav.deviceMemory ?? 4;
  const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  if (cores <= 4 && coarse) return 'low';
  if (mem <= 2) return 'low';
  return 'high';
}

export class EngineHost {
  readonly engine: Engine;
  quality: QualityLevel = 'high';
  private mode: QualityMode = 'auto';
  private fpsSamples: number[] = [];
  onQualityChange: ((q: QualityLevel) => void) | null = null;

  constructor(readonly canvas: HTMLCanvasElement) {
    this.engine = new Engine(canvas, true, {
      preserveDrawingBuffer: false,
      stencil: true,
      antialias: true,
      powerPreference: 'high-performance',
      doNotHandleContextLost: false,
    }, false);
    window.addEventListener('resize', () => this.engine.resize());
    window.addEventListener('orientationchange', () => setTimeout(() => this.engine.resize(), 200));
  }

  static isSupported(): boolean {
    try {
      const c = document.createElement('canvas');
      return !!(c.getContext('webgl2') || c.getContext('webgl'));
    } catch {
      return false;
    }
  }

  setMode(mode: QualityMode): void {
    this.mode = mode;
    this.apply(mode === 'auto' ? detectQuality() : mode);
  }

  private apply(q: QualityLevel): void {
    const changed = q !== this.quality;
    this.quality = q;
    const dpr = window.devicePixelRatio || 1;
    // Cap render resolution: crisp on laptops, lighter on phones.
    const target = q === 'high' ? Math.min(dpr, 2) : Math.min(dpr, 1.25);
    this.engine.setHardwareScalingLevel(1 / target);
    if (changed) this.onQualityChange?.(q);
  }

  /** Called every frame while playing; drops to low quality if auto and slow. */
  sampleFps(): void {
    if (this.mode !== 'auto' || this.quality === 'low') return;
    this.fpsSamples.push(this.engine.getFps());
    if (this.fpsSamples.length >= 180) {
      const avg = this.fpsSamples.reduce((a, b) => a + b, 0) / this.fpsSamples.length;
      this.fpsSamples = [];
      if (avg < 38) this.apply('low');
    }
  }
}
