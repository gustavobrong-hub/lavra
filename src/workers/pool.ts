/**
 * Pool de workers com fila de prioridade (menor número = mais urgente) e cancelamento.
 */
import type { GenRequest, GenResult, MeshRequest, MeshResult, WorkerResult } from './protocol';

type Req = Omit<GenRequest, 'id'> | Omit<MeshRequest, 'id'>;
type Res<R> = R extends { type: 'gen' } ? GenResult : MeshResult;

interface Job {
  id: number;
  req: Req;
  priority: number;
  transfer: Transferable[];
  resolve: (r: GenResult | MeshResult) => void;
  reject: (e: Error) => void;
  cancelled: boolean;
}

export class WorkerPool {
  private readonly workers: Worker[] = [];
  private readonly busy: (Job | null)[] = [];
  private readonly queue: Job[] = [];
  private nextId = 1;
  private dirtyQueue = false;
  /** estatísticas */
  genMs = 0;
  genCount = 0;
  meshMs = 0;
  meshCount = 0;

  constructor(size: number) {
    for (let i = 0; i < size; i++) {
      const w = new Worker(new URL('./world.worker.ts', import.meta.url), { type: 'module', name: `lavra-worker-${i}` });
      w.onmessage = (ev: MessageEvent<WorkerResult>) => this.onResult(i, ev.data);
      w.onerror = (ev) => console.error('Erro no worker', ev.message);
      this.workers.push(w);
      this.busy.push(null);
    }
  }

  get size(): number { return this.workers.length; }
  get pending(): number { return this.queue.length; }
  get running(): number { return this.busy.filter(Boolean).length; }

  submit<R extends Req>(req: R, priority: number, transfer: Transferable[] = []): { promise: Promise<Res<R>>; cancel: () => void; setPriority: (p: number) => void } {
    let job!: Job;
    const promise = new Promise<Res<R>>((resolve, reject) => {
      job = { id: this.nextId++, req, priority, transfer, resolve: resolve as (r: GenResult | MeshResult) => void, reject, cancelled: false };
    });
    this.queue.push(job);
    this.dirtyQueue = true;
    this.pump();
    return {
      promise,
      cancel: () => { job.cancelled = true; },
      setPriority: (p: number) => { job.priority = p; this.dirtyQueue = true; },
    };
  }

  private pump(): void {
    for (let i = 0; i < this.workers.length; i++) {
      if (this.busy[i]) continue;
      const job = this.take();
      if (!job) return;
      this.busy[i] = job;
      this.workers[i].postMessage({ ...job.req, id: job.id }, job.transfer);
    }
  }

  private take(): Job | undefined {
    if (this.dirtyQueue) {
      this.queue.sort((a, b) => b.priority - a.priority);
      this.dirtyQueue = false;
    }
    while (this.queue.length) {
      const j = this.queue.pop()!;
      if (!j.cancelled) return j;
      j.reject(new Error('cancelado'));
    }
    return undefined;
  }

  private onResult(i: number, res: WorkerResult): void {
    const job = this.busy[i];
    this.busy[i] = null;
    if (job) {
      if (res.type === 'error') {
        console.error('Falha no worker:', res.message);
        job.reject(new Error(res.message));
      } else {
        if (res.type === 'gen') { this.genMs += res.ms; this.genCount++; } else { this.meshMs += res.ms; this.meshCount++; }
        job.resolve(res);
      }
    }
    this.pump();
  }

  /** Reordena a fila (ex.: quando o jogador anda). */
  reprioritize(fn: (req: Req) => number | null): void {
    for (const j of this.queue) {
      const p = fn(j.req);
      if (p === null) j.cancelled = true;
      else j.priority = p;
    }
    this.dirtyQueue = true;
  }

  dispose(): void {
    for (const w of this.workers) w.terminate();
    this.workers.length = 0;
  }
}
