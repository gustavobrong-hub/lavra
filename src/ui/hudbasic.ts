/** HUD provisório (mira + barra rápida com nomes) — substituído pelo HUD completo no marco de inventário. */
import type { Player } from '../game/player/player';

export class BasicHud {
  readonly el: HTMLDivElement;
  private readonly hotbar: HTMLDivElement;
  private readonly name: HTMLDivElement;
  private lastVersion = -1;
  private nameTimer = 0;

  constructor(parent: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'hud';
    this.el.innerHTML = `<div class="crosshair"></div>`;
    this.hotbar = document.createElement('div');
    this.hotbar.className = 'hotbar';
    this.name = document.createElement('div');
    this.name.className = 'held-name';
    this.el.append(this.name, this.hotbar);
    parent.appendChild(this.el);
  }

  update(p: Player, dt: number): void {
    const inv = p.inventory;
    if (inv.version !== this.lastVersion) {
      const sel = inv.selected;
      if (this.lastVersion >= 0 && inv.held) { this.name.textContent = inv.held.label; this.nameTimer = 2; }
      this.lastVersion = inv.version;
      this.hotbar.innerHTML = inv.main.slice(0, 9).map((s, i) =>
        `<div class="slot${i === sel ? ' sel' : ''}">${s ? `<span class="lbl">${s.label}</span>${s.count > 1 ? `<b>${s.count}</b>` : ''}` : ''}</div>`).join('');
    }
    this.nameTimer -= dt;
    this.name.style.opacity = String(Math.max(0, Math.min(1, this.nameTimer)));
  }
}
