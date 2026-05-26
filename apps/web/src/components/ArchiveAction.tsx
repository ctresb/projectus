import { useState } from 'react'
import { Archive } from 'lucide-react'

export function ArchiveAction({
  entidade,
  onArchive,
}: {
  entidade: string
  onArchive: () => Promise<void>
}) {
  const [confirming, setConfirming] = useState(false)
  if (confirming) {
    return (
      <div className="archive-confirm">
        <span>mover {entidade} para Arquivo?</span>
        <button className="btn btn--quiet" type="button" onClick={() => setConfirming(false)}>
          cancelar
        </button>
        <button className="btn btn--danger" type="button" onClick={() => void onArchive()}>
          arquivar
        </button>
      </div>
    )
  }
  return (
    <button className="btn btn--danger" type="button" onClick={() => setConfirming(true)}>
      <Archive size={14} /> arquivar
    </button>
  )
}
