/**
 * HUD: barra rápida com ícones, corações (cheios/meios/vazios, envenenado, absorção), fome (coxinhas),
 * armadura, bolhas de ar, barra e nível de experiência, nome do item e mira.
 */
import type { Player } from '../game/player/player';
import { slotHTML } from './screens/container';

type Px = string[];
// ícones 9×9 próprios. Legenda: . vazio, o contorno, a/b/c tons
const HEART: Px = ['.oo...oo.', 'oabo.oaao', 'oaaaoaaao', 'oaaaaaaao', 'oaaaaaabo', '.oaaaabo.', '..oaabo..', '...obo...', '....o....'];
const COXINHA: Px = ['....oo...', '...oaao..', '..oaaabo.', '.oaaaaao.', '.oaaaaabo', 'oaaaaaabo', 'oabbbbbbo', '.obbbbbo.', '..ooooo..'];
const ARMOR: Px = ['.oo...oo.', 'oaaoooaao', 'oaaaaaaao', 'oaaaaaaao', '.oaaaaao.', '.oaaaaao.', '.oaaaaao.', '..oaaao..', '...ooo...'];
const BUBBLE: Px = ['..ooooo..', '.oaaaaao.', 'oabaaaaao', 'oabaaaaao', 'oaaaaaaao', 'oaaaaaaao', 'oaaaaaaao', '.oaaaaao.', '..ooooo..'];

function sprite(px: Px, pal: Record<string, string>, half = false, empty = false): string {
  const c = document.createElement('canvas');
  c.width = 9; c.height = 9;
  const g = c.getContext('2d')!;
  for (let y = 0; y < 9; y++) for (let x = 0; x < 9; x++) {
    const ch = px[y][x];
    if (ch === '.') continue;
    let col = pal[ch];
    if (empty && ch !== 'o') col = pal.e;
    if (half && x >= 5 && ch !== 'o') col = pal.e;
    if (!col) continue;
    g.fillStyle = col;
    g.fillRect(x, y, 1, 1);
  }
  return c.toDataURL();
}

function makeIcons(): Record<string, string> {
  const heartPal = { o: '#2a0d10', a: '#e0343d', b: '#ff9da0', e: '#3b2226' };
  const poisonPal = { o: '#10200c', a: '#6fa12c', b: '#c4e98a', e: '#2b3322' };
  const goldPal = { o: '#3a2a05', a: '#e8b52a', b: '#fff0a6', e: '#3b3322' };
  const coxPal = { o: '#3a1f0c', a: '#d9913d', b: '#a45e22', e: '#3a2b20' };
  const hungerPal = { o: '#1f2a0c', a: '#8ea33f', b: '#5f7322', e: '#2d3322' };
  const armorPal = { o: '#1c1f24', a: '#c9ced6', b: '#ffffff', e: '#2f333a' };
  const bubblePal = { o: '#0e3350', a: '#6fc3ef', b: '#e6f7ff', e: 'transparent' };
  return {
    heart: sprite(HEART, heartPal), heartHalf: sprite(HEART, heartPal, true), heartEmpty: sprite(HEART, heartPal, false, true),
    poison: sprite(HEART, poisonPal), poisonHalf: sprite(HEART, poisonPal, true),
    gold: sprite(HEART, goldPal), goldHalf: sprite(HEART, goldPal, true),
    food: sprite(COXINHA, coxPal), foodHalf: sprite(COXINHA, coxPal, true), foodEmpty: sprite(COXINHA, coxPal, false, true),
    hunger: sprite(COXINHA, hungerPal), hungerHalf: sprite(COXINHA, hungerPal, true),
    armor: sprite(ARMOR, armorPal), armorHalf: sprite(ARMOR, armorPal, true), armorEmpty: sprite(ARMOR, armorPal, false, true),
    bubble: sprite(BUBBLE, bubblePal),
  };
}

