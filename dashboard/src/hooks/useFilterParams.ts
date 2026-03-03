import { useCallback } from 'react';
import { useSearchParams } from 'react-router';

type FilterConfig = Record<string, string>;

export function useFilterParams<T extends FilterConfig>(defaults: T) {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = {} as T;
  for (const key in defaults) {
    (filters as FilterConfig)[key] = searchParams.get(key) || defaults[key];
  }

  const setFilter = useCallback(
    (key: keyof T & string, value: string) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (value === defaults[key]) {
            next.delete(key);
          } else {
            next.set(key, value);
          }
          return next;
        },
        { replace: key === 'q' }
      );
    },
    [setSearchParams, defaults]
  );

  const clearFilters = useCallback(() => {
    setSearchParams({}, { replace: true });
  }, [setSearchParams]);

  return [filters, setFilter, clearFilters] as const;
}
