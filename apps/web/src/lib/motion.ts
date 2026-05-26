import tokens from '../styles/tokens.json'

const movimento = tokens.movimento

export const EASE = movimento.ease_arr as [number, number, number, number]
export const EASE_CSS = movimento.ease as string

export const DUR_FAST = movimento.duracao_rapida_s
export const DUR = movimento.duracao_padrao_s
export const DUR_SLOW = movimento.duracao_lenta_s

export const TRANSITION_FAST = { duration: DUR_FAST, ease: EASE } as const
export const TRANSITION_DEFAULT = { duration: DUR, ease: EASE } as const
export const TRANSITION_SLOW = { duration: DUR_SLOW, ease: EASE } as const
