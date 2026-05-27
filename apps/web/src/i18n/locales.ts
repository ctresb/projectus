import ptBR from './pt_BR.json'

export type Locale = 'pt-BR'
export const DEFAULT_LOCALE: Locale = 'pt-BR'

export type Dictionary = { [key: string]: string | Dictionary }

export const LOCALES: Record<Locale, { label: string; dict: Dictionary }> = {
  'pt-BR': { label: 'Português (Brasil)', dict: ptBR as Dictionary },
}
