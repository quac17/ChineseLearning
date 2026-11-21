'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { getModuleTheme, ModuleThemeConfig } from '@/lib/modules';
import { ModuleSelection } from '@/lib/types';

interface ModuleContextValue {
  /** Selected program, used to filter courses and practice decks. */
  activeModule: ModuleSelection;
  setActiveModule: (mod: ModuleSelection) => void;
  /** Program copy (name, Hanzi, description). No longer recolours the page. */
  theme: ModuleThemeConfig;
  colorMode: 'light' | 'dark';
  toggleColorMode: () => void;
}

const ModuleContext = createContext<ModuleContextValue | null>(null);

export function ModuleProvider({ children }: { children: React.ReactNode }) {
  const [activeModule, setActiveModule] = useState<ModuleSelection>('all');
  // null until we have read what the inline script in app/layout.tsx set before paint,
  // so the first render never overwrites the saved theme.
  const [mode, setMode] = useState<'light' | 'dark' | null>(null);
  const colorMode = mode ?? 'light';
  const theme = getModuleTheme(activeModule);

  useEffect(() => {
    setMode(document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');
  }, []);

  useEffect(() => {
    if (mode) document.documentElement.dataset.theme = mode;
  }, [mode]);

  const toggleColorMode = () => {
    setMode((prev) => {
      const next = (prev ?? 'light') === 'light' ? 'dark' : 'light';
      try {
        localStorage.setItem('vankinh_theme', next);
      } catch {
        // Private mode: the choice lasts for this visit only.
      }
      return next;
    });
  };

  return (
    <ModuleContext.Provider value={{ activeModule, setActiveModule, theme, colorMode, toggleColorMode }}>
      {children}
    </ModuleContext.Provider>
  );
}

export function useModule() {
  const ctx = useContext(ModuleContext);
  if (!ctx) throw new Error('useModule must be used inside ModuleProvider');
  return ctx;
}
