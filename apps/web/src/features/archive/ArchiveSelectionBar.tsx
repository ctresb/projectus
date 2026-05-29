import { useT } from '../../i18n'
import { Checkbox } from '../../components/ui'

export function ArchiveSelectionBar({
  allSelected,
  busy,
  selectedCount,
  total,
  onToggleAll,
}: {
  allSelected: boolean
  busy: boolean
  selectedCount: number
  total: number
  onToggleAll: () => void
}) {
  const t = useT()
  return (
    <div className="archive-selection-bar">
      <Checkbox
        aria-label={t('archive_view.aria_select_all')}
        checked={allSelected}
        className="archive-checkbox-label"
        disabled={busy}
        label={t('archive_view.selected_count', { selected: selectedCount, total })}
        onCheckedChange={onToggleAll}
      />
    </div>
  )
}
