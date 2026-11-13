import { fork, ChildProcess } from 'child_process';
import path from 'path';

const POOL_SIZE = 2;
const MAX_JOBS = 50;
const MAX_RSS = 1024 * 1024 * 1024;
const JOB_TIMEOUT_MS = 120_000;
// In standalone mode, server.js chdirs into the standalone root, so this
// resolves to `<root>/workers/...` both in dev and in the Docker image.
const WORKER_PATH = path.join(process.cwd(), 'workers/typst-worker.cjs');

export type WorkerRequest = {
  workingDir: string;
  mainFilePath: string;
  format: 'svg' | 'pdf';
  sync: boolean;
};
export type WorkerResult =
  | { ok: true; format: 'pdf'; pdf: Uint8Array; rss: number }
  | { ok: true; format: 'svg'; svg: string; syncRaw: unknown; rss: number }
  | { ok: false; diagnostics?: unknown; message?: string; rss: number };

type Pending = { resolve: (r: WorkerResult) => void; reject: (e: Error) => void };

// Kept on globalThis so dev-mode HMR reuses the same children instead of leaking them.
const state = ((globalThis as { __typstPool?: { nextId: number; pool: Slot[] } }).__typstPool ??= {
  nextId: 0,
  pool: [],
});

class Slot {
  child: ChildProcess;
  pending = new Map<number, Pending>();
  served = 0;
  retiring = false;

  // The path is passed as a parameter on purpose: when `fork()` receives a
  // statically known path, Turbopack tries to bundle the worker and the build
  // fails. The file ships as-is via outputFileTracingIncludes (next.config.ts).
  constructor(workerPath = WORKER_PATH) {
    this.child = fork(workerPath, [], {
      serialization: 'advanced',
      env: { ...process.env, MALLOC_ARENA_MAX: '2' },
    });

    this.child.on('message', (msg: { id: number; result: WorkerResult }) => {
      const p = this.pending.get(msg.id);
      if (!p) return;
      this.pending.delete(msg.id);
      this.served++;
      p.resolve(msg.result);

      if (!this.retiring && (this.served >= MAX_JOBS || msg.result.rss > MAX_RSS)) {
        this.retiring = true;
        replace(this);
      }
      if (this.retiring && this.pending.size === 0) this.child.kill('SIGKILL');
    });

    // Without a listener, a spawn/IPC error would crash the whole server.
    this.child.on('error', (err) => {
      console.error('Typst worker error:', err);
      this.fail(err);
      this.destroy();
    });

    this.child.on('exit', () => {
      this.fail(new Error('Typst worker exited'));
      // Removed rather than respawned: the pool refills lazily on the next
      // request, which avoids a fork loop if the worker crashes on startup.
      remove(this);
    });
  }

  fail(err: Error) {
    for (const p of this.pending.values()) p.reject(err);
    this.pending.clear();
  }

  /** Kills the child and takes the slot out of the pool right away, so no new
   * job is routed to it before its `exit` event fires. */
  destroy() {
    this.retiring = true;
    remove(this);
    this.child.kill('SIGKILL');
  }

  run(req: WorkerRequest) {
    return new Promise<WorkerResult>((resolve, reject) => {
      const id = state.nextId++;
      const timer = setTimeout(() => {
        if (!this.pending.has(id)) return;
        this.pending.delete(id);
        reject(new Error('Compilation timed out'));
        // The child is stuck in synchronous native code: only killing it frees it.
        this.destroy();
      }, JOB_TIMEOUT_MS);

      this.pending.set(id, {
        resolve: (r) => {
          clearTimeout(timer);
          resolve(r);
        },
        reject: (e) => {
          clearTimeout(timer);
          reject(e);
        },
      });
      this.child.send({ id, ...req }, (err) => {
        const p = this.pending.get(id);
        if (err && p) {
          this.pending.delete(id);
          p.reject(err);
        }
      });
    });
  }
}

function replace(old: Slot) {
  const i = state.pool.indexOf(old);
  if (i !== -1) state.pool[i] = new Slot();
}

function remove(old: Slot) {
  const i = state.pool.indexOf(old);
  if (i !== -1) state.pool.splice(i, 1);
}

export function runTypst(req: WorkerRequest) {
  const { pool } = state;
  while (pool.length < POOL_SIZE) pool.push(new Slot());
  const slot = pool.reduce((a, b) => (b.pending.size < a.pending.size ? b : a));
  return slot.run(req);
}
