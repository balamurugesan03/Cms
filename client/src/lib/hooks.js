import { useCallback, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { get, post, put, errMsg } from './api';

/** Fetch any GET endpoint with React Query */
export const useApi = (url, params, options = {}) =>
  useQuery({ queryKey: [url, params], queryFn: () => get(url, params), enabled: !!url, ...options });

/** POST an action endpoint, toast result and refresh everything */
export function useAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ url, body, method }) => (method === 'put' ? put(url, body) : post(url, body)),
    onSuccess: (_d, v) => {
      if (v.success !== false) toast.success(v.success || 'Done');
      qc.invalidateQueries();
    },
    onError: (e) => toast.error(errMsg(e)),
  });
}

export function useDebounce(value, delay = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

export function useLocalStorage(key, initial) {
  const [v, setV] = useState(() => {
    try {
      const s = localStorage.getItem(key);
      return s != null ? JSON.parse(s) : initial;
    } catch {
      return initial;
    }
  });
  const set = useCallback(
    (nv) => {
      setV(nv);
      try {
        localStorage.setItem(key, JSON.stringify(nv));
      } catch {
        /* ignore */
      }
    },
    [key],
  );
  return [v, set];
}

export function useTheme() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'));
  const toggle = () => {
    const next = !dark;
    document.documentElement.classList.toggle('dark', next);
    try {
      localStorage.setItem('theme', next ? 'dark' : 'light');
    } catch {
      /* ignore */
    }
    setDark(next);
  };
  return { dark, toggle };
}
