/** Tela de depuração (F3): FPS, coordenadas, bioma, chunk, luz, filas de carregamento e GPU. */
export interface DebugInfo {
  lines: () => string[];
  right: () => string[];
}

export class DebugOverlay {
  readonly el: HTMLDivElement;
  private readonly left: HTMLDivElement;
  private readonly rightEl: HTMLDivElement;
  visible = false;
  private last = 0;

  constructor(parent: HTMLElement, private readonly info: DebugInfo) {
    this.el = document.createElement('div');
    this.el.className = 'debug';
    this.left = document.createElement('div');
    this.left.className = 'debug-left';
    this.rightEl = document.createElement('div');
    this.rightEl.className = 'debug-right';
    this.el.append(this.left, this.rightEl);
    this.el.style.display = 'none';
    parent.appendChild(this.el);
  }

  toggle(): void {
    this.visible = !this.visible;
    this.el.style.display = this.visible ? '' : 'none';
  }

  update(now: number): void {
    if (!this.visible || now - this.last < 200) return;
    this.last = now;
    this.left.innerHTML = this.info.lines().map((l) => `<span>${l}</span>`).join('');
    this.rightEl.innerHTML = this.info.right().map((l) => `<span>${l}</span>`).join('');
  }
}
