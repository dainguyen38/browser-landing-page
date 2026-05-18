import { useState } from 'react'
import { MoreVertical } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { faviconUrl, getHostname, letterFallback } from '@/lib/favicon'
import { useT } from '@/i18n/useT'
import type { PinnedSite } from '@/store/pinned'
import { cn } from '@/lib/utils'

interface Props {
  site: PinnedSite
  onEdit: () => void
  onDelete: () => void
}

export function PinnedTile({ site, onEdit, onDelete }: Props) {
  const { t } = useT()
  const [imgFailed, setImgFailed] = useState(false)
  const iconSrc = site.customIconUrl || faviconUrl(site.url, 64)
  const showFallback = imgFailed || !iconSrc

  const { letter, gradient } = letterFallback(site.name || getHostname(site.url) || '?', site.url)
  const host = getHostname(site.url) || site.url

  return (
    <div className="group/tile relative w-24 h-24">
      <a
        href={site.url}
        rel="noreferrer"
        className={cn(
          'flex h-full w-full flex-col items-center justify-center gap-1.5 rounded-xl p-2 border border-white/10 bg-white/5 hover:bg-white/15 hover:border-white/25 transition-colors',
        )}
        title={`${site.name} — ${host}`}
      >
        <div
          className="h-10 w-10 rounded-lg flex items-center justify-center overflow-hidden text-white text-base font-semibold shadow-inner shrink-0"
          style={showFallback ? { background: gradient } : undefined}
        >
          {showFallback ? (
            <span>{letter}</span>
          ) : (
            <img
              src={iconSrc!}
              alt=""
              referrerPolicy="no-referrer"
              width={40}
              height={40}
              className="h-10 w-10 object-cover"
              onError={() => setImgFailed(true)}
            />
          )}
        </div>
        <div className="text-[11px] font-medium text-white/90 text-soft-shadow line-clamp-1 max-w-full px-1">
          {site.name || host}
        </div>
      </a>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="absolute top-1 right-1 inline-flex h-6 w-6 items-center justify-center rounded-md bg-black/30 text-white/70 hover:text-white hover:bg-black/60 opacity-0 group-hover/tile:opacity-100 transition-opacity"
            aria-label="More"
            onClick={(e) => e.preventDefault()}
          >
            <MoreVertical className="h-3.5 w-3.5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={onEdit}>{t('common.edit')}</DropdownMenuItem>
          <DropdownMenuItem onSelect={onDelete} className="text-rose-300 focus:text-rose-200">
            {t('common.delete')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
