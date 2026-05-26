import type { ReactNode } from 'react'
import { Archive, CloudUpload, FolderKanban, Lightbulb, Settings, SlidersHorizontal } from 'lucide-react'
import { motion } from 'motion/react'
import type { Config } from '../../lib/types'
import { SaveIndicator } from '../../components/SaveIndicator'
import { Logo } from '../../components/Logo'
import { HostButton } from '../../components/HostButton'

export type Screen = 'projetos' | 'ideias' | 'arquivo' | 'backup' | 'config'

export function Shell({
  screen,
  projectTitle,
  config,
  onNavigate,
  onSave,
  children,
}: {
  screen: Screen
  projectTitle?: string
  config: Config
  onNavigate: (screen: Screen) => void
  onSave: () => void
  children: ReactNode
}) {
  const nav = [
    { id: 'projetos' as const, label: 'projetos', icon: FolderKanban },
    { id: 'ideias' as const, label: 'ideias', icon: Lightbulb },
    { id: 'arquivo' as const, label: 'arquivo', icon: Archive },
    { id: 'backup' as const, label: 'backups', icon: CloudUpload },
    { id: 'config' as const, label: 'config', icon: Settings },
  ]
  return (
    <div className="shell">
      <header className="topbar">
        <Logo height={14} />
        <div className="crumbs">
          <button type="button" onClick={() => onNavigate('projetos')}>
            projectus
          </button>
          <span>/</span>
          <strong>{projectTitle ?? screen}</strong>
        </div>
        <SaveIndicator />
        <HostButton porta={config.porta} />
        <button className="save-button" type="button" onClick={onSave}>
          <span>$</span> [SAVE] <small>R2</small>
        </button>
        <div className="local">
          <span className="local__dot" />
          local
        </div>
      </header>
      <div className="body">
        <nav className="rail" aria-label="Espaços">
          <ul>
            {nav.map(({ id, label, icon: Icon }) => (
              <li key={id}>
                <motion.button
                  type="button"
                  className={screen === id ? 'rail__link rail__link--active' : 'rail__link'}
                  onClick={() => onNavigate(id)}
                  whileHover={{ x: 2 }}
                  whileTap={{ scale: 0.985 }}
                  transition={{ duration: 0.12, ease: [0.2, 0.7, 0.2, 1] }}
                >
                  <Icon size={15} /> {label}
                </motion.button>
              </li>
            ))}
          </ul>
          <footer>
            <span className="eyebrow">dados</span>
            <div>~/Documents/</div>
            <strong>PROJECTUS</strong>
            <span className="eyebrow rail__section">backup</span>
            <div className={config.r2.configurado ? 'status status--ok' : 'status'}>
              {config.r2.configurado ? 'OK' : 'OFF'} / R2
            </div>
            <p>
              <SlidersHorizontal size={12} /> ⌘N cria rápido
            </p>
          </footer>
        </nav>
        <main className="main">{children}</main>
      </div>
    </div>
  )
}
