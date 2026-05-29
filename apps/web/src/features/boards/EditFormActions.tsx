import { ArchiveAction } from '../../components/ArchiveAction'

export function EditFormActions({ entidade, onArchive }: { entidade: string; onArchive: () => Promise<void> }) {
  return (
    <footer className="form-actions form-actions--spread">
      <ArchiveAction entidade={entidade} onArchive={onArchive} />
    </footer>
  )
}
