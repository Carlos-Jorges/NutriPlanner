// Cloud Firestore implementation of the Store interface.
// This is the only file that imports the Firestore SDK.

import {
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  type DocumentSnapshot,
  type Firestore,
  getDoc,
  onSnapshot,
  query,
  runTransaction,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';

import { toAppError } from '@/core/errors';
import type { DocData, Store, WithId } from './store';

function withId<T>(snap: DocumentSnapshot): WithId<T> | null {
  return snap.exists() ? ({ id: snap.id, ...(snap.data() as T) } as WithId<T>) : null;
}

async function guard<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    throw toAppError(error);
  }
}

export function createFirebaseStore(db: Firestore): Store {
  return {
    kind: 'firebase',

    newId: (collectionPath) => doc(collection(db, collectionPath)).id,

    getDoc: <T>(path: string) => guard(async () => withId<T>(await getDoc(doc(db, path)))),

    onDoc: (path, next, onError) =>
      onSnapshot(
        doc(db, path),
        (snap) => next(withId(snap)),
        (error) => onError(toAppError(error)),
      ),

    onCollection: (path, clauses, next, onError) =>
      onSnapshot(
        query(collection(db, path), ...clauses.map(([field, op, value]) => where(field, op, value))),
        (snap) => next(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as never)),
        (error) => onError(toAppError(error)),
      ),

    set: (path, data, options) => guard(() => setDoc(doc(db, path), data, { merge: options?.merge ?? false })),

    update: (path, data) => guard(() => updateDoc(doc(db, path), data)),

    remove: (path) => guard(() => deleteDoc(doc(db, path))),

    batch: (ops) =>
      guard(async () => {
        const batch = writeBatch(db);
        for (const op of ops) {
          const ref = doc(db, op.path);
          if (op.type === 'set') batch.set(ref, op.data, { merge: op.merge ?? false });
          else if (op.type === 'update') batch.update(ref, op.data);
          else batch.delete(ref);
        }
        await batch.commit();
      }),

    transaction: (run) =>
      guard(() =>
        runTransaction(db, (tx) =>
          run({
            get: async <T>(path: string) => withId<T>(await tx.get(doc(db, path))),
            set: (path: string, data: DocData) => {
              tx.set(doc(db, path), data);
            },
            update: (path: string, data: DocData) => {
              tx.update(doc(db, path), data);
            },
            delete: (path: string) => {
              tx.delete(doc(db, path));
            },
          }),
        ),
      ),

    arrayUnion: (...values) => arrayUnion(...values),
    arrayRemove: (...values) => arrayRemove(...values),
  };
}
