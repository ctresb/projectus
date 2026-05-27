import { useEffect, useState } from 'react'
import { Download } from 'lucide-react'
import { api } from '../../lib/api'
import { SnapshotButton } from '../../components/SnapshotButton'
import { useSnapshotState } from '../../hooks/useSnapshot'
import type { Config, Snapshot } from '../../lib/types'

export function BackupView({
  config,
  dataRootLabel,
  onMessage,
}: {
  config: Config
  dataRootLabel?: string
  onMessage: (type: 'ok' | 'erro', text: string) => void
}) {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([])
  const snapshotState = useSnapshotState()

  const load = async () => {
    if (!config.r2.configurado) return
    try {
      setSnapshots((await api.snapshots()).snapshots)
    } catch (error) {
      onMessage('erro', error instanceof Error ? error.message : 'não foi possível consultar o R2')
    }
  }
  useEffect(() => {
    void load()
  }, [config.r2.configurado])
  // Recarrega a lista após snapshot bem-sucedido.
  useEffect(() => {
    if (snapshotState.phase === 'done') void load()
  }, [snapshotState.phase])

  return (
    <section className="workspace backups">
      <header className="section-head">
        <div>
          <span className="eyebrow">r2-syncs</span>
          <h1>backups</h1>
        </div>
        <SnapshotButton
          className="snapshot-button--primary"
          idleLabel="[SNAPSHOT] agora"
          onError={(text) => onMessage('erro', text)}
        />
      </header>
      <p className="panel-copy">
        cada snapshot envia a pasta integral <code>{dataRootLabel ?? '~/Documents/PROJECTUS'}</code>: configurações, kanbans, ideias,
        Arquivo, históricos e anexos.
      </p>
      {!config.r2.configurado ? (
        <div className="empty">
          <p>R2 ainda não configurado.</p>
          <small>informe bucket e credenciais em configurações.</small>
        </div>
      ) : (
        <div className="snapshots panel">
          <header>histórico remoto</header>
          {snapshots.map((snapshot) => (
            <article className="snapshot" key={snapshot.id}>
              <div>
                <strong>{snapshot.id}</strong>
                <span>
                  {snapshot.origem === 'manual' ? 'MANUAL' : 'AUTO'} / {snapshot.arquivos} arquivos /{' '}
                  {(snapshot.bytes / 1024 / 1024).toFixed(2)} MB
                </span>
              </div>
              <button
                className="btn btn--quiet"
                type="button"
                onClick={async () => {
                  if (!window.confirm('Restaurar este snapshot? O estado atual será preservado em uma pasta de recuperação.'))
                    return
                  try {
                    await api.restoreSnapshot(snapshot.id)
                    onMessage('ok', 'snapshot restaurado')
                  } catch (error) {
                    onMessage('erro', error instanceof Error ? error.message : 'falha ao restaurar')
                  }
                }}
              >
                <Download size={14} /> restaurar
              </button>
            </article>
          ))}
          {snapshots.length === 0 && <p className="panel-empty">nenhum snapshot enviado.</p>}
        </div>
      )}
    </section>
  )
}
