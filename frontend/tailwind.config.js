/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['selector', '[data-theme="night"]'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      // Tudo aponta para os tokens: nenhum hex solto nos componentes.
      colors: {
        stage: 'var(--stage)',
        case: 'var(--case)',
        'case-lifted': 'var(--case-lifted)',
        rule: 'var(--rule)',
        'rule-strong': 'var(--rule-strong)',
        ink: 'var(--ink)',
        'ink-soft': 'var(--ink-soft)',
        'ink-faint': 'var(--ink-faint)',
        felt: 'var(--felt)',
        'felt-glow': 'var(--felt-glow)',
        brass: 'var(--brass)',
        'brass-bright': 'var(--brass-bright)',
        'hand-right': 'var(--hand-right)',
        'hand-left': 'var(--hand-left)',
        'tint-brass': 'var(--tint-brass)',
        'tint-brass-strong': 'var(--tint-brass-strong)',
        'tint-felt': 'var(--tint-felt)',
        'tint-ink': 'var(--tint-ink)',
      },
      fontFamily: {
        display: ["'Fraunces Variable'", 'Georgia', 'serif'],
        sans: ["'IBM Plex Sans'", 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ["'IBM Plex Mono'", 'ui-monospace', 'monospace'],
      },
      borderRadius: { DEFAULT: '4px', md: '6px' },
    },
  },
  plugins: [],
}
