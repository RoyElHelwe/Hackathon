'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark' | 'system';
interface Settings {
  theme: Theme;
  setTheme: (t: Theme) => void;
  sounds: boolean;
  setSounds: (v: boolean) => void;
}

const Ctx = createContext<Settings>({ theme: 'system', setTheme: () => {}, sounds: false, setSounds: () => {} });

function apply(theme: Theme) {
  const dark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('light');
  const [sounds, setSoundsState] = useState(false);

  useEffect(() => {
    const t = (localStorage.getItem('tj-theme') as Theme | null) ?? 'light';
    setThemeState(t);
    apply(t);
    setSoundsState(localStorage.getItem('tj-sounds') === 'on');
  }, []);

  const setTheme = useCallback((t: Theme) => {
    localStorage.setItem('tj-theme', t);
    setThemeState(t);
    apply(t);
  }, []);
  const setSounds = useCallback((v: boolean) => {
    localStorage.setItem('tj-sounds', v ? 'on' : 'off');
    setSoundsState(v);
  }, []);

  return <Ctx.Provider value={{ theme, setTheme, sounds, setSounds }}>{children}</Ctx.Provider>;
}

export const useSettings = () => useContext(Ctx);

/** Tiny synthesized sound effects (Web Audio, no assets). Off by default. */
export function useSound() {
  const { sounds } = useSettings();
  return useCallback(
    (kind: 'pop' | 'levelup' | 'coin') => {
      if (!sounds || typeof window === 'undefined') return;
      try {
        const ctx = new AudioContext();
        const notes = kind === 'levelup' ? [523, 659, 784, 1046] : kind === 'coin' ? [988, 1319] : [660];
        notes.forEach((f, i) => {
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.type = 'triangle';
          o.frequency.value = f;
          g.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.1);
          g.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + i * 0.1 + 0.02);
          g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.1 + 0.25);
          o.connect(g).connect(ctx.destination);
          o.start(ctx.currentTime + i * 0.1);
          o.stop(ctx.currentTime + i * 0.1 + 0.3);
        });
      } catch {
        /* audio not available */
      }
    },
    [sounds],
  );
}
