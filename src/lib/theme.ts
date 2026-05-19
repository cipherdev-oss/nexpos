
import React from 'react';

export const ACCENT_COLORS: Record<string, { base: string, hover: string, muted: string, border: string }> = {
  emerald: {
    base: '#10b981',
    hover: '#059669',
    muted: 'rgba(16, 185, 129, 0.15)',
    border: 'rgba(16, 185, 129, 0.3)'
  },
  indigo: {
    base: '#6366f1',
    hover: '#4f46e5',
    muted: 'rgba(99, 102, 241, 0.15)',
    border: 'rgba(99, 102, 241, 0.3)'
  },
  amber: {
    base: '#f59e0b',
    hover: '#d97706',
    muted: 'rgba(245, 158, 11, 0.15)',
    border: 'rgba(245, 158, 11, 0.3)'
  },
  rose: {
    base: '#f43f5e',
    hover: '#e11d48',
    muted: 'rgba(244, 63, 94, 0.15)',
    border: 'rgba(244, 63, 94, 0.3)'
  },
  sky: {
    base: '#0ea5e9',
    hover: '#0284c7',
    muted: 'rgba(14, 165, 233, 0.15)',
    border: 'rgba(14, 165, 233, 0.3)'
  },
  violet: {
    base: '#8b5cf6',
    hover: '#7c3aed',
    muted: 'rgba(139, 92, 246, 0.15)',
    border: 'rgba(139, 92, 246, 0.3)'
  }
};

export function getAccentStyles(colorName: string = 'sky') {
  const theme = ACCENT_COLORS[colorName] || ACCENT_COLORS.sky;
  return {
    '--accent-color': theme.base,
    '--accent-color-hover': theme.hover,
    '--accent-color-muted': theme.muted,
    '--accent-color-border': theme.border,
  } as React.CSSProperties;
}
