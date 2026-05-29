import { useEffect, useState } from 'react'
import { Download } from 'lucide-react'
import { api } from '../../lib/api'
import { SnapshotButton } from '../../components/SnapshotButton'
import { useSnapshotState } from '../../hooks/useSnapshot'
import type { Config, Snapshot } from '../../lib/types'
import { useT } from '../../i18n'
import { Button, Card, Container, EmptyState, PageHeader, Text } from '../../components/ui'

export function BackupView({
  config,
  onMessage,
}: {
  config: Config
  onMessage: (type: 'ok' | 'erro', text: string) => void
}) {
  const t = useT()
  const [snapshots, setSnapshots] = useState<Snapshot[]>([])
  const snapshotState = useSnapshotState()

  const load = async () => {
    if (!config.r2.configurado) return
    try {
      setSnapshots((await api.snapshots()).snapshots)
    } catch (error) {
      onMessage('erro', error instanceof Error ? error.message : t('backup_view.fail_query'))
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
    <Container className="backups">
      <PageHeader
        eyebrow={t('backup_view.eyebrow')}
        title={t('backup_view.title')}
        actions={
          <SnapshotButton
            className="snapshot-button--primary"
            idleLabel={t('backup_view.snapshot_now')}
            onError={(text) => onMessage('erro', text)}
          />
        }
      />
      <Text className="panel-copy">{t('backup_view.description')}</Text>
      {!config.r2.configurado ? (
        <EmptyState>
          <p>{t('backup_view.not_configured')}</p>
          <small>{t('backup_view.not_configured_hint')}</small>
        </EmptyState>
      ) : (
        <Card className="snapshots" title={t('backup_view.history')}>
          {snapshots.map((snapshot) => (
            <article className="snapshot" key={snapshot.id}>
              <div>
                <strong>{snapshot.id}</strong>
                <span>
                  {snapshot.origem === 'manual' ? t('backup_view.origin_manual') : t('backup_view.origin_auto')} /{' '}
                  {t('backup_view.files_size', {
                    files: snapshot.arquivos,
                    mb: (snapshot.bytes / 1024 / 1024).toFixed(2),
                  })}
                </span>
              </div>
              <Button
                type="button"
                onClick={async () => {
                  if (!window.confirm(t('backup_view.confirm_restore'))) return
                  try {
                    await api.restoreSnapshot(snapshot.id)
                    onMessage('ok', t('backup_view.restored'))
                  } catch (error) {
                    onMessage('erro', error instanceof Error ? error.message : t('backup_view.fail_restore'))
                  }
                }}
              >
                <Download size={14} /> {t('backup_view.restore')}
              </Button>
            </article>
          ))}
          {snapshots.length === 0 && <p className="panel-empty">{t('backup_view.empty')}</p>}
        </Card>
      )}
    </Container>
  )
}
