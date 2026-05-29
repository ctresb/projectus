import type { ComponentType, ReactNode } from 'react'
import { Archive, Blocks, CloudUpload, FolderKanban, Settings, SlidersHorizontal } from 'lucide-react'
import { motion } from 'motion/react'
import type { Config } from '../../lib/types'
import { SaveIndicator } from '../../components/SaveIndicator'
import { SnapshotButton } from '../../components/SnapshotButton'
import { Logo } from '../../components/Logo'
import { HostButton } from '../../components/HostButton'
import { EASE } from '../../lib/motion'
import { useT } from '../../i18n'
import { useRegistry } from '../../plugins/registry/useRegistry'

/// The screens the host owns natively. The Notes side-nav entry no longer lives
/// here — it is contributed by the Notes plugin through the registry — so the
/// native list carries only host-owned surfaces plus the generic `plugins`
/// manager screen.
export type NativeScreen = 'projetos' | 'arquivo' | 'backup' | 'config' | 'plugins'

/// The active screen is either a native one or any plugin-contributed screen id
/// (a `ScreenContribution.id`, an arbitrary string), so the type widens to
/// `string` for the plugin half while keeping the native ids documented.
export type Screen = NativeScreen | string

/// A rail entry as rendered below: the native items and the registry's nav
/// contributions are normalized to this shape so the list maps uniformly.
interface NavEntry {
  id: string
  label: string
  icon: ComponentType<{ size?: number | string }>
}

/// Last-resort breadcrumb label for a screen id with no nav entry: turn a raw id
/// like `meu-plugin` or `meu_plugin` into a readable `Meu plugin`. Never returns
/// an i18n key, so the breadcrumb never leaks `shell.nav.*` for unknown screens.
function humanizeScreenId(screen: string): string {
  const normalized = screen.replace(/[-_]+/g, ' ').trim()
  if (!normalized) return screen
  return normalized.charAt(0).toUpperCase() + normalized.slice(1)
}

export function Shell({
  screen,
  projectTitle,
  config,
  onNavigate,
  onSnapshotError,
  children,
}: {
  screen: Screen
  projectTitle?: string
  config: Config
  onNavigate: (screen: Screen) => void
  onSnapshotError: (message: string) => void
  children: ReactNode
}) {
  const t = useT()
  // Subscribe to the registry so the rail re-renders whenever a plugin is
  // enabled/disabled (its nav contribution appears/disappears) with no restart.
  const registry = useRegistry()
  // Native, host-owned items. Notes is gone from here — its nav entry now comes
  // from the registry below; `plugins` opens the generic plugin manager.
  const nativeNav: NavEntry[] = [
    { id: 'projetos', label: t('shell.nav.projetos'), icon: FolderKanban },
    { id: 'arquivo', label: t('shell.nav.arquivo'), icon: Archive },
    { id: 'backup', label: t('shell.nav.backup'), icon: CloudUpload },
    { id: 'config', label: t('shell.nav.config'), icon: Settings },
    { id: 'plugins', label: t('shell.nav.plugins'), icon: Blocks },
  ]
  // Plugin-contributed rail entries: each carries its own resolved label/icon and
  // the screen id it navigates to (the `ScreenContribution.id` it pairs with).
  const pluginNav: NavEntry[] = registry.navItems.map((item) => ({
    id: item.screen,
    label: item.label,
    icon: item.icon,
  }))
  const nav: NavEntry[] = [...nativeNav, ...pluginNav]
  // Resolve the active screen's breadcrumb label from the rail entries so plugin
  // screens (e.g. `notes`) show their contributed label instead of a raw i18n
  // key like `shell.nav.notes`. A native or plugin nav entry whose id matches the
  // active screen wins; otherwise fall back to a humanized screen id.
  const activeNavLabel = nav.find((entry) => entry.id === screen)?.label
  const breadcrumbLabel = projectTitle ?? activeNavLabel ?? humanizeScreenId(screen)
  return (
    <div className="shell">
      <header className="topbar">
        <Logo height={14} />
        <div className="crumbs">
          <button type="button" onClick={() => onNavigate('projetos')}>
            {t('shell.crumbs_root')}
          </button>
          <span>/</span>
          <strong>{breadcrumbLabel}</strong>
        </div>
        <SaveIndicator />
        <HostButton porta={config.porta} />
        <SnapshotButton onError={onSnapshotError} />
        <div className="local">
          <span className="local__dot" />
          {t('shell.local_badge')}
        </div>
      </header>
      <div className="body">
        <nav className="rail" aria-label={t('shell.aria_rail')}>
          <ul>
            {nav.map(({ id, label, icon: Icon }) => (
              <li key={id}>
                <motion.button
                  type="button"
                  className={screen === id ? 'rail__link rail__link--active' : 'rail__link'}
                  onClick={() => onNavigate(id)}
                  whileHover={{ x: 2 }}
                  whileTap={{ scale: 0.985 }}
                  transition={{ duration: 0.12, ease: EASE }}
                >
                  <Icon size={15} /> {label}
                </motion.button>
              </li>
            ))}
          </ul>
          <footer>
            <span className="eyebrow">{t('shell.data_section')}</span>
            <div>~/Documents/</div>
            <strong>PROJECTUS</strong>
            <span className="eyebrow rail__section">{t('shell.backup_section')}</span>
            <div className={config.r2.configurado ? 'status status--ok' : 'status'}>
              {config.r2.configurado ? 'OK' : 'OFF'} / R2
            </div>
            <p>
              <SlidersHorizontal size={12} /> {t('shell.shortcut_hint')}
            </p>
          </footer>
        </nav>
        <main className="main">{children}</main>
      </div>
    </div>
  )
}
