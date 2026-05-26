import type { ColorChoice } from './types'

export const FALLBACK_COLOR = '#55B9F7'

export function randomPaletteColor(cores: ColorChoice[], fallback = FALLBACK_COLOR): string {
  if (cores.length === 0) return fallback
  const index = Math.floor(Math.random() * cores.length)
  return cores[index].valor
}