export class Hud {
  readonly el: HTMLDivElement;
  private readonly hotbar: HTMLDivElement;
  private readonly slots: HTMLDivElement[] = [];
  private readonly hearts: HTMLDivElement;
  private readonly food: HTMLDivElement;
  private readonly armor: HTMLDivElement;
  private readonly air: HTMLDivElement;
  private readonly xpFill: HTMLDivElement;
  private readonly xpLevel: HTMLDivElement;
  private readonly name: HTMLDivElement;
  private readonly offhand: HTMLDivElement;
  readonly msgs: HTMLDivElement;
  private readonly actionbar: HTMLDivElement;
  private icons = makeIcons();
  private lastInv = -1;
  private nameTimer = 0;
  private lastSel = -1;
  private lastHealth = 20;
  private flash = 0;
  private t = 0;
  private actionTimer = 0;

  constructor(parent: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'hud';
    this.el.innerHTML = `<div class="crosshair"></div><div class="attack-ind"><div class="attack-fill"></div></div>`;
    const bars = document.createElement('div');
    bars.className = 'hud-bars';
    this.armor = this.row('armor-row');
    this.hearts = this.row('hearts');
    this.food = this.row('food');
    this.air = this.row('air');
    const left = document.createElement('div'); left.className = 'bars-left'; left.append(this.armor, this.hearts);
    const right = document.createElement('div'); right.className = 'bars-right'; right.append(this.air, this.food);
    bars.append(left, right);
    const xp = document.createElement('div'); xp.className = 'xpbar';
    this.xpFill = document.createElement('div'); this.xpFill.className = 'xpfill';
    this.xpLevel = document.createElement('div'); this.xpLevel.className = 'xplevel';
    xp.append(this.xpFill, this.xpLevel);
    this.hotbar = document.createElement('div');
    this.hotbar.className = 'hotbar';
    for (let i = 0; i < 9; i++) {
      const s = document.createElement('div');
      s.className = 'slot';
      this.slots.push(s);
      this.hotbar.append(s);
    }
    this.offhand = document.createElement('div');
    this.offhand.className = 'slot offhand-hud';
    this.name = document.createElement('div');
    this.name.className = 'held-name';
    this.msgs = document.createElement('div');
    this.msgs.className = 'chat-log';
    this.actionbar = document.createElement('div');
    this.actionbar.className = 'actionbar';
    const bottom = document.createElement('div');
    bottom.className = 'hud-bottom';
    bottom.append(this.name, this.actionbar, bars, xp, this.hotbar);
    this.el.append(bottom, this.offhand, this.msgs);
    parent.appendChild(this.el);
  }

  private row(cls: string): HTMLDivElement {
    const d = document.createElement('div');
    d.className = `icon-row ${cls}`;
    for (let i = 0; i < 10; i++) { const s = document.createElement('i'); d.append(s); }
    return d;
  }

  message(text: string, ms = 8000): void {
    const m = document.createElement('div');
    m.className = 'msg';
    m.textContent = text;
    this.msgs.append(m);
    setTimeout(() => m.classList.add('fade'), ms);
    setTimeout(() => m.remove(), ms + 1200);
    while (this.msgs.children.length > 10) this.msgs.firstElementChild?.remove();
  }

  action(text: string, seconds = 2.5): void {
    this.actionbar.textContent = text;
    this.actionTimer = seconds;
  }

  setVisible(v: boolean): void { this.el.style.display = v ? '' : 'none'; }

  private sleepEl?: HTMLDivElement;
  setSleep(f: number): void {
    if (!this.sleepEl) {
      this.sleepEl = document.createElement('div');
      this.sleepEl.className = 'sleep-fade';
      this.el.prepend(this.sleepEl);
    }
    this.sleepEl.style.opacity = String(f * 0.92);
  }

  /** Indicador de recarga do ataque sob a mira (0..1; some quando cheio e sem alvo). */
  attackIndicator(strength: number, targeting: boolean): void {
    const ind = this.el.querySelector('.attack-ind') as HTMLDivElement;
    const fill = ind.firstElementChild as HTMLDivElement;
    const show = strength < 1 || targeting;
    ind.style.opacity = show ? '1' : '0';
    fill.style.width = `${Math.round(strength * 100)}%`;
    ind.classList.toggle('ready', strength >= 1 && targeting);
  }

