import type { ReactNode } from 'react'
import './shell.css'
import { Archive, CloudUpload, FolderKanban, Lightbulb, Settings, SlidersHorizontal } from 'lucide-react'
import { motion } from 'motion/react'
import type { Config } from '../../lib/types'
import { SaveIndicator } from '../../components/SaveIndicator'
import { SnapshotButton } from '../../components/SnapshotButton'
import { Logo } from '../../components/Logo'
import { HostButton } from '../../components/HostButton'
import { EASE } from '../../lib/motion'
import { useT } from '../../i18n'

export type Screen = 'projetos' | 'ideias' | 'arquivo' | 'backup' | 'config'

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
  const nav = [
    { id: 'projetos' as const, label: t('shell.nav.projetos'), icon: FolderKanban },
    { id: 'ideias' as const, label: t('shell.nav.ideias'), icon: Lightbulb },
    { id: 'arquivo' as const, label: t('shell.nav.arquivo'), icon: Archive },
    { id: 'backup' as const, label: t('shell.nav.backup'), icon: CloudUpload },
    { id: 'config' as const, label: t('shell.nav.config'), icon: Settings },
  ]
  return (
    <div className="shell">
      <header className="topbar">
        <Logo height={14} />
        <div className="crumbs">
          <button type="button" onClick={() => onNavigate('projetos')}>
            {t('shell.crumbs_root')}
          </button>
          <span>/</span>
          <strong>{projectTitle ?? t(`shell.nav.${screen}`)}</strong>
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
