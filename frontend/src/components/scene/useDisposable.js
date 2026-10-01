import { useEffect } from "react";

/**
 * Dispose GPU resources on a *real* unmount only. React StrictMode (dev) runs
 * effect cleanups once on mount; disposing there would delete shader programs
 * while three is still compiling them. The deferred dispose is cancelled by the
 * immediate re-run.
 */
export function useDisposable(target, dispose) {
  useEffect(() => {
    if (!target) return undefined;
    clearTimeout(target.__disposeTimer);
    return () => {
      target.__disposeTimer = setTimeout(() => dispose(target), 0);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);
}

export const disposeIt = (o) => o.dispose();
