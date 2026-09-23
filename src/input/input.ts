/**
 * Entrada de teclado e mouse com pointer lock. Guarda estado "pressionado" e eventos de borda
 * (apertou neste tick) para o loop fixo, e acumula o movimento do mouse por frame.
 */
export type ButtonName = string; // códigos de tecla (KeyW…) ou Mouse0/Mouse1/Mouse2

export class Input {
  private readonly down = new Set<ButtonName>();
  private readonly pressedQueue: ButtonName[] = [];
  private readonly releasedQueue: ButtonName[] = [];
  mouseDX = 0;
  mouseDY = 0;
  wheel = 0;
  locked = false;
  /** quando falso, o jogo ignora teclas (menus, chat) */
  enabled = true;
  onLockChange?: (locked: boolean) => void;
  onKeyDownRaw?: (e: KeyboardEvent) => boolean | void;
  /** injeção de entrada para testes automatizados */
  readonly synthetic = new Set<ButtonName>();

  constructor(private readonly canvas: HTMLCanvasElement) {
    window.addEventListener('keydown', (e) => {
      if (this.onKeyDownRaw?.(e) === true) return;
      if (!this.enabled) return;
      if (['Space', 'Tab', 'F1', 'F2', 'F3', 'F5', 'Slash', 'ControlLeft'].includes(e.code)) e.preventDefault();
      if (e.repeat) return;
      this.down.add(e.code);
      this.pressedQueue.push(e.code);
    });
    window.addEventListener('keyup', (e) => {
      this.down.delete(e.code);
      this.releasedQueue.push(e.code);
    });
    window.addEventListener('blur', () => this.releaseAll());
    canvas.addEventListener('mousedown', (e) => {
      if (!this.locked) return;
      const b = `Mouse${e.button}`;
      this.down.add(b);
      this.pressedQueue.push(b);
      e.preventDefault();
    });
    window.addEventListener('mouseup', (e) => {
      const b = `Mouse${e.button}`;
      this.down.delete(b);
      this.releasedQueue.push(b);
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.mouseDX += e.movementX;
      this.mouseDY += e.movementY;
    });
    canvas.addEventListener('wheel', (e) => {
      if (!this.locked) return;
      this.wheel += Math.sign(e.deltaY);
      e.preventDefault();
    }, { passive: false });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
      if (!this.locked) this.releaseAll();
      this.onLockChange?.(this.locked);
    });
  }

  requestLock(): void {
    if (this.locked) return;
    // o navegador pode recusar (sem gesto do usuário, janela sem foco): tenta sem "unadjustedMovement" e ignora a recusa
    const quiet = (r: unknown) => { const q = r as Promise<void> | undefined; if (q && typeof q.catch === 'function') q.catch(() => { /* recusado */ }); };
    try {
      const p = this.canvas.requestPointerLock({ unadjustedMovement: true } as never) as unknown as Promise<void> | undefined;
      if (p && typeof p.catch === 'function') p.catch(() => { try { quiet(this.canvas.requestPointerLock()); } catch { /* recusado */ } });
    } catch {
      try { quiet(this.canvas.requestPointerLock()); } catch { /* recusado */ }
    }
  }

  exitLock(): void {
    if (document.pointerLockElement) document.exitPointerLock();
  }

  isDown(b: ButtonName): boolean { return this.enabled && (this.down.has(b) || this.synthetic.has(b)); }

  /** Consome os eventos de "apertou" acumulados (chamado uma vez por tick). */
  takePressed(): ButtonName[] {
    const out = this.pressedQueue.slice();
    this.pressedQueue.length = 0;
    return out;
  }

  takeReleased(): ButtonName[] {
    const out = this.releasedQueue.slice();
    this.releasedQueue.length = 0;
    return out;
  }

  takeMouse(): [number, number] {
    const d: [number, number] = [this.mouseDX, this.mouseDY];
    this.mouseDX = 0; this.mouseDY = 0;
    return d;
  }

  takeWheel(): number { const w = this.wheel; this.wheel = 0; return w; }

  releaseAll(): void {
    for (const b of this.down) this.releasedQueue.push(b);
    this.down.clear();
  }

  /** para testes: simula apertar uma tecla */
  press(b: ButtonName): void { this.pressedQueue.push(b); this.synthetic.add(b); }
  private readonly taps = new Set<ButtonName>();
  /** para testes: aperta e solta dentro de exatamente um tick de jogo */
  tap(b: ButtonName): void { this.pressedQueue.push(b); this.synthetic.add(b); this.taps.add(b); }
  /** fim do tick: solta os toques de teste */
  endTick(): void {
    for (const b of this.taps) { this.synthetic.delete(b); this.releasedQueue.push(b); }
    this.taps.clear();
  }
  release(b: ButtonName): void { this.synthetic.delete(b); this.releasedQueue.push(b); }
}
