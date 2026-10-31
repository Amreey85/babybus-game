/** Title, hero select, difficulty, stage map, rewards, settings and modal dialogs. */
import { HEROES, HERO_ORDER } from '../characters/heroes';
import type { Difficulty, HeroId, Language, QualityMode } from '../core/types';
import { STAGES, isPlayable } from '../levels/registry';
import { t } from '../localization/i18n';
import type { SaveManager, StageResult } from '../progression/SaveManager';
import { BADGE_KITTEN, MEDAL_STAGE1, TROPHY_ALL_STARS_STAGE1 } from '../progression/rewards';
import { clear, h, icon } from './dom';

export interface MenuActions {
  click(): void;
  play(): void;
  continueGame(): void;
  openStages(): void;
  openRewards(): void;
  openSettings(): void;
  chooseHero(id: HeroId): void;
  previewHero(id: HeroId | null): void;
  chooseDifficulty(d: Difficulty): void;
  startStage(n: number): void;
  back(): void;
  settingsChanged(patch: { language?: Language; musicVolume?: number; sfxVolume?: number; autoJump?: boolean; voiceHints?: boolean; quality?: QualityMode }): void;
  resetProgress(): void;
  resume(): void;
  restart(): void;
  quitRequested(): void;
  quitConfirmed(): void;
  replay(): void;
  toMenu(): void;
}

export class Menus {
  readonly root: HTMLElement;
  private screen: HTMLElement;
  private modal: HTMLElement;
  private portraits: Partial<Record<HeroId, string>> = {};
  private current: () => void = () => {};
  private modalRender: (() => void) | null = null;

  constructor(private save: SaveManager, private act: MenuActions) {
    this.screen = h('div', { class: 'passthrough' });
    this.modal = h('div', { class: 'passthrough' });
    this.root = h('div', { class: 'passthrough', style: 'position:absolute;inset:0' }, this.screen, this.modal);
  }

  setPortraits(p: Partial<Record<HeroId, string>>): void {
    this.portraits = p;
    this.screen.querySelectorAll<HTMLImageElement>('img[data-hero]').forEach((img) => {
      const src = p[img.dataset.hero as HeroId];
      if (src) img.src = src;
    });
  }

  /** Re-render the visible screen and modal, e.g. after a language change. */
  refresh(): void {
    this.current();
    this.modalRender?.();
  }

  private show(render: () => HTMLElement): void {
    this.current = () => {
      clear(this.screen);
      this.screen.append(render());
    };
    this.current();
  }

  hideScreen(): void {
    this.current = () => clear(this.screen);
    this.current();
  }

  private btn(label: string, cls: string, onClick: () => void, ico?: Parameters<typeof icon>[0], testId?: string): HTMLButtonElement {
    const b = h('button', { class: `btn ${cls}`, 'data-testid': testId }, ico ? icon(ico) : null, label);
    b.addEventListener('click', () => {
      this.act.click();
      onClick();
    });
    return b;
  }

  private backBtn(): HTMLButtonElement {
    const b = h('button', { class: 'icon-btn', 'aria-label': t('menu.back'), 'data-testid': 'back' }, icon('left'));
    b.addEventListener('click', () => {
      this.act.click();
      this.act.back();
    });
    return b;
  }

  // ---------- screens ----------

