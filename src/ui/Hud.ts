/** In-game HUD, world labels, toasts, captions and touch controls. */
import type { HudApi, ToastIcon } from '../core/stageApi';
import { t, type TranslationKey } from '../localization/i18n';
import { h, icon } from './dom';
import type { IconName } from './icons';

const TOAST_ICONS: Record<ToastIcon, { icon: IconName; bg: string }> = {
  star: { icon: 'star', bg: '#FFB703' },
  flag: { icon: 'flag', bg: '#3A86FF' },
  heart: { icon: 'heart', bg: '#FF5D8F' },
  badge: { icon: 'badge', bg: '#FF5D8F' },
  splash: { icon: 'splash', bg: '#4CC9F0' },
  info: { icon: 'info', bg: '#7B61FF' },
  move: { icon: 'right', bg: '#FF8A3D' },
  jump: { icon: 'jump', bg: '#FF8A3D' },
  bounce: { icon: 'bounce', bg: '#FF5D8F' },
};
const OBJ_ICONS: Record<string, IconName> = { star: 'star', kitten: 'kitten', cat: 'heart', flag: 'flag', party: 'party' };

export class Hud implements HudApi {
  readonly root: HTMLElement;
  readonly touch: HTMLElement;
  private starText: HTMLElement;
  private starBox: HTMLElement;
  private objective: HTMLElement;
  private objText: HTMLElement;
  private objIcon: HTMLElement;
  private toasts: HTMLElement;
  private labels: HTMLElement;
  private labelEls = new Map<string, HTMLElement>();
  private captionEl: HTMLElement;
  private fadeEl: HTMLElement;
  private skipBtn: HTMLButtonElement;
  private interactBtn: HTMLElement;
  private badgeSlot: HTMLElement;
  private objKey: TranslationKey = 'obj.stars';
  private captionKey: TranslationKey | null = null;
  readonly pauseBtn: HTMLButtonElement;
  readonly hintBtn: HTMLButtonElement;

  constructor(onPause: () => void, onHint: () => void, onSkip: () => void) {
    this.starText = h('span', { 'data-testid': 'star-count' }, '0/0');
    this.starBox = h('div', { class: 'star-counter', 'aria-live': 'polite' }, icon('star'), this.starText);
    this.badgeSlot = h('div', { class: 'badge-slot', title: t('complete.badge') }, icon('badge'));
    this.objIcon = h('span', { class: 'obj-icon' }, icon('star'));
    this.objText = h('span', {}, '');
    this.objective = h('div', { class: 'objective', 'data-testid': 'objective' }, this.objIcon, this.objText);
    this.hintBtn = h('button', { class: 'icon-btn', 'aria-label': t('hud.hint'), 'data-testid': 'hint-btn' }, icon('bulb'));
    this.pauseBtn = h('button', { class: 'icon-btn', 'aria-label': t('pause.title'), 'data-testid': 'pause-btn' }, icon('pause'));
    this.hintBtn.addEventListener('click', onHint);
    this.pauseBtn.addEventListener('click', onPause);
    const top = h('div', { class: 'hud-top' },
      h('div', { class: 'hud-left' }, this.starBox, this.badgeSlot),
      this.objective,
      h('div', { class: 'hud-buttons' }, this.hintBtn, this.pauseBtn),
    );
    this.toasts = h('div', { class: 'toasts' });
    this.labels = h('div', { class: 'labels' });
    this.captionEl = h('div', { class: 'caption hidden', 'data-testid': 'caption' });
    this.fadeEl = h('div', { class: 'fade' });
    this.skipBtn = h('button', { class: 'btn skip-btn hidden', 'data-testid': 'skip-intro' }, t('intro.skip'), icon('right'));
    this.skipBtn.addEventListener('click', onSkip);

    this.interactBtn = h('button', { class: 'tbtn interact', 'data-action': 'interact', 'aria-label': 'Interact' }, icon('hand'));
    this.touch = h('div', { class: 'touch' },
      h('div', { class: 'pad left' },
        h('button', { class: 'tbtn', 'data-action': 'left', 'aria-label': 'Left' }, icon('left')),
        h('button', { class: 'tbtn', 'data-action': 'right', 'aria-label': 'Right' }, icon('right')),
      ),
      h('div', { class: 'pad right' },
        this.interactBtn,
        h('button', { class: 'tbtn jump', 'data-action': 'jump', 'aria-label': 'Jump' }, icon('jump')),
      ),
    );
    this.root = h('div', { id: 'hud', class: 'hidden' }, this.labels, top, this.toasts, this.captionEl, this.touch, this.fadeEl, this.skipBtn);
  }

