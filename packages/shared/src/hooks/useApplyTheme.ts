import { useEffect } from 'react';
import { useUiStore } from '../stores/ui-store';

/** Applies the chosen theme to `<html>`; "system" follows `prefers-color-scheme` live. */
export function useApplyTheme(): void {
  const theme = useUiStore((s) => s.theme);

  useEffect(() => {
    const root = document.documentElement;
    const apply = (mode: 'light' | 'dark') => {
      root.classList.remove('light', 'dark');
      root.classList.add(mode);
    };

    if (theme !== 'system') {
      apply(theme);
      return;
    }
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    apply(mq.matches ? 'dark' : 'light');
    const handler = (e: MediaQueryListEvent) => apply(e.matches ? 'dark' : 'light');
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme]);
}