  title(): void {
    this.show(() => {
      const settings = h('button', { class: 'icon-btn', 'aria-label': t('menu.settings'), 'data-testid': 'settings' }, icon('settings'));
      settings.addEventListener('click', () => {
        this.act.click();
        this.act.openSettings();
      });
      const lang = h('button', { class: 'icon-btn', 'aria-label': t('settings.language'), 'data-testid': 'lang-toggle' }, icon('globe'));
      lang.addEventListener('click', () => {
        this.act.click();
        this.act.settingsChanged({ language: this.save.data.settings.language === 'en' ? 'ms' : 'en' });
      });
      const rows = h('div', { class: 'menu-row title-row' },
        this.btn(t('menu.stages'), '', () => this.act.openStages(), 'flag', 'stages'),
        this.save.hasProgress ? this.btn(t('menu.continue'), 'blue', () => this.act.continueGame(), 'replay', 'continue') : null,
        this.btn(t('menu.play'), 'primary big', () => this.act.play(), 'play', 'play'),
        this.btn(t('menu.rewards'), '', () => this.act.openRewards(), 'trophy', 'rewards'),
      );
      return h('div', { class: 'screen', 'data-screen': 'title' },
        h('div', { class: 'top-bar' }, h('div', { class: 'total-pill' }, icon('star'), String(this.save.totalStars)), h('div', { class: 'menu-row' }, lang, settings)),
        h('div', { class: 'logo' },
          h('div', { class: 'badge-star', html: icon('star').innerHTML }),
          h('h1', { 'aria-label': t('game.title') }, ...t('game.title').split(' ').map((word, wi) =>
            h('span', { class: 'word' }, ...[...word].map((ch, ci) => {
              const el = h('span', { class: `ltr c${(wi * 3 + ci) % 5}` }, ch);
              el.style.setProperty('--i', String(wi * 8 + ci));
              return el;
            })),
          )),
          h('div', { class: 'subtitle' }, t('game.subtitle')),
        ),
        h('div', { class: 'spacer' }),
        rows,
        h('div', { class: 'disclaimer' }, t('game.disclaimer')),
      );
    });
  }

  heroes(selected: HeroId): void {
    this.show(() => {
      const cards = HERO_ORDER.map((id) => {
        const d = HEROES[id];
        const img = h('img', { 'data-hero': id, alt: '', draggable: 'false', style: 'width:100%;height:100%;object-fit:cover' });
        if (this.portraits[id]) img.src = this.portraits[id]!;
        const portrait = h('div', { class: 'hero-portrait' }, img);
        portrait.style.background = d.card;
        const card = h('button', { class: `card${id === selected ? ' selected' : ''}`, 'data-testid': `hero-${id}` },
          portrait,
          h('div', { class: 'name' }, t(d.nameKey)),
          h('div', { class: 'desc' }, t(d.descKey)),
        );
        card.addEventListener('pointerenter', () => this.act.previewHero(id));
        card.addEventListener('focus', () => this.act.previewHero(id));
        card.addEventListener('click', () => {
          this.act.click();
          this.act.chooseHero(id);
        });
        return card;
      });
      return h('div', { class: 'screen dim', 'data-screen': 'heroes' },
        h('div', { class: 'top-bar' }, this.backBtn(), h('span')),
        h('h2', {}, t('hero.title')),
        h('div', { class: 'cards' }, ...cards),
      );
    });
  }

  difficulty(selected: Difficulty): void {
    const defs: Array<{ id: Difficulty; colour: string; stars: number; ico: Parameters<typeof icon>[0] }> = [
      { id: 'explorer', colour: '#2EC27E', stars: 1, ico: 'paw' },
      { id: 'junior', colour: '#3A86FF', stars: 2, ico: 'star' },
      { id: 'super', colour: '#FF5D8F', stars: 3, ico: 'badge' },
    ];
    this.show(() => {
      const cards = defs.map((d) => {
        const ic = h('div', { class: 'diff-icon' }, icon(d.ico));
        ic.style.background = d.colour;
        const card = h('button', { class: `card${d.id === selected ? ' selected' : ''}`, 'data-testid': `diff-${d.id}` },
          ic,
          h('div', { class: 'name' }, t(`difficulty.${d.id}`)),
          h('div', { class: 'age' }, t(`difficulty.${d.id}.age`)),
          h('div', { class: 'diff-stars' }, ...Array.from({ length: d.stars }, () => icon('star'))),
        );
        card.addEventListener('click', () => {
          this.act.click();
          this.act.chooseDifficulty(d.id);
        });
        return card;
      });
      return h('div', { class: 'screen dim', 'data-screen': 'difficulty' },
        h('div', { class: 'top-bar' }, this.backBtn(), h('span')),
        h('h2', {}, t('difficulty.title')),
        h('div', { class: 'cards' }, ...cards),
      );
    });
  }

