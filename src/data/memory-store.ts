// In memory implementation of the Store interface. Used for demo mode, so
// the app can be explored with sample data before Firebase is set up.
// Snapshots are delivered asynchronously, like Firestore, so screens behave
// the same way in both modes.

import { AppError } from '@/core/errors';
import type { DocData, Store, Transaction, Unsubscribe, WhereClause, WithId, WriteOp } from './store';

type Sentinel = { __sentinel: 'arrayUnion' | 'arrayRemove'; values: unknown[] };

const isSentinel = (value: unknown): value is Sentinel =>
  typeof value === 'object' && value !== null && '__sentinel' in value;

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const parentOf = (path: string) => path.split('/').slice(0, -1).join('/');
const idOf = (path: string) => path.split('/').pop() as string;

function applyFields(base: DocData | undefined, data: DocData): DocData {
  const next: DocData = { ...(base ?? {}) };
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) continue;
    if (isSentinel(value)) {
      const current = Array.isArray(next[key]) ? (next[key] as unknown[]) : [];
      next[key] =
        value.__sentinel === 'arrayUnion'
          ? [...current, ...value.values.filter((v) => !current.some((c) => same(c, v)))]
          : current.filter((c) => !value.values.some((v) => same(c, v)));
    } else {
      next[key] = clone(value);
    }
  }
  return next;
}

function matches(data: DocData, clauses: readonly WhereClause[]): boolean {
  return clauses.every(([field, op, value]) => {
    const actual = data[field] as string | number | boolean | null | undefined;
    if (op === '==') return actual === value;
    if (actual === undefined || actual === null) return false;
    return op === '>=' ? actual >= (value as typeof actual) : actual <= (value as typeof actual);
  });
}

export interface MemoryStore extends Store {
  snapshot(): Record<string, DocData>;
  restore(data: Record<string, DocData>): void;
  onAnyChange(listener: () => void): Unsubscribe;
}

interface Listener {
  read: () => unknown;
  next: (value: never) => void;
  last?: string;
}

export function createMemoryStore(initial: Record<string, DocData> = {}): MemoryStore {
  let docs = new Map<string, DocData>(Object.entries(clone(initial)));
  const listeners = new Set<Listener>();
  const changeListeners = new Set<() => void>();
  let flushQueued = false;
  let counter = 0;

  const readDoc = <T>(path: string): WithId<T> | null => {
    const data = docs.get(path);
    return data ? ({ id: idOf(path), ...clone(data) } as WithId<T>) : null;
  };

  const readCollection = <T>(path: string, clauses: readonly WhereClause[]): WithId<T>[] => {
    const out: WithId<T>[] = [];
    for (const [docPath, data] of docs) {
      if (parentOf(docPath) === path && matches(data, clauses)) {
        out.push({ id: idOf(docPath), ...clone(data) } as WithId<T>);
      }
    }
    return out;
  };

  const deliver = (listener: Listener) => {
    const value = listener.read();
    const key = JSON.stringify(value);
    if (key !== listener.last) {
      listener.last = key;
      listener.next(value as never);
    }
  };

  const flush = () => {
    if (flushQueued) return;
    flushQueued = true;
    setTimeout(() => {
      flushQueued = false;
      listeners.forEach(deliver);
      changeListeners.forEach((fn) => fn());
    }, 0);
  };

  const subscribe = (listener: Listener): Unsubscribe => {
    listeners.add(listener);
    setTimeout(() => {
      if (listeners.has(listener)) deliver(listener);
    }, 0);
    return () => {
      listeners.delete(listener);
    };
  };

  const apply = (ops: readonly WriteOp[]) => {
    const next = new Map(docs);
    for (const op of ops) {
      if (op.type === 'set') {
        next.set(op.path, applyFields(op.merge ? next.get(op.path) : undefined, op.data));
      } else if (op.type === 'update') {
        const current = next.get(op.path);
        if (!current) throw new AppError('not-found');
        next.set(op.path, applyFields(current, op.data));
      } else {
        next.delete(op.path);
      }
    }
    docs = next; // only replaced once every op succeeded: all or nothing
    flush();
  };

  return {
    kind: 'memory',

    newId: () => {
      counter += 1;
      return `${Date.now().toString(36)}${counter.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    },

    getDoc: async <T>(path: string) => readDoc<T>(path),

    onDoc: (path, next) => subscribe({ read: () => readDoc(path), next: next as Listener['next'] }),

    onCollection: (path, clauses, next) =>
      subscribe({ read: () => readCollection(path, clauses), next: next as Listener['next'] }),

    set: async (path, data, options) => apply([{ type: 'set', path, data, merge: options?.merge }]),
    update: async (path, data) => apply([{ type: 'update', path, data }]),
    remove: async (path) => apply([{ type: 'delete', path }]),
    batch: async (ops) => apply(ops),

    transaction: async (run) => {
      const ops: WriteOp[] = [];
      const tx: Transaction = {
        get: async <T>(path: string) => readDoc<T>(path),
        set: (path, data) => {
          ops.push({ type: 'set', path, data });
        },
        update: (path, data) => {
          ops.push({ type: 'update', path, data });
        },
        delete: (path) => {
          ops.push({ type: 'delete', path });
        },
      };
      const result = await run(tx);
      apply(ops);
      return result;
    },

    arrayUnion: (...values) => ({ __sentinel: 'arrayUnion', values }) satisfies Sentinel,
    arrayRemove: (...values) => ({ __sentinel: 'arrayRemove', values }) satisfies Sentinel,

    snapshot: () => Object.fromEntries([...docs].map(([path, data]) => [path, clone(data)])),

    restore: (data) => {
      docs = new Map(Object.entries(clone(data)));
      flush();
    },

    onAnyChange: (listener) => {
      changeListeners.add(listener);
      return () => {
        changeListeners.delete(listener);
      };
    },
  };
}
