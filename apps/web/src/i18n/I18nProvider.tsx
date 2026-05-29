import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react'
import { DEFAULT_LOCALE, LOCALES, type Dictionary, type Locale } from './locales'
import { isDefaultColumnTitle } from './columns'

type Vars = Record<string, string | number>
export type TFn = (key: string, vars?: Vars) => string

type I18nCtx = { locale: Locale; t: TFn }

const Ctx = createContext<I18nCtx | null>(null)

function resolve(dict: Dictionary, key: string): string | undefined {
  const parts = key.split('.')
  let cur: string | Dictionary = dict
  for (const part of parts) {
    if (typeof cur === 'string') return undefined
    const next: string | Dictionary | undefined = cur[part]
    if (next === undefined) return undefined
    cur = next
  }
  return typeof cur === 'string' ? cur : undefined
}

function interpolate(template: string, vars?: Vars): string {
  if (!vars) return template
  return template.replace(/\{(\w+)\}/g, (_, key) => (key in vars ? String(vars[key]) : `{${key}}`))
}

export function I18nProvider({ locale, children }: { locale?: string; children: ReactNode }) {
  const resolved: Locale = locale && locale in LOCALES ? (locale as Locale) : DEFAULT_LOCALE
  const dict = LOCALES[resolved].dict
  const t = useCallback<TFn>(
    (key, vars) => {
      const raw = resolve(dict, key)
      if (raw === undefined) {
        if (import.meta.env.DEV) console.warn(`[i18n] missing key: ${key}`)
        return key
      }
      return interpolate(raw, vars)
    },
    [dict],
  )
  const value = useMemo(() => ({ locale: resolved, t }), [resolved, t])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useT(): TFn {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useT must be used within I18nProvider')
  return ctx.t
}

export function useLocale(): Locale {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useLocale must be used within I18nProvider')
  return ctx.locale
}

export function localizeColumnTitle(titulo: string, t: TFn): string {
  if (!isDefaultColumnTitle(titulo)) return titulo
  return t(`columns.default.${titulo}`)
}