  stages(): void {
    this.show(() => {
      const worlds = [1, 2, 3].map((w) =>
        h('div', { class: 'world' },
          h('h3', {}, t(`world.${w}` as 'world.1')),
          h('div', { class: 'stage-row' }, ...STAGES.filter((s) => s.world === w).map((s) => {
            const unlocked = s.number <= this.save.data.unlockedStage;
            const playable = unlocked && isPlayable(s);
            const rec = this.save.data.stages[s.id];
            const tile = h('button', {
              class: `stage-tile${playable ? ' playable' : unlocked ? ' soon' : ''}`,
              'data-testid': `stage-${s.number}`,
              'aria-disabled': playable ? undefined : 'true',
            },
              h('span', { class: 'num' }, String(s.number)),
              h('span', {}, t(s.nameKey)),
              playable
                ? h('span', { class: 'mini-stars' }, ...[1, 2, 3].map((i) => icon('star', (rec?.rating ?? 0) >= i ? 'on' : '')))
                : unlocked
                  ? h('span', {}, t('stages.unlockedSoon'))
                  : icon('lock'),
            );
            tile.addEventListener('click', () => {
              if (playable) {
                this.act.click();
                this.act.startStage(s.number);
              } else {
                tile.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-6px)' }, { transform: 'translateX(6px)' }, { transform: 'translateX(0)' }], { duration: 260 });
              }
            });
            return tile;
          })),
        ),
      );
      return h('div', { class: 'screen dim', 'data-screen': 'stages' },
        h('div', { class: 'top-bar' }, this.backBtn(), h('div', { class: 'total-pill' }, icon('star'), String(this.save.totalStars))),
        h('h2', {}, t('stages.title')),
        h('div', { class: 'worlds' }, ...worlds),
      );
    });
  }

  rewards(): void {
    this.show(() => {
      const d = this.save.data;
      const rec = d.stages.stage1;
      const items = [
        { id: BADGE_KITTEN, ico: 'badge' as const, key: 'rewards.badge.kitten' as const, colour: '#FF5D8F', has: d.badges.includes(BADGE_KITTEN) },
        { id: MEDAL_STAGE1, ico: 'medal' as const, key: 'rewards.medal.stage1' as const, colour: '#FFD23F', has: d.medals.includes(MEDAL_STAGE1) },
        { id: TROPHY_ALL_STARS_STAGE1, ico: 'trophy' as const, key: 'rewards.allStars' as const, colour: '#3A86FF', has: !!rec && rec.bestStars >= rec.totalStars && rec.totalStars > 0 },
      ];
      const any = items.some((i) => i.has);
      return h('div', { class: 'screen dim', 'data-screen': 'rewards' },
        h('div', { class: 'top-bar' }, this.backBtn(), h('span')),
        h('h2', {}, t('rewards.title')),
        h('div', { class: 'total-pill' }, icon('star'), `${t('rewards.totalStars')}: ${this.save.totalStars}`),
        h('div', { class: 'reward-grid' }, ...items.map((i) => {
          const big = h('div', { class: 'big-icon' }, icon(i.ico));
          big.style.color = i.colour;
          return h('div', { class: `reward${i.has ? '' : ' locked'}` }, big, t(i.key));
        })),
        any ? null : h('div', { class: 'total-pill', style: 'font-size:18px' }, t('rewards.empty')),
      );
    });
  }

  loading(): void {
    this.show(() => h('div', { class: 'screen dim', 'data-screen': 'loading' },
      h('h2', {}, t('menu.loading')),
      h('div', { class: 'loading-dots' }, h('span'), h('span'), h('span')),
    ));
  }

  complete(r: StageResult, newBest: boolean): void {
    void newBest;
    this.show(() => {
      const rating = h('div', { class: 'rating', 'aria-label': `${r.rating} / 3` }, ...[1, 2, 3].map((i) => icon('star', r.rating >= i ? 'on' : '')));
      const awards = h('div', { class: 'awards' },
        h('div', { class: 'award stars', 'data-testid': 'result-stars' }, icon('star'), `${t('complete.stars')}: ${r.stars}/${r.totalStars}`),
        r.bonusStars > 0 ? h('div', { class: 'award bonus' }, icon('sparkle'), `${t('complete.bonus')}: ${r.bonusStars}`) : null,
        r.rescued ? h('div', { class: 'award badge', 'data-testid': 'result-badge' }, icon('badge'), t('complete.badge')) : null,
        h('div', { class: 'award medal' }, icon('medal'), t('complete.medal')),
      );
      const next = h('button', { class: 'btn', disabled: true, 'data-testid': 'next-stage' }, icon('lock'), t('complete.next'));
      return h('div', { class: 'screen dim', 'data-screen': 'complete' },
        h('div', { class: 'complete-card' },
          h('h2', {}, t('complete.title')),
          rating,
          awards,
          h('div', { class: 'menu-row' },
            this.btn(t('complete.replay'), 'green', () => this.act.replay(), 'replay', 'replay'),
            this.btn(t('complete.menu'), 'blue', () => this.act.toMenu(), 'home', 'menu'),
            next,
          ),
          h('div', { class: 'soon-note' }, icon('info'), t('complete.nextSoon')),
        ),
      );
    });
  }

  // ---------- modals ----------

  private openModal(render: () => HTMLElement, onBackdrop?: () => void): void {
    this.modalRender = () => {
      clear(this.modal);
      const backdrop = h('div', { class: 'modal-backdrop' }, render());
      if (onBackdrop) backdrop.addEventListener('click', (e) => e.target === backdrop && onBackdrop());
      this.modal.append(backdrop);
      backdrop.querySelector<HTMLElement>('button')?.focus({ preventScroll: true });
    };
    this.modalRender();
  }

  closeModal(): void {
    this.modalRender = null;
    clear(this.modal);
  }

  get modalOpen(): boolean {
    return this.modal.childElementCount > 0;
  }

  pause(): void {
    this.openModal(() => h('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'data-testid': 'pause-modal' },
      h('h2', {}, t('pause.title')),
      this.btn(t('pause.resume'), 'green big', () => this.act.resume(), 'play', 'resume'),
      h('div', { class: 'row' },
        this.btn(t('pause.restart'), '', () => this.act.restart(), 'replay', 'restart'),
        this.btn(t('menu.settings'), '', () => this.act.openSettings(), 'settings', 'pause-settings'),
      ),
      this.btn(t('pause.quit'), 'pink', () => this.act.quitRequested(), 'door', 'quit'),
    ));
  }

  quitConfirm(): void {
    this.openModal(() => h('div', { class: 'modal', role: 'alertdialog', 'aria-modal': 'true', 'data-testid': 'quit-modal' },
      h('div', { class: 'warn-icon' }, icon('info')),
      h('h2', {}, t('quit.title')),
      h('p', {}, t('quit.body')),
      h('div', { class: 'row' },
        this.btn(t('quit.keep'), 'green', () => this.act.resume(), 'play', 'quit-cancel'),
        this.btn(t('quit.confirm'), 'pink', () => this.act.quitConfirmed(), 'door', 'quit-confirm'),
      ),
    ));
  }

  settings(onClose: () => void, extras: { autoJump: boolean; voiceHints: boolean }): void {
    const render = () => {
      const s = this.save.data.settings;
      const seg = <T extends string | boolean>(options: Array<[T, string]>, value: T, onPick: (v: T) => void, testId: string) =>
        h('div', { class: 'seg', 'data-testid': testId }, ...options.map(([v, label]) => {
          const b = h('button', { class: v === value ? 'on' : '' }, label);
          b.addEventListener('click', () => {
            this.act.click();
            onPick(v);
            this.modalRender?.();
          });
          return b;
        }));
      const slider = (value: number, onInput: (v: number) => void, testId: string) => {
        const input = h('input', { type: 'range', min: 0, max: 100, value: Math.round(value * 100), 'data-testid': testId, 'aria-label': testId }) as HTMLInputElement;
        input.style.setProperty('--fill', `${input.value}%`);
        input.addEventListener('input', () => {
          input.style.setProperty('--fill', `${input.value}%`);
          onInput(Number(input.value) / 100);
        });
        input.addEventListener('change', () => this.act.click());
        return input;
      };
      const onOff: Array<[boolean, string]> = [[true, t('settings.on')], [false, t('settings.off')]];
      const close = h('button', { class: 'btn green', 'data-testid': 'settings-close' }, icon('play'), t('menu.back'));
      close.addEventListener('click', () => {
        this.act.click();
        onClose();
      });
      const reset = h('button', { class: 'link-btn', 'data-testid': 'reset' }, t('settings.reset'));
      reset.addEventListener('click', () => this.resetConfirm(onClose, extras));
      return h('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'data-testid': 'settings-modal' },
        h('h2', {}, t('settings.title')),
        h('div', { class: 'setting' }, h('span', { class: 'lbl' }, icon('globe'), t('settings.language')),
          seg<Language>([['en', 'English'], ['ms', 'Bahasa Melayu']], s.language, (v) => this.act.settingsChanged({ language: v }), 'set-lang')),
        h('div', { class: 'setting' }, h('span', { class: 'lbl' }, icon('music'), t('settings.music')),
          slider(s.musicVolume, (v) => this.act.settingsChanged({ musicVolume: v }), 'set-music')),
        h('div', { class: 'setting' }, h('span', { class: 'lbl' }, icon('sound'), t('settings.sfx')),
          slider(s.sfxVolume, (v) => this.act.settingsChanged({ sfxVolume: v }), 'set-sfx')),
        h('div', { class: 'setting' }, h('span', { class: 'lbl' }, icon('jump'), t('settings.autoJump')),
          seg<boolean>(onOff, extras.autoJump, (v) => {
            extras.autoJump = v;
            this.act.settingsChanged({ autoJump: v });
          }, 'set-autojump')),
        h('div', { class: 'setting' }, h('span', { class: 'lbl' }, icon('bulb'), t('settings.voice')),
          seg<boolean>(onOff, extras.voiceHints, (v) => {
            extras.voiceHints = v;
            this.act.settingsChanged({ voiceHints: v });
          }, 'set-voice')),
        h('div', { class: 'setting' }, h('span', { class: 'lbl' }, icon('sparkle'), t('settings.quality')),
          seg<QualityMode>([['auto', t('settings.quality.auto')], ['high', t('settings.quality.high')], ['low', t('settings.quality.low')]], s.quality, (v) => this.act.settingsChanged({ quality: v }), 'set-quality')),
        close,
        reset,
      );
    };
    this.openModal(render, onClose);
  }

  private resetConfirm(onClose: () => void, extras: { autoJump: boolean; voiceHints: boolean }): void {
    this.openModal(() => h('div', { class: 'modal', role: 'alertdialog', 'aria-modal': 'true' },
      h('div', { class: 'warn-icon' }, icon('info')),
      h('h2', {}, t('settings.resetConfirm')),
      h('div', { class: 'row' },
        this.btn(t('settings.resetNo'), 'green', () => this.settings(onClose, extras)),
        this.btn(t('settings.resetYes'), 'pink', () => {
          this.act.resetProgress();
          this.settings(onClose, extras);
        }),
      ),
    ));
  }
}
