import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react'
import { DEFAULT_LOCALE, LOCALES, type Dictionary, type Locale } from './locales'
import { isDefaultColumnTitle } from './columns'
import { useRegistry } from '../plugins/registry/useRegistry'

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

/// Deep-merge `overlay` onto `base`, returning a new dictionary. Plugin strings
/// (the overlay) win on leaf collisions; nested maps merge recursively. Used to
/// layer registry-contributed dictionaries on top of the core JSON so a plugin
/// ships its own namespaced strings (e.g. the Notes feature's `notes.*`, nav
/// label and search labels) without core hard-coding them.
function mergeDictionaries(base: Dictionary, overlay: Dictionary): Dictionary {
  const out: Dictionary = { ...base }
  for (const [key, value] of Object.entries(overlay)) {
    const existing = out[key]
    if (
      typeof existing === 'object' &&
      existing !== null &&
      typeof value === 'object' &&
      value !== null
    ) {
      out[key] = mergeDictionaries(existing, value)
    } else {
      out[key] = value
    }
  }
  return out
}

function interpolate(template: string, vars?: Vars): string {
  if (!vars) return template
  return template.replace(/\{(\w+)\}/g, (_, key) =>
    key in vars ? String(vars[key]) : `{${key}}`,
  )
}

export function I18nProvider({ locale, children }: { locale?: string; children: ReactNode }) {
  const resolved: Locale = locale && locale in LOCALES ? (locale as Locale) : DEFAULT_LOCALE
  // Subscribe to the registry so the dictionary re-overlays whenever a plugin is
  // enabled/disabled (its i18n contribution appears/disappears live).
  const { i18nDictionaries } = useRegistry()
  // Core JSON is the base; each active plugin's dictionary for the resolved
  // locale is layered on top (plugins ship their own strings). Re-derives only
  // when the locale or the set of i18n contributions changes.
  const dict = useMemo<Dictionary>(() => {
    let merged = LOCALES[resolved].dict
    for (const contribution of i18nDictionaries) {
      const overlay = contribution.dictionaries[resolved]
      if (overlay) merged = mergeDictionaries(merged, overlay)
    }
    return merged
  }, [resolved, i18nDictionaries])
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
