import { useState } from 'react'
import { Plus, Pin } from 'lucide-react'
import { GlassCard } from '@/components/layout/GlassCard'
import { PinnedTile } from '@/components/pinned/PinnedTile'
import { AddSiteDialog } from '@/components/pinned/AddSiteDialog'
import { Button } from '@/components/ui/button'
import { usePinnedStore, type PinnedSite } from '@/store/pinned'
import { useT } from '@/i18n/useT'

export function PinnedSitesWidget() {
  const { t } = useT()
  const sites = usePinnedStore((s) => s.sites)
  const addSite = usePinnedStore((s) => s.add)
  const updateSite = usePinnedStore((s) => s.update)
  const removeSite = usePinnedStore((s) => s.remove)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<PinnedSite | null>(null)

  const openAdd = () => {
    setEditing(null)
    setDialogOpen(true)
  }
  const openEdit = (s: PinnedSite) => {
    setEditing(s)
    setDialogOpen(true)
  }

  const handleSubmit = (data: { name: string; url: string; customIconUrl?: string }) => {
    if (editing) updateSite(editing.id, data)
    else addSite(data)
  }

  return (
    <GlassCard className="flex flex-col gap-4 min-h-0">
      <header className="flex items-center justify-between gap-2 pr-10 shrink-0">
        <div className="flex items-center gap-2">
          <Pin className="h-4 w-4 text-white/80" />
          <h2 className="text-sm font-semibold tracking-wide uppercase text-white/90 text-soft-shadow">
            {t('pinned.title')}
          </h2>
        </div>
        <Button size="sm" variant="secondary" onClick={openAdd}>
          <Plus className="h-3.5 w-3.5" />
          {t('pinned.add')}
        </Button>
      </header>

      {sites.length === 0 ? (
        <div className="rounded-lg border border-dashed border-white/15 p-6 text-center text-sm text-white/70">
          {t('pinned.empty')}
        </div>
      ) : (
        <div
          className="grid gap-3 flex-1 min-h-0 overflow-y-auto pr-1 content-start justify-center"
          style={{ gridTemplateColumns: 'repeat(auto-fit, 96px)' }}
        >
          {sites.map((s) => (
            <PinnedTile
              key={s.id}
              site={s}
              onEdit={() => openEdit(s)}
              onDelete={() => removeSite(s.id)}
            />
          ))}
        </div>
      )}

      <AddSiteDialog
        open={dialogOpen}
        initial={editing}
        onOpenChange={setDialogOpen}
        onSubmit={handleSubmit}
      />
    </GlassCard>
  )
}
