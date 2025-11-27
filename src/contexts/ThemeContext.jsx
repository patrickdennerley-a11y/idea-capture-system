import { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};

// Theme definitions with CSS variable mappings
const THEMES = {
  'dark-purple': {
    name: 'Dark Purple',
    description: 'Dark background with purple accent (default)',
    variables: {
      '--bg-primary': '#050508',
      '--bg-secondary': '#0a0a0f',
      '--bg-card': '#0a0a0f',
      '--text-primary': '#f3f4f6',
      '--text-secondary': '#9ca3af',
      '--border': '#374151',
      '--accent': '#a855f7',
      '--accent-hover': '#9333ea',
    }
  },
  'light-purple': {
    name: 'Light Purple',
    description: 'Light background with purple accent',
    variables: {
      '--bg-primary': '#ffffff',
      '--bg-secondary': '#f9fafb',
      '--bg-card': '#ffffff',
      '--text-primary': '#111827',
      '--text-secondary': '#6b7280',
      '--border': '#e5e7eb',
      '--accent': '#a855f7',
      '--accent-hover': '#9333ea',
    }
  },
  'light-mono': {
    name: 'Light Monochrome',
    description: 'Light background with black/gray accent',
    variables: {
      '--bg-primary': '#ffffff',
      '--bg-secondary': '#f9fafb',
      '--bg-card': '#ffffff',
      '--text-primary': '#111827',
      '--text-secondary': '#6b7280',
      '--border': '#e5e7eb',
      '--accent': '#374151',
      '--accent-hover': '#1f2937',
    }
  }
};

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(() => {
    // Load theme from localStorage or default to 'dark-purple'
    return localStorage.getItem('neural-theme') || 'dark-purple';
  });

  useEffect(() => {
    // Apply theme by setting CSS variables on document.documentElement
    const themeConfig = THEMES[theme];
    if (themeConfig) {
      Object.entries(themeConfig.variables).forEach(([key, value]) => {
        document.documentElement.style.setProperty(key, value);
      });
    }

    // Persist theme to localStorage
    localStorage.setItem('neural-theme', theme);
  }, [theme]);

  const value = {
    theme,
    setTheme,
    themes: THEMES,
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};