  show(on: boolean): void {
    this.root.classList.toggle('hidden', !on);
    this.touch.classList.toggle('active', on);
    if (on) this.badgeSlot.classList.remove('earned');
  }

  refreshText(): void {
    this.objText.textContent = t(this.objKey);
    if (this.captionKey) this.captionEl.textContent = t(this.captionKey);
    this.skipBtn.firstChild!.textContent = t('intro.skip');
    this.hintBtn.setAttribute('aria-label', t('hud.hint'));
    this.pauseBtn.setAttribute('aria-label', t('pause.title'));
  }

  setStars(collected: number, total: number): void {
    this.starText.textContent = `${collected}/${total}`;
    this.starBox.classList.remove('bump');
    void this.starBox.offsetWidth;
    if (collected > 0) this.starBox.classList.add('bump');
  }

  setObjective(key: TranslationKey, ico: 'star' | 'kitten' | 'cat' | 'flag' | 'party'): void {
    this.objKey = key;
    this.objText.textContent = t(key);
    this.objIcon.replaceChildren(icon(OBJ_ICONS[ico]));
    this.objective.classList.remove('changed');
    void this.objective.offsetWidth;
    this.objective.classList.add('changed');
  }

  toast(key: TranslationKey, ico: ToastIcon): void {
    const spec = TOAST_ICONS[ico];
    const ti = h('span', { class: 't-icon' }, icon(spec.icon));
    ti.style.background = spec.bg;
    const el = h('div', { class: 'toast', 'data-testid': 'toast' }, ti, t(key));
    this.toasts.append(el);
    while (this.toasts.children.length > 3) this.toasts.firstElementChild?.remove();
    setTimeout(() => el.remove(), 2500);
  }

  caption(key: TranslationKey | null): void {
    this.captionKey = key;
    if (!key) {
      this.captionEl.classList.add('hidden');
      return;
    }
    this.captionEl.textContent = t(key);
    this.captionEl.classList.remove('hidden');
    this.captionEl.style.animation = 'none';
    void this.captionEl.offsetWidth;
    this.captionEl.style.animation = '';
  }

  label(id: string, o: { x: number; y: number; visible: boolean; text?: string; kind?: 'bubble' | 'prompt' | 'arrow' }): void {
    let el = this.labelEls.get(id);
    if (!o.visible) {
      if (el) el.style.display = 'none';
      return;
    }
    const kind = o.kind ?? 'bubble';
    if (!el || el.dataset.kind !== kind) {
      el?.remove();
      el = h('div', { class: `wl ${kind}` });
      el.dataset.kind = kind;
      if (kind === 'arrow') el.append(icon('right'));
      this.labels.append(el);
      this.labelEls.set(id, el);
    }
    if (kind === 'prompt') {
      if (el.dataset.text !== o.text) {
        el.dataset.text = o.text ?? '';
        el.replaceChildren(
          h('span', { class: 'key key-kb' }, 'E'),
          h('span', { class: 'key key-touch' }, icon('hand')),
          o.text ?? '',
        );
      }
    } else if (kind === 'bubble' && el.textContent !== o.text) el.textContent = o.text ?? '';
    el.style.display = '';
    const rot = kind === 'arrow' ? ' rotate(90deg)' : '';
    el.style.transform = `translate(${o.x.toFixed(1)}px, ${o.y.toFixed(1)}px) translate(-50%, -100%)${rot}`;
  }

  clearLabels(): void {
    this.labels.replaceChildren();
    this.labelEls.clear();
  }

  setInteractHighlight(on: boolean): void {
    this.interactBtn.classList.toggle('glow', on);
  }

  fade(on: boolean): void {
    this.fadeEl.classList.toggle('on', on);
  }

  setIntro(on: boolean): void {
    this.skipBtn.classList.toggle('hidden', !on);
    this.touch.classList.toggle('active', !on);
  }

  badgePop(): void {
    this.badgeSlot.classList.add('earned');
  }
}
