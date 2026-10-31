/** Shared materials and procedural textures. Reused to keep draw state small. */
import { Color3, DynamicTexture, Scene, StandardMaterial, Texture } from './babylon';

export class MaterialLibrary {
  private cache = new Map<string, StandardMaterial>();

  constructor(private scene: Scene) {}

  /** Soft cartoon material: low specular, slight self-light so shadows stay friendly. */
  color(hex: string, opts: { emissive?: number; specular?: number; alpha?: number } = {}): StandardMaterial {
    const key = `${hex}|${opts.emissive ?? 0.22}|${opts.specular ?? 0.12}|${opts.alpha ?? 1}`;
    let m = this.cache.get(key);
    if (m) return m;
    m = new StandardMaterial(`m_${hex}`, this.scene);
    const c = Color3.FromHexString(hex);
    m.diffuseColor = c;
    m.emissiveColor = c.scale(opts.emissive ?? 0.22);
    m.specularColor = new Color3(1, 1, 1).scale(opts.specular ?? 0.12);
    m.specularPower = 32;
    if (opts.alpha !== undefined && opts.alpha < 1) m.alpha = opts.alpha;
    this.cache.set(key, m);
    return m;
  }

  textured(name: string, draw: (ctx: CanvasRenderingContext2D, size: number) => void, opts: { size?: number; uScale?: number; vScale?: number; emissive?: number } = {}): StandardMaterial {
    const key = `tex|${name}|${opts.uScale ?? 1}|${opts.vScale ?? 1}`;
    let m = this.cache.get(key);
    if (m) return m;
    // Each material owns its texture (cloned DynamicTextures never become ready).
    const size = opts.size ?? 256;
    const dt = new DynamicTexture(`t_${key}`, { width: size, height: size }, this.scene, true);
    draw(dt.getContext() as unknown as CanvasRenderingContext2D, size);
    dt.update(true);
    dt.wrapU = Texture.WRAP_ADDRESSMODE;
    dt.wrapV = Texture.WRAP_ADDRESSMODE;
    dt.anisotropicFilteringLevel = 4;
    dt.uScale = opts.uScale ?? 1;
    dt.vScale = opts.vScale ?? 1;
    m = new StandardMaterial(`mt_${name}`, this.scene);
    m.diffuseTexture = dt;
    m.emissiveColor = new Color3(1, 1, 1).scale(opts.emissive ?? 0.2);
    m.specularColor = new Color3(0.05, 0.05, 0.05);
    this.cache.set(key, m);
    return m;
  }

  /** Shared white material that shows baked vertex colours. */
  vertexColor(emissive = 0.22): StandardMaterial {
    const key = `vcol|${emissive}`;
    let m = this.cache.get(key);
    if (m) return m;
    m = new StandardMaterial(`vcol_${emissive}`, this.scene);
    m.diffuseColor = new Color3(1, 1, 1);
    m.emissiveColor = new Color3(emissive, emissive, emissive);
    m.specularColor = new Color3(0.12, 0.12, 0.12);
    m.specularPower = 32;
    this.cache.set(key, m);
    return m;
  }

  freezeAll(): void {
    this.cache.forEach((m) => m.freeze());
  }
}

// ---------- Procedural texture painters ----------

