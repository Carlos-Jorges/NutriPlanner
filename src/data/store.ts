// The document store interface every feature talks to.
//
// Two implementations exist:
//   firebase-store.ts  Cloud Firestore (the real app)
//   memory-store.ts    in memory, for demo mode and tests
//
// Services are written once against this interface, so demo mode runs the
// exact same business logic as production. Only this thin layer differs.

import type { AppError } from '@/core/errors';

export type DocData = Record<string, unknown>;
export type WithId<T> = T & { id: string };
export type Unsubscribe = () => void;
export type WhereOp = '==' | '>=' | '<=';
export type WhereClause = [field: string, op: WhereOp, value: unknown];

export type WriteOp =
  | { type: 'set'; path: string; data: DocData; merge?: boolean }
  | { type: 'update'; path: string; data: DocData }
  | { type: 'delete'; path: string };

export interface Transaction {
  get<T>(path: string): Promise<WithId<T> | null>;
  set(path: string, data: DocData): void;
  update(path: string, data: DocData): void;
  delete(path: string): void;
}

export interface Store {
  readonly kind: 'firebase' | 'memory';
  /** A fresh document ID for a collection, created on the device. */
  newId(collectionPath: string): string;
  getDoc<T>(path: string): Promise<WithId<T> | null>;
  onDoc<T>(path: string, next: (doc: WithId<T> | null) => void, onError: (error: AppError) => void): Unsubscribe;
  onCollection<T>(
    path: string,
    where: readonly WhereClause[],
    next: (docs: WithId<T>[]) => void,
    onError: (error: AppError) => void,
  ): Unsubscribe;
  set(path: string, data: DocData, options?: { merge?: boolean }): Promise<void>;
  update(path: string, data: DocData): Promise<void>;
  remove(path: string): Promise<void>;
  /** All or nothing. */
  batch(ops: readonly WriteOp[]): Promise<void>;
  /** Reads then writes; retried automatically by Firestore on conflicts. */
  transaction<R>(run: (tx: Transaction) => Promise<R>): Promise<R>;
  arrayUnion(...values: unknown[]): unknown;
  arrayRemove(...values: unknown[]): unknown;
}

/** Path helpers, so collection names live in one place. */
export const paths = {
  user: (uid: string) => `users/${uid}`,
  invite: (code: string) => `invites/${code}`,
  groups: () => 'groups',
  group: (groupId: string) => `groups/${groupId}`,
  members: (groupId: string) => `groups/${groupId}/members`,
  member: (groupId: string, uid: string) => `groups/${groupId}/members/${uid}`,
  fridges: (groupId: string) => `groups/${groupId}/fridges`,
  fridge: (groupId: string, id: string) => `groups/${groupId}/fridges/${id}`,
  items: (groupId: string) => `groups/${groupId}/items`,
  item: (groupId: string, id: string) => `groups/${groupId}/items/${id}`,
  consumptions: (groupId: string) => `groups/${groupId}/consumptions`,
  consumption: (groupId: string, id: string) => `groups/${groupId}/consumptions/${id}`,
  shopping: (groupId: string) => `groups/${groupId}/shopping`,
  shoppingItem: (groupId: string, id: string) => `groups/${groupId}/shopping/${id}`,
  recipes: (groupId: string) => `groups/${groupId}/recipes`,
  recipe: (groupId: string, id: string) => `groups/${groupId}/recipes/${id}`,
  meals: (groupId: string) => `groups/${groupId}/meals`,
  meal: (groupId: string, id: string) => `groups/${groupId}/meals/${id}`,
};
