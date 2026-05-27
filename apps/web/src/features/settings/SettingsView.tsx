import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../../lib/api'
import type { BackupCredentialStatus, Column, Config, DaemonStatus, Tag } from '../../lib/types'
import { SquareScrollArea } from '../../components/SquareScrollArea'
import { itemId } from '../../lib/ids'
import { markError, markSaved, markSaving } from '../../hooks/useSaveStatus'
import { useT } from '../../i18n'
import { Container, PageHeader } from '../../components/ui'
import {
  ColumnsPanel,
  LanguagePanel,
  R2Panel,
  ServerPanel,
  TagsPanel,
  ThemePanel,
} from './components/SettingsPanels'

function isR2S3Endpoint(endpoint: string) {
  try {
    const url = new URL(endpoint)
    return (
      url.protocol === 'https:' &&
      url.hostname.endsWith('.r2.cloudflarestorage.com') &&
      (url.pathname === '' || url.pathname === '/')
    )
  } catch {
    return false
  }
}

export function SettingsView({
  config,
  onConfig,
  onMessage,
}: {
  config: Config
  onConfig: (config: Config) => void
  onMessage: (type: 'ok' | 'erro', text: string) => void
}) {
  const t = useT()
  const [draft, setDraft] = useState(config)
  const [accessKey, setAccessKey] = useState('')
  const [secretKey, setSecretKey] = useState('')
  const [credentialStatus, setCredentialStatus] = useState<BackupCredentialStatus | null>(null)
  const [daemon, setDaemon] = useState<DaemonStatus | null>(null)
  const [showCloudflareHelp, setShowCloudflareHelp] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const validR2Endpoint = isR2S3Endpoint(draft.r2.endpoint)
  const draftRef = useRef(config)
  const dirtyRef = useRef(false)
  const savingRef = useRef(false)
  const mountedRef = useRef(true)
  const onConfigRef = useRef(onConfig)
  const onMessageRef = useRef(onMessage)

  useEffect(() => {
    onConfigRef.current = onConfig
    onMessageRef.current = onMessage
  }, [onConfig, onMessage])

  useEffect(() => {
    dirtyRef.current = dirty
    savingRef.current = saving
  }, [dirty, saving])

  useEffect(() => {
    if (dirty || saving) return
    draftRef.current = config
    setDraft(config)
  }, [config, dirty, saving])
  useEffect(() => {
    void api.daemonStatus().then(setDaemon).catch(() => undefined)
    void api.credentialStatus().then(setCredentialStatus).catch(() => undefined)
  }, [])

  const persistConfig = useCallback(async (submitted: Config, updateMountedState: boolean) => {
    try {
      const saved = await api.updateConfig(submitted)
      const hasNewerChange = draftRef.current !== submitted
      const next = hasNewerChange ? { ...draftRef.current, revision: saved.revision } : saved
      draftRef.current = next
      onConfigRef.current(next)
      if (updateMountedState && mountedRef.current) {
        setDraft(next)
        if (hasNewerChange) {
          dirtyRef.current = true
          setDirty(true)
        } else {
          markSaved()
        }
      } else if (!hasNewerChange) {
        markSaved()
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'erro ao salvar ajustes'
      markError(message)
      onMessageRef.current('erro', message)
      if (!updateMountedState || !mountedRef.current) return
      const fresh = (await api.bootstrap()).config
      draftRef.current = fresh
      setDraft(fresh)
      onConfigRef.current(fresh)
    }
  }, [])

  useEffect(() => {
    if (!dirty || saving) return
    markSaving()
    const timer = window.setTimeout(() => {
      const submitted = draftRef.current
      dirtyRef.current = false
      savingRef.current = true
      setDirty(false)
      setSaving(true)
      void persistConfig(submitted, true).finally(() => {
        savingRef.current = false
        if (mountedRef.current) setSaving(false)
      })
    }, 1000)
    return () => window.clearTimeout(timer)
  }, [dirty, persistConfig, saving])

  useEffect(() => {
    return () => {
      mountedRef.current = false
      if (!dirtyRef.current || savingRef.current) return
      const submitted = draftRef.current
      dirtyRef.current = false
      savingRef.current = true
      markSaving()
      void persistConfig(submitted, false).finally(() => {
        savingRef.current = false
      })
    }
  }, [persistConfig])

  const change = (next: Config) => {
    draftRef.current = next
    setDraft(next)
    onConfig(next)
    dirtyRef.current = true
    setDirty(true)
  }

  const saveCredentials = async () => {
    try {
      await api.saveCredentials({ access_key_id: accessKey.trim(), secret_access_key: secretKey.trim() })
      setAccessKey('')
      setSecretKey('')
      setCredentialStatus(await api.credentialStatus())
      onMessage('ok', t('settings.creds_saved'))
    } catch (error) {
      onMessage('erro', error instanceof Error ? error.message : t('settings.creds_fail'))
    }
  }

  const addTag = () => {
    const titulo = t('settings.tags.default_new_title')
    const id = itemId('tag', titulo)
    change({ ...draft, tags: [...draft.tags, { id, titulo, cor: draft.cores[0].valor }] })
  }
  const updateTag = (id: string, update: Partial<Tag>) =>
    change({ ...draft, tags: draft.tags.map((tag) => (tag.id === id ? { ...tag, ...update } : tag)) })
  const updateColumn = (id: string, update: Partial<Column>) =>
    change({ ...draft, colunas: draft.colunas.map((column) => (column.id === id ? { ...column, ...update } : column)) })
  const addColumn = () => {
    const titulo = t('settings.columns.default_new_title')
    const column: Column = {
      id: itemId('coluna', 'nova coluna'),
      titulo,
      cor: draft.cores[0].valor,
    }
    change({ ...draft, colunas: [...draft.colunas, column] })
  }
  const removeColumn = (id: string) => {
    if (draft.colunas.length === 1) {
      onMessage('erro', t('settings.min_one_column'))
      return
    }
    change({ ...draft, colunas: draft.colunas.filter((column) => column.id !== id) })
  }
  const moveColumn = (index: number, direction: -1 | 1) => {
    const destination = index + direction
    if (destination < 0 || destination >= draft.colunas.length) return
    const columns = [...draft.colunas]
    const [column] = columns.splice(index, 1)
    columns.splice(destination, 0, column)
    change({ ...draft, colunas: columns })
  }

  return (
    <Container className="settings">
      <PageHeader
        eyebrow={t('settings.eyebrow')}
        title={t('settings.title')}
        actions={<span className="settings-autosave">{dirty || saving ? t('settings.autosaving') : t('settings.autosaved')}</span>}
      />
      <SquareScrollArea viewportClassName="settings-scroll">
        <div className="settings-grid">
          <ColumnsPanel
            columns={draft.colunas}
            colors={draft.cores}
            onAdd={addColumn}
            onUpdate={updateColumn}
            onMove={moveColumn}
            onRemove={removeColumn}
            t={t}
          />
          <TagsPanel
            tags={draft.tags}
            colors={draft.cores}
            onAdd={addTag}
            onUpdate={updateTag}
            onRemove={(id) => change({ ...draft, tags: draft.tags.filter((item) => item.id !== id) })}
            t={t}
          />
          <ThemePanel
            colors={draft.cores}
            value={draft.cor_principal ?? '#55B9F7'}
            onChange={(value) => change({ ...draft, cor_principal: value })}
            t={t}
          />
          <LanguagePanel value={draft.idioma} onChange={(idioma) => change({ ...draft, idioma })} t={t} />
          <R2Panel
            r2={draft.r2}
            validEndpoint={validR2Endpoint}
            accessKey={accessKey}
            secretKey={secretKey}
            credentialStatus={credentialStatus}
            showHelp={showCloudflareHelp}
            dirty={dirty}
            saving={saving}
            onR2Change={(update) => change({ ...draft, r2: { ...draft.r2, ...update } })}
            onAccessKey={setAccessKey}
            onSecretKey={setSecretKey}
            onToggleHelp={() => setShowCloudflareHelp((current) => !current)}
            onSaveCredentials={() => void saveCredentials()}
            t={t}
          />
          <ServerPanel
            porta={draft.porta}
            daemon={daemon}
            onPortChange={(porta) => change({ ...draft, porta })}
            onDaemonChange={setDaemon}
            onMessage={onMessage}
            t={t}
          />
        </div>
      </SquareScrollArea>
    </Container>
  )
}