  update(p: Player, dt: number): void {
    this.t += dt;
    const inv = p.inventory;
    const survival = p.gameMode === 'survival';
    if (inv.version !== this.lastInv) {
      this.lastInv = inv.version;
      for (let i = 0; i < 9; i++) {
        const html = slotHTML(inv.main[i]);
        if (this.slots[i].dataset.h !== html) { this.slots[i].innerHTML = html; this.slots[i].dataset.h = html; }
      }
      const oh = slotHTML(inv.offhand);
      this.offhand.innerHTML = oh;
      this.offhand.style.display = inv.offhand ? '' : 'none';
    }
    if (inv.selected !== this.lastSel) {
      this.slots.forEach((s, i) => s.classList.toggle('sel', i === inv.selected));
      if (this.lastSel >= 0 && inv.held) { this.name.textContent = inv.held.label; this.nameTimer = 2.2; }
      this.lastSel = inv.selected;
    }
    this.nameTimer -= dt;
    this.name.style.opacity = String(Math.max(0, Math.min(1, this.nameTimer)));
    this.actionTimer -= dt;
    this.actionbar.style.opacity = String(Math.max(0, Math.min(1, this.actionTimer)));
    this.el.classList.toggle('creative', !survival);
    if (!survival) return;
    // vida
    if (p.health < this.lastHealth) this.flash = 0.6;
    this.lastHealth = p.health;
    this.flash = Math.max(0, this.flash - dt);
    const poisoned = p.hasEffect('poison');
    const hp = Math.ceil(p.health);
    const low = p.health <= 4;
    const hs = this.hearts.children;
    for (let i = 0; i < 10; i++) {
      const el = hs[i] as HTMLElement;
      const v = hp - i * 2;
      const kind = poisoned ? 'poison' : 'heart';
      const img = v >= 2 ? this.icons[kind] : v === 1 ? this.icons[`${kind}Half`] : this.icons.heartEmpty;
      el.style.backgroundImage = `url(${img})`;
      const jitter = low ? Math.round(Math.sin(this.t * 40 + i * 7) * 1.5) : 0;
      el.style.transform = `translateY(${jitter}px)`;
      el.classList.toggle('blink', this.flash > 0 && Math.floor(this.flash * 10) % 2 === 0);
    }
    // absorção (corações dourados sobre os normais)
    // fome
    const f = p.food.foodLevel;
    const hungry = p.hasEffect('hunger');
    const fs = this.food.children;
    for (let i = 0; i < 10; i++) {
      const el = fs[i] as HTMLElement;
      const v = f - i * 2;
      const kind = hungry ? 'hunger' : 'food';
      const img = v >= 2 ? this.icons[kind] : v === 1 ? this.icons[`${kind}Half`] : this.icons.foodEmpty;
      el.style.backgroundImage = `url(${img})`;
      const shake = p.food.saturation <= 0 && Math.sin(this.t * 25 + i * 3) > 0.7 ? -1 : 0;
      el.style.transform = `translateY(${shake}px)`;
    }
    // armadura
    const av = p.armorValue;
    this.armor.style.visibility = av > 0 ? 'visible' : 'hidden';
    const as = this.armor.children;
    for (let i = 0; i < 10; i++) {
      const v = av - i * 2;
      (as[i] as HTMLElement).style.backgroundImage = `url(${v >= 2 ? this.icons.armor : v === 1 ? this.icons.armorHalf : this.icons.armorEmpty})`;
    }
    // ar
    const showAir = p.eyeInWater || p.airSupply < p.maxAirSupply;
    this.air.style.visibility = showAir ? 'visible' : 'hidden';
    const bubbles = Math.ceil((p.airSupply - 2) * 10 / p.maxAirSupply);
    const ai = this.air.children;
    for (let i = 0; i < 10; i++) {
      (ai[9 - i] as HTMLElement).style.backgroundImage = i < bubbles ? `url(${this.icons.bubble})` : 'none';
    }
    // experiência
    this.xpFill.style.width = `${Math.max(0, Math.min(1, p.xpProgress)) * 100}%`;
    this.xpLevel.textContent = p.xpLevel > 0 ? String(p.xpLevel) : '';
  }
}
