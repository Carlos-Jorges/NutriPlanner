import { useState } from 'react';

import { errorMessage } from '@/core/errors';

/** Runs an async action with a busy flag and a user facing error message. */
export function useAction() {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (key: string, work: () => Promise<void>): Promise<boolean> => {
    setBusy(key);
    setError(null);
    try {
      await work();
      return true;
    } catch (e) {
      setError(errorMessage(e));
      return false;
    } finally {
      setBusy(null);
    }
  };

  return { busy, error, setError, run };
}
