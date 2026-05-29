import { useState } from 'react'
import { Archive } from 'lucide-react'
import { useT } from '../i18n'
import { Button } from './ui'

export function ArchiveAction({ entidade, onArchive }: { entidade: string; onArchive: () => Promise<void> }) {
  const t = useT()
  const [confirming, setConfirming] = useState(false)
  if (confirming) {
    return (
      <div className="archive-confirm">
        <span>{t('archive_action.confirm', { entidade })}</span>
        <Button type="button" onClick={() => setConfirming(false)}>
          {t('archive_action.cancel')}
        </Button>
        <Button variant="danger" type="button" onClick={() => void onArchive()}>
          {t('archive_action.archive')}
        </Button>
      </div>
    )
  }
  return (
    <Button variant="danger" type="button" onClick={() => setConfirming(true)}>
      <Archive size={14} /> {t('archive_action.archive')}
    </Button>
  )
}
