import { useState } from 'react'
import { Archive } from 'lucide-react'
import { useT } from '../i18n'

export function ArchiveAction({
  entidade,
  onArchive,
}: {
  entidade: string
  onArchive: () => Promise<void>
}) {
  const t = useT()
  const [confirming, setConfirming] = useState(false)
  if (confirming) {
    return (
      <div className="archive-confirm">
        <span>{t('archive_action.confirm', { entidade })}</span>
        <button className="btn btn--quiet" type="button" onClick={() => setConfirming(false)}>
          {t('archive_action.cancel')}
        </button>
        <button className="btn btn--danger" type="button" onClick={() => void onArchive()}>
          {t('archive_action.archive')}
        </button>
      </div>
    )
  }
  return (
    <button className="btn btn--danger" type="button" onClick={() => setConfirming(true)}>
      <Archive size={14} /> {t('archive_action.archive')}
    </button>
  )
}
