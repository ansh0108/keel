export const c = {
  // Backgrounds — near-black layered like Preznt
  bg:          '#08080a',
  bg1:         '#0e0e12',
  bg2:         '#141418',
  bg3:         '#1c1c22',
  bg4:         '#242430',

  // Surfaces (aliased for existing code)
  surface:     '#0e0e12',
  card:        '#141418',
  cardHover:   '#1c1c22',

  // Borders
  border:      'rgba(255,255,255,0.07)',
  borderLight: 'rgba(255,255,255,0.04)',
  borderHover: 'rgba(129,140,248,0.25)',

  // Text
  text:        '#ededef',
  textSub:     '#b4b4bc',
  textMuted:   '#6c6c7c',

  // Accents
  accent:      '#818cf8',  // indigo
  accentDim:   'rgba(129,140,248,0.10)',
  accentBorder:'rgba(129,140,248,0.22)',
  rose:        '#f472b6',
  roseDim:     'rgba(244,114,182,0.10)',
  teal:        '#2dd4bf',
  tealDim:     'rgba(45,212,191,0.10)',

  // Semantic
  error:       '#f87171',
  errorDim:    'rgba(248,113,113,0.10)',
  errorBorder: 'rgba(248,113,113,0.22)',
  warning:     '#fbbf24',
  warningDim:  'rgba(251,191,36,0.10)',
  warningBorder:'rgba(251,191,36,0.22)',
  success:     '#4ade80',
  successDim:  'rgba(74,222,128,0.10)',
  successBorder:'rgba(74,222,128,0.22)',

  // Typography
  fontSans:    "'Plus Jakarta Sans', system-ui, sans-serif",
  fontSerif:   "'Playfair Display', Georgia, serif",
  fontMono:    "'JetBrains Mono', monospace",
}

export function scoreColor(score: number | null): string {
  if (score === null) return c.textMuted
  if (score >= 90) return c.success
  if (score >= 75) return c.warning
  return c.error
}

export function severityColor(sev: 'error' | 'warning'): string {
  return sev === 'error' ? c.error : c.warning
}

export const globalStyles = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  html { scroll-behavior: smooth; }

  body {
    background: ${c.bg};
    color: ${c.text};
    font-family: ${c.fontSans};
    -webkit-font-smoothing: antialiased;
    min-height: 100vh;
    overflow: hidden;
  }

  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: ${c.bg4}; border-radius: 4px; }
  ::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.15); }

  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(14px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes fadeIn {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes glow-pulse {
    0%, 100% { box-shadow: 0 0 0 0 rgba(129,140,248,0); }
    50%       { box-shadow: 0 0 0 5px rgba(129,140,248,0.15); }
  }
  @keyframes dot-ping {
    0%   { transform: scale(1); opacity: 1; }
    70%  { transform: scale(2.4); opacity: 0; }
    100% { transform: scale(2.4); opacity: 0; }
  }

  .card-hover {
    transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
  }
  .card-hover:hover {
    transform: translateY(-3px);
    box-shadow: 0 12px 40px rgba(0,0,0,0.4);
    border-color: rgba(129,140,248,0.25) !important;
  }

  .fade-up { animation: fadeUp 0.28s ease both; }
  .fade-in { animation: fadeIn 0.22s ease both; }
`