export function paintGrassTop(ctx: CanvasRenderingContext2D, s: number): void {
  ctx.fillStyle = '#6BD35A';
  ctx.fillRect(0, 0, s, s);
  for (let i = 0; i < 260; i++) {
    const x = Math.random() * s;
    const y = Math.random() * s;
    ctx.fillStyle = Math.random() > 0.5 ? '#7FE06A' : '#5BC24C';
    ctx.beginPath();
    ctx.ellipse(x, y, 3 + Math.random() * 5, 2 + Math.random() * 3, Math.random() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  for (let i = 0; i < 22; i++) {
    ctx.fillStyle = ['#FFFFFF', '#FFE066', '#FF9EC7'][i % 3];
    ctx.beginPath();
    ctx.arc(Math.random() * s, Math.random() * s, 2.4, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function paintSoil(ctx: CanvasRenderingContext2D, s: number): void {
  const g = ctx.createLinearGradient(0, 0, 0, s);
  g.addColorStop(0, '#D99A5B');
  g.addColorStop(1, '#B9773E');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  // grass lip
  ctx.fillStyle = '#5BC24C';
  ctx.fillRect(0, 0, s, s * 0.09);
  for (let x = 0; x < s; x += 16) {
    ctx.beginPath();
    ctx.arc(x + 8, s * 0.09, 9, 0, Math.PI);
    ctx.fill();
  }
  for (let i = 0; i < 40; i++) {
    ctx.fillStyle = Math.random() > 0.5 ? '#C98A4E' : '#E5AE73';
    ctx.beginPath();
    ctx.ellipse(Math.random() * s, s * 0.2 + Math.random() * s * 0.8, 6 + Math.random() * 8, 4 + Math.random() * 4, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function paintWood(ctx: CanvasRenderingContext2D, s: number): void {
  ctx.fillStyle = '#E8A15C';
  ctx.fillRect(0, 0, s, s);
  const plank = s / 4;
  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = i % 2 ? '#F0B06D' : '#E39A52';
    ctx.fillRect(0, i * plank + 3, s, plank - 6);
    ctx.strokeStyle = 'rgba(140,80,30,0.35)';
    ctx.lineWidth = 2;
    for (let k = 0; k < 3; k++) {
      ctx.beginPath();
      const y = i * plank + 10 + k * 14;
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(s * 0.3, y + 5, s * 0.6, y - 5, s, y);
      ctx.stroke();
    }
  }
  ctx.fillStyle = '#9C5B2A';
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.arc(12, i * plank + plank / 2, 4, 0, Math.PI * 2);
    ctx.arc(s - 12, i * plank + plank / 2, 4, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function paintCrate(ctx: CanvasRenderingContext2D, s: number): void {
  ctx.fillStyle = '#F2B35E';
  ctx.fillRect(0, 0, s, s);
  ctx.strokeStyle = '#B36B2C';
  ctx.lineWidth = s * 0.08;
  ctx.strokeRect(s * 0.04, s * 0.04, s * 0.92, s * 0.92);
  ctx.lineWidth = s * 0.07;
  ctx.beginPath();
  ctx.moveTo(s * 0.1, s * 0.1);
  ctx.lineTo(s * 0.9, s * 0.9);
  ctx.stroke();
  ctx.fillStyle = '#FFFFFF';
  ctx.globalAlpha = 0.85;
  drawStarPath(ctx, s * 0.72, s * 0.28, s * 0.12, s * 0.055);
  ctx.fill();
  ctx.globalAlpha = 1;
}

export function paintBrick(ctx: CanvasRenderingContext2D, s: number): void {
  ctx.fillStyle = '#F7E2C4';
  ctx.fillRect(0, 0, s, s);
  const rows = 4;
  const h = s / rows;
  for (let r = 0; r < rows; r++) {
    const off = r % 2 ? s / 4 : 0;
    for (let c = -1; c < 2; c++) {
      ctx.fillStyle = ['#FF8C7A', '#FF9F8E', '#F57C6C'][(r + c + 3) % 3];
      roundRect(ctx, off + c * (s / 2) + 4, r * h + 4, s / 2 - 8, h - 8, 8);
      ctx.fill();
    }
  }
}

export function paintCloudPlatform(ctx: CanvasRenderingContext2D, s: number): void {
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, s, s);
  ctx.fillStyle = '#E3F2FF';
  for (let i = 0; i < 10; i++) {
    ctx.beginPath();
    ctx.arc(Math.random() * s, s * 0.6 + Math.random() * s * 0.4, 20 + Math.random() * 20, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function paintSky(ctx: CanvasRenderingContext2D, s: number): void {
  const g = ctx.createLinearGradient(0, 0, 0, s);
  g.addColorStop(0, '#5BB8FF');
  g.addColorStop(0.55, '#A9DCFF');
  g.addColorStop(1, '#FFF3D6');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
}

export function paintSoftDot(ctx: CanvasRenderingContext2D, s: number): void {
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.4, 'rgba(255,255,255,0.8)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.clearRect(0, 0, s, s);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
}

export function paintSparkle(ctx: CanvasRenderingContext2D, s: number): void {
  ctx.clearRect(0, 0, s, s);
  ctx.fillStyle = '#FFFFFF';
  drawStarPath(ctx, s / 2, s / 2, s * 0.48, s * 0.16);
  ctx.fill();
}

export function paintConfetti(ctx: CanvasRenderingContext2D, s: number): void {
  ctx.clearRect(0, 0, s, s);
  ctx.fillStyle = '#FFFFFF';
  roundRect(ctx, s * 0.2, s * 0.35, s * 0.6, s * 0.3, s * 0.08);
  ctx.fill();
}

export function drawStarPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, outer: number, inner: number): void {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? inner : outer;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Transparent-background texture for particles. */
export function particleTexture(scene: Scene, name: string, painter: (ctx: CanvasRenderingContext2D, s: number) => void, size = 64): DynamicTexture {
  const dt = new DynamicTexture(name, { width: size, height: size }, scene, false);
  dt.hasAlpha = true;
  painter(dt.getContext() as unknown as CanvasRenderingContext2D, size);
  dt.update(true);
  return dt;
}
