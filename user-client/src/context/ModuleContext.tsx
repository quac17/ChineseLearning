'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { apiRequest } from '@/lib/api';
import { getModuleTheme, ModuleThemeConfig } from '@/lib/modules';
import { DEFAULT_PROGRAM_ITEMS, getProgramMeta, ProgramDisplayMeta, PROGRAMS } from '@/lib/programs';
import { ModuleSelection, ProgramItem } from '@/lib/types';

/** What the learner picked: a fixed theme, or follow the device (the default). */
export type ThemePreference = 'light' | 'dark' | 'system';

/** Same key the inline script in app/layout.tsx reads before paint. */
const THEME_KEY = 'chinese_learner_theme';
const DARK_QUERY = '(prefers-color-scheme: dark)';

interface ModuleContextValue {
  /** Selected program, used to filter courses and practice decks. */
  activeModule: ModuleSelection;
  setActiveModule: (mod: ModuleSelection) => void;
  /** Program copy (name, Hanzi, description). No longer recolours the page. */
  theme: ModuleThemeConfig;
  /** The theme on screen now. */
  colorMode: 'light' | 'dark';
  /** Header button: switches to the opposite of what is on screen and pins it. */
  toggleColorMode: () => void;
  themePreference: ThemePreference;
  setThemePreference: (pref: ThemePreference) => void;
  /** Live list of programs loaded from /api/programs. */
  programs: ProgramItem[];
  programMap: Record<string, ProgramDisplayMeta>;
  refreshPrograms: () => Promise<void>;
}

const ModuleContext = createContext<ModuleContextValue | null>(null);

function readPreference(): ThemePreference {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    return saved === 'light' || saved === 'dark' ? saved : 'system';
  } catch {
    return 'system';
  }
}

function savePreference(pref: ThemePreference) {
  try {
    // "system" is stored as no value, which the inline script already treats as "follow the device".
    if (pref === 'system') localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, pref);
  } catch {
    // Private mode: the choice lasts for this visit only.
  }
}

export function ModuleProvider({ children }: { children: React.ReactNode }) {
  const [activeModule, setActiveModule] = useState<ModuleSelection>('all');
  // null until we have read what the inline script in app/layout.tsx set before paint,
  // so the first render never overwrites the saved theme.
  const [mode, setMode] = useState<'light' | 'dark' | null>(null);
  // null until read from localStorage, so the "follow the device" effect never runs on a guess.
  const [preference, setPreference] = useState<ThemePreference | null>(null);
  const [programs, setPrograms] = useState<ProgramItem[]>(DEFAULT_PROGRAM_ITEMS);
  const colorMode = mode ?? 'light';
  const theme = getModuleTheme(activeModule);

  const refreshPrograms = useCallback(async () => {
    try {
      const list = await apiRequest<ProgramItem[]>('/programs');
      if (Array.isArray(list) && list.length > 0) {
        setPrograms(list);
      }
    } catch {
      // Keep fallback DEFAULT_PROGRAM_ITEMS if API is unreachable during initial render.
    }
  }, []);

  useEffect(() => {
    setPreference(readPreference());
    setMode(document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');
    refreshPrograms();
  }, [refreshPrograms]);

  useEffect(() => {
    if (mode) document.documentElement.dataset.theme = mode;
  }, [mode]);

  // "Theo máy": follow the device, also when it changes while the page is open.
  useEffect(() => {
    if (preference !== 'system' || typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia(DARK_QUERY);
    const apply = () => setMode(query.matches ? 'dark' : 'light');
    apply();
    query.addEventListener('change', apply);
    return () => query.removeEventListener('change', apply);
  }, [preference]);

  const setThemePreference = (pref: ThemePreference) => {
    savePreference(pref);
    setPreference(pref);
    if (pref !== 'system') setMode(pref);
  };

  const toggleColorMode = () => setThemePreference(colorMode === 'light' ? 'dark' : 'light');

  const programMap = useMemo(() => {
    const map: Record<string, ProgramDisplayMeta> = {};
    for (const p of programs) {
      map[p.code] = {
        name: p.name,
        han: p.han,
        color: p.color1 || PROGRAMS[p.code]?.color || 'var(--prog-hsk)',
      };
    }
    return map;
  }, [programs]);

  return (
    <ModuleContext.Provider
      value={{
        activeModule,
        setActiveModule,
        theme,
        colorMode,
        toggleColorMode,
        themePreference: preference ?? 'system',
        setThemePreference,
        programs,
        programMap,
        refreshPrograms,
      }}
    >
      {children}
    </ModuleContext.Provider>
  );
}

export function useModule() {
  const ctx = useContext(ModuleContext);
  if (!ctx) throw new Error('useModule must be used inside ModuleProvider');
  return ctx;
}

export function usePrograms() {
  const { programs, programMap, refreshPrograms } = useModule();
  const programOrder = useMemo(() => programs.map((p) => p.code), [programs]);
  const getProgram = useCallback((code: string) => getProgramMeta(code, programMap), [programMap]);
  return { programs, programMap, programOrder, refreshPrograms, getProgram };
}
