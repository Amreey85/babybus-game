/**
 * Application shell: owns the engine, menus, saves and the active stage,
 * and moves the player between screens.
 */
import { AudioManager } from '../audio/AudioManager';
import { InputManager } from '../controls/InputManager';
import { EngineHost } from '../engine/EngineHost';
import { MenuScene } from '../engine/MenuScene';
import { getStage } from '../levels/registry';
import { onLanguageChange, setLanguage, t } from '../localization/i18n';
import { SaveManager, type Settings, type StageResult } from '../progression/SaveManager';
import { Hud } from '../ui/Hud';
import { Menus } from '../ui/Menus';
import { h, icon } from '../ui/dom';
import type { StageController } from './stageApi';
import { DIFFICULTIES, type Difficulty, type HeroId } from './types';

type MenuScreen = 'title' | 'heroes' | 'difficulty' | 'stages' | 'rewards' | 'complete' | 'loading';

export class App {
  readonly save = new SaveManager();
  readonly audio = new AudioManager();
  readonly input = new InputManager();
  readonly host: EngineHost;
  private hud: Hud;
  private menus: Menus;
  private menuScene: MenuScene | null = null;
  private stage: StageController | null = null;
  private stageNumber = 1;
  private pendingStage = 1;
  private screen: MenuScreen = 'title';
  private paused = false;
  private stageComplete = false;
  private settingsFromPause = false;
  private rotateEl: HTMLElement;

