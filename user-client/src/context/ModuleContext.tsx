'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { getModuleTheme, ModuleThemeConfig } from '@/lib/modules';
import { ModuleSelection } from '@/lib/types';

interface ModuleContextValue {
  activeModule: ModuleSelection;
  setActiveModule: (mod: ModuleSelection) => void;
  theme: ModuleThemeConfig;
  colorMode: 'light' | 'dark';
  toggleColorMode: () => void;
}

const ModuleContext = createContext<ModuleContextValue | null>(null);

export function ModuleProvider({ children }: { children: React.ReactNode }) {
  const [activeModule, setActiveModule] = useState<ModuleSelection>('all');
  const [colorMode, setColorMode] = useState<'light' | 'dark'>('light');
  const theme = getModuleTheme(activeModule);

  useEffect(() => {
    const saved = localStorage.getItem('vankinh_theme');
    if (saved === 'dark' || saved === 'light') {
      setColorMode(saved);
    } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setColorMode('dark');
    }
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.mod = activeModule;
    root.dataset.theme = colorMode;
    root.style.setProperty('--m', theme.c1);
    root.style.setProperty('--m2', theme.c2);
    root.style.setProperty('--hero', theme.grad);
  }, [activeModule, colorMode, theme]);

  const toggleColorMode = () => {
    setColorMode((prev) => {
      const next = prev === 'light' ? 'dark' : 'light';
      localStorage.setItem('vankinh_theme', next);
      return next;
    });
  };

  return (
    <ModuleContext.Provider
      value={{ activeModule, setActiveModule, theme, colorMode, toggleColorMode }}
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
