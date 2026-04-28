import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // All colors use CSS custom properties so themes can swap them at runtime.
        // CSS vars hold space-separated RGB triplets so Tailwind's opacity modifier
        // syntax (e.g. bg-accent/30) works correctly.
        bg: {
          primary:   'rgb(var(--c-bg-primary)   / <alpha-value>)',
          secondary: 'rgb(var(--c-bg-secondary) / <alpha-value>)',
          tertiary:  'rgb(var(--c-bg-tertiary)  / <alpha-value>)',
          hover:     'rgb(var(--c-bg-hover)     / <alpha-value>)',
          active:    'rgb(var(--c-bg-active)    / <alpha-value>)',
        },
        border: {
          DEFAULT: 'rgb(var(--c-border)       / <alpha-value>)',
          light:   'rgb(var(--c-border-light) / <alpha-value>)',
        },
        text: {
          primary:   'rgb(var(--c-text-primary)   / <alpha-value>)',
          secondary: 'rgb(var(--c-text-secondary) / <alpha-value>)',
          muted:     'rgb(var(--c-text-muted)     / <alpha-value>)',
        },
        status: {
          up:                'rgb(var(--c-status-up)              / <alpha-value>)',
          'up-bg':           'rgb(var(--c-status-up-bg)           / <alpha-value>)',
          down:              'rgb(var(--c-status-down)            / <alpha-value>)',
          'down-bg':         'rgb(var(--c-status-down-bg)         / <alpha-value>)',
          pending:           'rgb(var(--c-status-pending)         / <alpha-value>)',
          'pending-bg':      'rgb(var(--c-status-pending-bg)      / <alpha-value>)',
          maintenance:       'rgb(var(--c-status-maintenance)     / <alpha-value>)',
          'maintenance-bg':  'rgb(var(--c-status-maintenance-bg)  / <alpha-value>)',
          paused:            'rgb(var(--c-status-paused)          / <alpha-value>)',
          'paused-bg':       'rgb(var(--c-status-paused-bg)       / <alpha-value>)',
          'ssl-warning':     'rgb(var(--c-status-ssl-warning)     / <alpha-value>)',
          'ssl-warning-bg':  'rgb(var(--c-status-ssl-warning-bg)  / <alpha-value>)',
          'ssl-expired':     'rgb(var(--c-status-ssl-expired)     / <alpha-value>)',
          'ssl-expired-bg':  'rgb(var(--c-status-ssl-expired-bg)  / <alpha-value>)',
        },
        accent: {
          DEFAULT: 'rgb(var(--c-accent)       / <alpha-value>)',
          hover:   'rgb(var(--c-accent-hover) / <alpha-value>)',
          dark:    'rgb(var(--c-accent-dark)  / <alpha-value>)',
        },
        // Alias used by enrollment wizard and interactive components
        primary: 'rgb(var(--c-primary) / <alpha-value>)',
        // Obli Suite brand palette — used by the topbar app switcher
        // and the per-app active-pill highlight. Values fixed per
        // docs/obli-design-system.md §1; not theme-swappable so the
        // dot colours stay recognisable across every theme.
        obli: {
          view:   '#2bc4bd',
          view2:  '#5fd9d3',
          guard:  '#f5a623',
          map:    '#1edd8a',
          ance:   '#e03a3a',
          hub:    '#2d4ec9',
        },
      },
      fontFamily: {
        // Obli Design v1 (§11) — Rajdhani is a CONDENSED display font; great
        // at 24+px (page titles, hero KPIs) but blurry at 12-13px body sizes.
        //   font-sans     → Inter for body, nav, table rows
        //   font-display  → Rajdhani for headings + hero values (opt-in)
        //   font-mono     → JetBrains Mono for IDs / counts / timestamps
        sans: [
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Noto Sans',
          'Helvetica',
          'Arial',
          'sans-serif',
        ],
        display: [
          'Rajdhani',
          'Inter',
          '-apple-system',
          'Segoe UI',
          'sans-serif',
        ],
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 0 0 rgba(255,255,255,0.03), 0 6px 24px -8px rgba(0,0,0,0.45)',
        glow: '0 0 0 1px rgba(43,196,189,0.18) inset, 0 6px 28px -10px rgba(43,196,189,0.25)',
      },
    },
  },
  plugins: [],
} satisfies Config;
