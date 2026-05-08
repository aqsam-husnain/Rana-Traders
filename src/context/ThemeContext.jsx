import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState('dark');

  useEffect(() => {
    const loadTheme = async () => {
      try {
        const saved = await window.api?.getSetting('theme');
        if (saved) setTheme(saved);
      } catch (e) { /* ignore */ }
    };
    loadTheme();
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try { window.api?.setSetting('theme', theme); } catch (e) { /* ignore */ }
  }, [theme]);

  const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark');

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