  constructor(root: HTMLElement) {
    const canvas = h('canvas', { id: 'game', 'aria-label': t('game.title'), tabindex: '0' }) as HTMLCanvasElement;
    const ui = h('div', { id: 'ui' });
    root.append(canvas, ui);
    this.host = new EngineHost(canvas);
    const forced = new URLSearchParams(location.search).get('quality');
    this.host.setMode(forced === 'low' || forced === 'high' ? forced : this.save.data.settings.quality);

    setLanguage(this.save.data.settings.language);
    this.audio.setVolumes(this.save.data.settings.musicVolume, this.save.data.settings.sfxVolume);

    this.hud = new Hud(() => this.pause(), () => this.stage?.showHint(), () => this.stage?.skipIntro());
    this.input.bindTouchButtons(this.hud.touch);
    this.input.setPauseHandler(() => (this.paused ? this.resume() : this.pause()));
    this.menus = new Menus(this.save, {
      click: () => this.click(),
      play: () => {
        this.pendingStage = 1;
        this.go('heroes');
      },
      continueGame: () => this.go('stages'),
      openStages: () => this.go('stages'),
      openRewards: () => this.go('rewards'),
      openSettings: () => this.openSettings(),
      chooseHero: (id) => this.chooseHero(id),
      previewHero: (id) => this.menuScene?.setFocus(id),
      chooseDifficulty: (d) => this.chooseDifficulty(d),
      startStage: (n) => {
        this.pendingStage = n;
        this.go('heroes');
      },
      back: () => this.back(),
      settingsChanged: (p) => this.applySettings(p),
      resetProgress: () => {
        this.save.reset();
      },
      resume: () => this.resume(),
      restart: () => this.restartStage(),
      quitRequested: () => this.menus.quitConfirm(),
      quitConfirmed: () => this.quitToTitle(),
      replay: () => this.restartStage(),
      toMenu: () => this.quitToTitle(),
    });
    this.rotateEl = h('div', { id: 'rotate', class: 'overlay wanted' },
      h('div', {}, h('div', { class: 'big' }, icon('replay')), h('h2', {}, t('rotate.title')), h('p', {}, t('rotate.body'))),
    );
    ui.append(this.hud.root, this.menus.root, this.rotateEl);

    onLanguageChange(() => {
      this.menus.refresh();
      this.hud.refreshText();
      this.rotateEl.querySelector('h2')!.textContent = t('rotate.title');
      this.rotateEl.querySelector('p')!.textContent = t('rotate.body');
    });

    // Audio may only start after a user gesture.
    const unlock = () => {
      this.audio.unlock();
      if (!this.stage) this.audio.playMusic('menu');
    };
    window.addEventListener('pointerdown', unlock, { capture: true });
    window.addEventListener('keydown', unlock, { capture: true });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        if (this.stage && !this.paused && !this.stageComplete) this.pause();
        this.audio.suspend();
      } else if (!this.paused) this.audio.resume();
    });
    window.matchMedia?.('(orientation: portrait)').addEventListener?.('change', (e) => {
      if (e.matches && this.input.usingTouch && this.stage && !this.paused && !this.stageComplete) this.pause();
    });
    window.addEventListener('beforeunload', (e) => {
      if (this.stage && !this.stageComplete) {
        e.preventDefault();
        e.returnValue = t('leave.warning');
        return t('leave.warning');
      }
      return undefined;
    });
    // Block pinch-zoom and double-tap zoom during play.
    document.addEventListener('gesturestart', (e) => e.preventDefault());
    document.addEventListener('dblclick', (e) => e.preventDefault());

    this.createMenuScene();
    this.host.engine.runRenderLoop(() => {
      if (this.stage) this.stage.render();
      else this.menuScene?.render();
    });
    this.go('title');
    this.exposeTestHooks();
  }

  private click(): void {
    this.audio.unlock();
    this.audio.play('button');
  }

  private createMenuScene(): void {
    this.menuScene = new MenuScene(this.host);
    void this.menuScene.portraits().then((p) => this.menus.setPortraits(p));
  }

  private go(screen: MenuScreen): void {
    this.screen = screen;
    this.menuScene?.setFocus(screen === 'heroes' ? this.save.data.hero : null);
    switch (screen) {
      case 'title':
        this.menus.title();
        break;
      case 'heroes':
        this.menus.heroes(this.save.data.hero);
        break;
      case 'difficulty':
        this.menus.difficulty(this.save.data.difficulty);
        break;
      case 'stages':
        this.menus.stages();
        break;
      case 'rewards':
        this.menus.rewards();
        break;
      case 'loading':
        this.menus.loading();
        break;
      case 'complete':
        break;
    }
  }

  private back(): void {
    if (this.screen === 'difficulty') this.go('heroes');
    else this.go('title');
  }

  private chooseHero(id: HeroId): void {
    this.save.data.hero = id;
    this.save.save();
    this.menuScene?.setFocus(id);
    setTimeout(() => this.go('difficulty'), 250);
  }

  private chooseDifficulty(d: Difficulty): void {
    this.save.data.difficulty = d;
    this.save.save();
    void this.startStage(this.pendingStage);
  }

  private effective(): { autoJump: boolean; voiceHints: boolean } {
    const s = this.save.data.settings;
    const tune = DIFFICULTIES[this.save.data.difficulty];
    return { autoJump: s.autoJump ?? tune.autoJumpDefault, voiceHints: s.voiceHints ?? tune.voiceHintsDefault };
  }

  private async startStage(n: number): Promise<void> {
    const info = getStage(n);
    if (!info?.load) return;
    this.stageNumber = n;
    this.go('loading');
    this.menuScene?.cheer();
    this.audio.playMusic(null);
    const mod = await info.load();
    await new Promise((r) => setTimeout(r, 60));
    this.disposeStage();
    this.menuScene?.dispose();
    this.menuScene = null;
    const eff = this.effective();
    this.audio.voiceEnabled = eff.voiceHints;
    this.stageComplete = false;
    this.paused = false;
    const stage = mod.createStage({
      host: this.host,
      audio: this.audio,
      input: this.input,
      hud: this.hud,
      hero: this.save.data.hero,
      difficulty: this.save.data.difficulty,
      autoJump: eff.autoJump,
      lowQuality: this.host.quality === 'low',
      onComplete: (r) => this.onComplete(r),
    });
    this.stage = stage;
    try {
      await (stage as unknown as { scene: { whenReadyAsync(): Promise<void> } }).scene.whenReadyAsync();
    } catch {
      /* render anyway */
    }
    if (this.stage !== stage) return;
    this.menus.hideScreen();
    this.hud.show(true);
    stage.start();
    this.host.canvas.focus({ preventScroll: true });
  }

  private onComplete(r: StageResult): void {
    const prev = this.save.data.stages[r.stageId]?.bestStars ?? 0;
    this.save.recordStageResult(r);
    this.stageComplete = true;
    this.hud.show(false);
    this.screen = 'complete';
    this.menus.complete(r, r.stars > prev);
  }

  private pause(): void {
    if (!this.stage || this.stageComplete || this.paused) return;
    this.paused = true;
    this.stage.setPaused(true);
    this.menus.pause();
  }

  private resume(): void {
    if (!this.stage) return;
    this.menus.closeModal();
    this.paused = false;
    this.stage.setPaused(false);
    this.host.canvas.focus({ preventScroll: true });
  }

  private restartStage(): void {
    this.menus.closeModal();
    this.paused = false;
    this.disposeStage();
    this.hud.show(false);
    void this.startStage(this.stageNumber);
  }

  /** Quitting abandons the run. Nothing mid-stage is saved, so play restarts from Stage 1. */
  private quitToTitle(): void {
    this.menus.closeModal();
    this.paused = false;
    this.disposeStage();
    this.hud.show(false);
    this.audio.resume();
    this.createMenuScene();
    this.audio.playMusic('menu');
    this.go('title');
  }

  private disposeStage(): void {
    if (!this.stage) return;
    this.stage.dispose();
    this.stage = null;
    this.input.reset();
  }

  private openSettings(): void {
    this.settingsFromPause = !!this.stage && this.paused;
    const extras = this.effective();
    this.menus.settings(() => {
      if (this.settingsFromPause) this.menus.pause();
      else this.menus.closeModal();
    }, extras);
  }

  private applySettings(p: Partial<Settings>): void {
    this.save.updateSettings(p);
    const s = this.save.data.settings;
    if (p.language) setLanguage(p.language);
    if (p.musicVolume !== undefined || p.sfxVolume !== undefined) {
      this.audio.unlock();
      this.audio.setVolumes(s.musicVolume, s.sfxVolume);
      if (p.sfxVolume !== undefined) this.audio.play('star');
    }
    if (typeof p.autoJump === 'boolean') this.stage?.setAutoJump(p.autoJump);
    if (typeof p.voiceHints === 'boolean') this.audio.voiceEnabled = p.voiceHints;
    if (p.quality) this.host.setMode(p.quality);
  }

  private exposeTestHooks(): void {
    const params = new URLSearchParams(location.search);
    if (!params.has('test') && !import.meta.env.DEV) return;
    (window as unknown as Record<string, unknown>).__SLSRA__ = {
      state: () => ({
        screen: this.screen,
        paused: this.paused,
        complete: this.stageComplete,
        stage: this.stage?.debugState() ?? null,
        save: this.save.data,
        quality: this.host.quality,
      }),
      teleport: (x: number, y: number) => this.stage?.debugTeleport(x, y),
      input: this.input.virtual,
      scene: () => (this.stage as unknown as { scene?: unknown })?.scene,
    };
  }
}
