import { useState } from 'react'
import { StickyNote, Plus, Copy, Check, Trash2, Palette } from 'lucide-react'
import { GlassCard } from '@/components/layout/GlassCard'
import { Button } from '@/components/ui/button'
import { useNotesStore } from '@/store/notes'
import { useT } from '@/i18n/useT'
import { cn } from '@/lib/utils'

const PALETTE = ['#fde68a', '#bbf7d0', '#bae6fd', '#ddd6fe', '#fbcfe8', '#fed7aa']

export function NotesWidget() {
  const { t } = useT()
  const notes = useNotesStore((s) => s.notes)
  const add = useNotesStore((s) => s.add)
  const update = useNotesStore((s) => s.update)
  const remove = useNotesStore((s) => s.remove)

  return (
    <GlassCard className="flex flex-col gap-3 min-h-0">
      <header className="flex items-center justify-between gap-2 pr-10 shrink-0">
        <div className="flex items-center gap-2">
          <StickyNote className="h-4 w-4 text-yellow-200" />
          <h2 className="text-sm font-semibold tracking-wide uppercase text-white/90 text-soft-shadow">
            {t('notes.title')}
          </h2>
        </div>
        <Button size="sm" variant="secondary" onClick={() => add()}>
          <Plus className="h-3.5 w-3.5" />
          {t('notes.new')}
        </Button>
      </header>

      <div className="flex-1 min-h-0 overflow-auto pr-1 space-y-2">
        {notes.length === 0 ? (
          <div className="rounded-lg border border-dashed border-white/15 p-6 text-center text-sm text-white/65">
            {t('notes.empty')}
          </div>
        ) : (
          notes.map((n) => (
            <NoteCard
              key={n.id}
              note={n}
              onChange={(patch) => update(n.id, patch)}
              onDelete={() => remove(n.id)}
            />
          ))
        )}
      </div>
    </GlassCard>
  )
}

interface NoteCardProps {
  note: {
    id: string
    title: string
    content: string
    color: string
    updatedAt: string
  }
  onChange: (patch: { title?: string; content?: string; color?: string }) => void
  onDelete: () => void
}

function NoteCard({ note, onChange, onDelete }: NoteCardProps) {
  const { t, locale } = useT()
  const [copied, setCopied] = useState(false)
  const [colorOpen, setColorOpen] = useState(false)

  const copy = async () => {
    try {
      const text = [note.title, note.content].filter(Boolean).join('\n')
      await navigator.clipboard.writeText(text)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      /* ignore */
    }
  }

  const updatedLabel = (() => {
    try {
      return new Date(note.updatedAt).toLocaleString(locale === 'vi' ? 'vi-VN' : 'en-US', {
        dateStyle: 'short',
        timeStyle: 'short',
      })
    } catch {
      return ''
    }
  })()

  return (
    <div
      className="rounded-xl p-2.5 border shadow-[inset_0_1px_0_rgba(255,255,255,0.25)]"
      style={{
        background: `linear-gradient(160deg, ${note.color}, ${note.color}cc)`,
        borderColor: `${note.color}cc`,
      }}
    >
      <div className="flex items-start gap-2">
        <input
          value={note.title}
          onChange={(e) => onChange({ title: e.target.value })}
          placeholder={t('notes.titlePh')}
          className="flex-1 bg-transparent text-zinc-900 font-semibold text-sm placeholder:text-zinc-700/55 focus:outline-none"
        />
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            type="button"
            onClick={() => setColorOpen((o) => !o)}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-zinc-900/70 hover:bg-black/10"
            aria-label={t('notes.color')}
          >
            <Palette className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={copy}
            className={cn(
              'inline-flex h-7 w-7 items-center justify-center rounded-md text-zinc-900/70 hover:bg-black/10',
              copied && 'text-emerald-600',
            )}
            aria-label={t('notes.copy')}
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-rose-700/70 hover:bg-black/10"
            aria-label={t('common.delete')}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {colorOpen && (
        <div className="flex gap-1.5 mt-2">
          {PALETTE.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => {
                onChange({ color: c })
                setColorOpen(false)
              }}
              className={cn(
                'h-5 w-5 rounded-full border-2 transition-all',
                note.color === c ? 'border-zinc-900 scale-110' : 'border-zinc-900/30 hover:scale-105',
              )}
              style={{ background: c }}
              aria-label={c}
            />
          ))}
        </div>
      )}

      <textarea
        value={note.content}
        onChange={(e) => onChange({ content: e.target.value })}
        placeholder={t('notes.contentPh')}
        rows={3}
        className="mt-1.5 w-full bg-transparent text-zinc-900 text-sm placeholder:text-zinc-700/55 focus:outline-none resize-none leading-relaxed"
      />

      <div className="flex justify-end text-[10px] text-zinc-900/55 pt-1">{updatedLabel}</div>
    </div>
  )
}
