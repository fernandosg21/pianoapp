// O canvas não enxerga variáveis CSS: precisa dos valores resolvidos.
// Lemos do documento para que o piano roll siga o tema sem duplicar cores.

export interface Palette {
  stage: string
  rule: string
  felt: string
  feltGlow: string
  natural: string
  naturalLit: string
  sharp: string
  sharpLit: string
  handRight: string
  handLeft: string
  inkFaint: string
}

const TOKENS: Record<keyof Palette, string> = {
  stage: '--stage',
  rule: '--rule',
  felt: '--felt',
  feltGlow: '--felt-glow',
  natural: '--natural',
  naturalLit: '--natural-lit',
  sharp: '--sharp',
  sharpLit: '--sharp-lit',
  handRight: '--hand-right',
  handLeft: '--hand-left',
  inkFaint: '--ink-faint',
}

export function readPalette(): Palette {
  const styles = getComputedStyle(document.documentElement)
  const palette = {} as Palette
  for (const [key, token] of Object.entries(TOKENS)) {
    palette[key as keyof Palette] = styles.getPropertyValue(token).trim()
  }
  return palette
}
