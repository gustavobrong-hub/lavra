/** Gerenciador de telas (inventário, bancada, menus). Uma tela por vez, com pilha para voltar. */

export interface Screen {
  readonly el: HTMLElement;
  /** tela pausa o jogo (menus) ou não (inventário) */
  readonly pauses: boolean;
  /** libera o cursor do mouse */
  readonly freesMouse: boolean;
  onOpen?(): void;
  onClose?(): void;
  update?(dt: number): void;
  /** tecla pressionada; retorne true se tratou */
  onKey?(e: KeyboardEvent): boolean;
}

export class UIManager {
  private stack: Screen[] = [];
  onChange?: (s: Screen | null) => void;
  /** tecla extra que fecha telas de container (inventário) */
  closeKey = 'KeyE';

  constructor(readonly root: HTMLElement) {
    window.addEventListener('keydown', (e) => {
      const s = this.top;
      if (!s) return;
      if (s.onKey?.(e)) { e.preventDefault(); e.stopPropagation(); return; }
      if (e.code === 'Escape' || (e.code === this.closeKey && !s.pauses)) { e.preventDefault(); e.stopPropagation(); this.close(); }
    }, true);
  }

  get top(): Screen | null { return this.stack[this.stack.length - 1] ?? null; }
  get isOpen(): boolean { return this.stack.length > 0; }

  open(s: Screen, replace = false): void {
    if (replace) this.closeAll(false);
    const prev = this.top;
    if (prev) prev.el.style.display = 'none';
    this.stack.push(s);
    this.root.appendChild(s.el);
    s.onOpen?.();
    this.onChange?.(s);
  }

  close(): void {
    const s = this.stack.pop();
    if (!s) return;
    s.onClose?.();
    s.el.remove();
    const prev = this.top;
    if (prev) prev.el.style.display = '';
    this.onChange?.(prev);
  }

  closeAll(notify = true): void {
    while (this.stack.length) {
      const s = this.stack.pop()!;
      s.onClose?.();
      s.el.remove();
    }
    if (notify) this.onChange?.(null);
  }

  update(dt: number): void { this.top?.update?.(dt); }
}

/** Cria um elemento com classe e filhos. */
export function h<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', ...children: (Node | string | null | undefined)[]): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  for (const c of children) if (c !== null && c !== undefined) e.append(c);
  return e;
}
