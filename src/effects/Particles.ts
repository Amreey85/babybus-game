/** Pooled particle bursts: sparkles, dust, confetti, splashes and hearts. */
import { Color4, ParticleSystem, Scene, Vector3 } from '../engine/babylon';
import { paintConfetti, paintSoftDot, paintSparkle, particleTexture } from '../engine/materials';

type Kind = 'sparkle' | 'dust' | 'confetti' | 'splash';

export class Particles {
  private systems = new Map<Kind, ParticleSystem>();
  private emitters = new Map<Kind, Vector3>();

  constructor(private scene: Scene, private low: boolean) {
    const sparkleTex = particleTexture(scene, 'pSparkle', paintSparkle);
    const dotTex = particleTexture(scene, 'pDot', paintSoftDot);
    const confettiTex = particleTexture(scene, 'pConfetti', paintConfetti);
    this.make('sparkle', sparkleTex, { min: 0.18, max: 0.42, life: [0.4, 0.8], power: [2, 5], gravity: -3 });
    this.make('dust', dotTex, { min: 0.25, max: 0.6, life: [0.25, 0.5], power: [0.6, 1.6], gravity: 1 });
    this.make('confetti', confettiTex, { min: 0.2, max: 0.4, life: [1.6, 2.8], power: [5, 10], gravity: -6 });
    this.make('splash', dotTex, { min: 0.2, max: 0.5, life: [0.5, 0.9], power: [3, 6], gravity: -12 });
  }

  private make(kind: Kind, tex: ParticleSystem['particleTexture'], o: { min: number; max: number; life: [number, number]; power: [number, number]; gravity: number }): void {
    const emitter = new Vector3(0, -100, 0);
    const ps = new ParticleSystem(`ps_${kind}`, this.low ? 200 : 600, this.scene);
    ps.particleTexture = tex;
    ps.emitter = emitter;
    ps.minEmitBox = new Vector3(-0.2, -0.2, -0.2);
    ps.maxEmitBox = new Vector3(0.2, 0.2, 0.2);
    ps.minSize = o.min;
    ps.maxSize = o.max;
    ps.minLifeTime = o.life[0];
    ps.maxLifeTime = o.life[1];
    ps.minEmitPower = o.power[0];
    ps.maxEmitPower = o.power[1];
    ps.gravity = new Vector3(0, o.gravity, 0);
    ps.direction1 = new Vector3(-1, 1, -0.6);
    ps.direction2 = new Vector3(1, 1.4, 0.6);
    ps.minAngularSpeed = -4;
    ps.maxAngularSpeed = 4;
    ps.blendMode = kind === 'dust' ? ParticleSystem.BLENDMODE_STANDARD : ParticleSystem.BLENDMODE_ONEONE;
    if (kind === 'confetti') ps.blendMode = ParticleSystem.BLENDMODE_STANDARD;
    ps.colorDead = new Color4(1, 1, 1, 0);
    ps.manualEmitCount = 0;
    ps.updateSpeed = 1 / 60;
    ps.start();
    this.systems.set(kind, ps);
    this.emitters.set(kind, emitter);
  }

  burst(kind: Kind, pos: Vector3, count: number, c1: string, c2 = c1): void {
    const ps = this.systems.get(kind);
    const em = this.emitters.get(kind);
    if (!ps || !em) return;
    em.copyFrom(pos);
    ps.color1 = Color4.FromHexString(c1.length === 7 ? `${c1}FF` : c1);
    ps.color2 = Color4.FromHexString(c2.length === 7 ? `${c2}FF` : c2);
    if (kind === 'dust') ps.colorDead = new Color4(1, 1, 1, 0);
    ps.manualEmitCount = Math.max(0, ps.manualEmitCount) + Math.ceil(count * (this.low ? 0.5 : 1));
  }

  /** Wide confetti spray, e.g. for the finish line. */
  confetti(pos: Vector3): void {
    const ps = this.systems.get('confetti');
    if (!ps) return;
    ps.minEmitBox = new Vector3(-3, 0, -1);
    ps.maxEmitBox = new Vector3(3, 1, 1);
    const colours = ['#FF5D73', '#FFD43B', '#4CC9F0', '#9B5DE5', '#06D6A0'];
    colours.forEach((c, i) => setTimeout(() => this.burst('confetti', pos, 40, c, colours[(i + 2) % colours.length]), i * 140));
  }
}
