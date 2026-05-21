import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  GraduationCap,
  RefreshCw,
  Volume2,
  Plus,
  Trash2,
  ChevronDown,
  Languages,
  Sparkles,
} from 'lucide-react'
import { GlassCard } from '@/components/layout/GlassCard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  useEnglishStore,
  TARGET_LANGUAGES,
  MIN_WORD_COUNT,
  MAX_WORD_COUNT,
} from '@/store/english'
import {
  cefrLevel,
  fetchDictionary,
  fetchTopicWords,
  speak,
  translate,
  type DictEntry,
} from '@/lib/dictionary'
import { useT } from '@/i18n/useT'
import { cn } from '@/lib/utils'

function todayKey() {
  return new Date().toISOString().slice(0, 10)
}

function pickN<T>(arr: T[], n: number): T[] {
  if (arr.length <= n) return [...arr]
  const copy = [...arr]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy.slice(0, n)
}

export function EnglishWidget() {
  const { t } = useT()
  const topics = useEnglishStore((s) => s.topics)
  const activeTopicId = useEnglishStore((s) => s.activeTopicId)
  const setActiveTopic = useEnglishStore((s) => s.setActiveTopic)
  const wordCount = useEnglishStore((s) => s.wordCount)
  const setWordCount = useEnglishStore((s) => s.setWordCount)
  const targetLanguage = useEnglishStore((s) => s.targetLanguage)
  const setTargetLanguage = useEnglishStore((s) => s.setTargetLanguage)
  const daily = useEnglishStore((s) => s.daily)
  const cacheDaily = useEnglishStore((s) => s.cacheDaily)
  const refreshTick = useEnglishStore((s) => s.refreshTick)
  const refresh = useEnglishStore((s) => s.refresh)
  const addTopic = useEnglishStore((s) => s.addTopic)
  const removeTopic = useEnglishStore((s) => s.removeTopic)

  const [words, setWords] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [addTopicOpen, setAddTopicOpen] = useState(false)

  const activeTopic = useMemo(
    () => topics.find((t) => t.id === activeTopicId) ?? topics[0],
    [topics, activeTopicId],
  )

  const loadWords = useCallback(async () => {
    if (!activeTopic) {
      setWords([])
      return
    }
    setLoading(true)
    setError(null)
    try {
      const date = todayKey()
      const cached = daily[date]?.[activeTopic.id]
      if (cached && cached.length >= wordCount && refreshTick === 0) {
        setWords(cached.slice(0, wordCount))
        return
      }
      const pool = await fetchTopicWords(activeTopic.query, 120)
      if (pool.length === 0) {
        setError(t('english.noWords'))
        setWords([])
        return
      }
      const picked = pickN(
        pool.map((p) => p.word),
        wordCount,
      )
      setWords(picked)
      cacheDaily(activeTopic.id, picked)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTopic?.id, wordCount, refreshTick])

  useEffect(() => {
    loadWords()
  }, [loadWords])

  return (
    <GlassCard className="flex flex-col gap-3 min-h-0">
      <header className="flex items-center justify-between gap-2 pr-10 shrink-0">
        <div className="flex items-center gap-2">
          <GraduationCap className="h-4 w-4 text-sky-200" />
          <h2 className="text-sm font-semibold tracking-wide uppercase text-white/90 text-soft-shadow">
            {t('english.title')}
          </h2>
        </div>
        <Button
          size="icon"
          variant="ghost"
          onClick={() => refresh()}
          disabled={loading}
          aria-label={t('english.refresh')}
          className="h-7 w-7"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
        </Button>
      </header>

      {/* Controls row */}
      <div className="grid grid-cols-12 gap-2 shrink-0">
        <div className="col-span-5 flex items-center gap-1">
          <Select value={activeTopic?.id ?? ''} onValueChange={setActiveTopic}>
            <SelectTrigger className="h-8 text-xs flex-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {topics.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setAddTopicOpen(true)}
            aria-label={t('english.addTopic')}
            className="h-8 w-8 shrink-0"
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
          {activeTopic?.custom && (
            <Button
              size="icon"
              variant="ghost"
              onClick={() => removeTopic(activeTopic.id)}
              aria-label="Remove topic"
              className="h-8 w-8 shrink-0 text-rose-300 hover:text-rose-200"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
        <div className="col-span-4 flex items-center gap-2 text-xs text-white/75">
          <Sparkles className="h-3.5 w-3.5 text-amber-300 shrink-0" />
          <input
            type="range"
            min={MIN_WORD_COUNT}
            max={MAX_WORD_COUNT}
            value={wordCount}
            onChange={(e) => setWordCount(parseInt(e.target.value, 10))}
            className="flex-1"
          />
          <span className="w-6 text-center tabular-nums">{wordCount}</span>
        </div>
        <div className="col-span-3 flex items-center gap-1">
          <Languages className="h-3.5 w-3.5 text-white/55 shrink-0" />
          <Select value={targetLanguage} onValueChange={setTargetLanguage}>
            <SelectTrigger className="h-8 text-xs flex-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TARGET_LANGUAGES.map((l) => (
                <SelectItem key={l.code} value={l.code}>
                  <span className="mr-1">{l.flag}</span>
                  {l.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Word list */}
      <div className="flex-1 min-h-0 overflow-auto pr-1 space-y-2">
        {error && (
          <div className="rounded-lg border border-rose-400/30 bg-rose-500/10 p-3 text-xs text-rose-200">
            {error}
          </div>
        )}
        {!error && loading && words.length === 0 && (
          <div className="text-xs text-white/65 py-6 text-center">{t('english.loading')}</div>
        )}
        {!error && words.length === 0 && !loading && (
          <div className="text-xs text-white/65 py-6 text-center">{t('english.empty')}</div>
        )}
        {words.map((w) => (
          <WordCard key={`${activeTopic?.id}_${w}`} word={w} targetLanguage={targetLanguage} />
        ))}
      </div>

      <AddTopicDialog
        open={addTopicOpen}
        onOpenChange={setAddTopicOpen}
        onAdd={(name, query) => addTopic(name, query)}
      />
    </GlassCard>
  )
}

function AddTopicDialog({
  open,
  onOpenChange,
  onAdd,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  onAdd: (name: string, query: string) => void
}) {
  const { t } = useT()
  const [name, setName] = useState('')
  const [query, setQuery] = useState('')
  useEffect(() => {
    if (open) {
      setName('')
      setQuery('')
    }
  }, [open])
  const submit = () => {
    if (!name.trim()) return
    onAdd(name.trim(), query.trim() || name.trim())
    onOpenChange(false)
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('english.newTopic')}</DialogTitle>
          <DialogDescription>{t('english.newTopicDesc')}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="grid gap-1.5">
            <label className="text-xs text-white/75">{t('english.topicName')}</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Cooking"
              autoFocus
            />
          </div>
          <div className="grid gap-1.5">
            <label className="text-xs text-white/75">{t('english.topicSeed')}</label>
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="cook,recipe,kitchen,oven"
            />
            <p className="text-[10px] text-white/45">{t('english.topicSeedHint')}</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button onClick={submit}>{t('common.add')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function WordCard({ word, targetLanguage }: { word: string; targetLanguage: string }) {
  const { t, locale } = useT()
  const [entry, setEntry] = useState<DictEntry | null>(null)
  const [loadingDict, setLoadingDict] = useState(false)
  const [showTranslation, setShowTranslation] = useState(false)
  const [translation, setTranslation] = useState<string | null>(null)
  const [loadingTr, setLoadingTr] = useState(false)
  const [expanded, setExpanded] = useState(false)

  const level = cefrLevel(word)

  useEffect(() => {
    let cancelled = false
    setLoadingDict(true)
    fetchDictionary(word).then((d) => {
      if (!cancelled) {
        setEntry(d)
        setLoadingDict(false)
      }
    })
    return () => {
      cancelled = true
    }
  }, [word])

  const onSpeak = useCallback(() => {
    const audio = entry?.audio
    if (audio) {
      try {
        const a = new Audio(audio)
        a.play().catch(() => speak(word))
        return
      } catch {
        /* fall through */
      }
    }
    speak(word)
  }, [entry, word])

  const showTransClick = useCallback(async () => {
    if (showTranslation) {
      setShowTranslation(false)
      return
    }
    setShowTranslation(true)
    if (translation) return
    setLoadingTr(true)
    const definition =
      entry?.meanings?.[0]?.definitions?.[0]?.definition ?? word
    const tr = await translate(`${word} — ${definition}`, targetLanguage, 'en')
    setTranslation(tr?.text ?? null)
    setLoadingTr(false)
  }, [showTranslation, translation, entry, word, targetLanguage])

  const allSynonyms = useMemo(() => {
    if (!entry) return []
    const out = new Set<string>()
    for (const m of entry.meanings) {
      for (const s of m.synonyms ?? []) out.add(s)
      for (const d of m.definitions) for (const s of d.synonyms ?? []) out.add(s)
    }
    return Array.from(out).slice(0, 6)
  }, [entry])

  const allAntonyms = useMemo(() => {
    if (!entry) return []
    const out = new Set<string>()
    for (const m of entry.meanings) {
      for (const s of m.antonyms ?? []) out.add(s)
      for (const d of m.definitions) for (const s of d.antonyms ?? []) out.add(s)
    }
    return Array.from(out).slice(0, 6)
  }, [entry])

  const firstDef = entry?.meanings?.[0]?.definitions?.[0]
  const firstPart = entry?.meanings?.[0]?.partOfSpeech

  const langInfo = TARGET_LANGUAGES.find((l) => l.code === targetLanguage)

  return (
    <div
      className={cn(
        'rounded-xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.06] transition-colors p-3',
        expanded && 'bg-white/[0.07] border-white/15',
      )}
    >
      {/* Header row */}
      <div className="flex items-start gap-2">
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="flex-1 text-left flex items-baseline gap-2 min-w-0"
        >
          <span className="text-base font-semibold text-white">{word}</span>
          {entry?.phonetic && (
            <span className="text-xs text-white/55 tabular-nums truncate">{entry.phonetic}</span>
          )}
          <span className="ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded bg-sky-500/25 text-sky-100">
            {level}
          </span>
          {firstPart && (
            <span className="text-[10px] italic text-white/55 truncate">{firstPart}</span>
          )}
        </button>
        <button
          type="button"
          onClick={onSpeak}
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-sky-200 hover:bg-white/10 shrink-0"
          aria-label={t('english.speak')}
          title={t('english.speak')}
        >
          <Volume2 className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-white/55 hover:bg-white/10 shrink-0"
          aria-label="Expand"
        >
          <ChevronDown className={cn('h-4 w-4 transition-transform', expanded && 'rotate-180')} />
        </button>
      </div>

      {/* Definition (always-visible compact) */}
      {firstDef ? (
        <div className="mt-1.5 text-xs text-white/80 line-clamp-2">{firstDef.definition}</div>
      ) : loadingDict ? (
        <div className="mt-1.5 text-xs text-white/45">…</div>
      ) : (
        <div className="mt-1.5 text-xs text-white/45">{t('english.noDict')}</div>
      )}

      {/* Expanded body */}
      {expanded && (
        <div className="mt-2 space-y-2">
          {firstDef?.example && (
            <div className="rounded-md bg-white/5 border border-white/10 px-2.5 py-1.5">
              <div className="text-[10px] uppercase tracking-widest text-white/45">
                {t('english.example')}
              </div>
              <div className="text-xs text-white/85 italic">"{firstDef.example}"</div>
            </div>
          )}

          {(allSynonyms.length > 0 || allAntonyms.length > 0) && (
            <div className="space-y-1.5">
              {allSynonyms.length > 0 && (
                <ChipRow
                  label={t('english.synonyms')}
                  items={allSynonyms}
                  tone="emerald"
                />
              )}
              {allAntonyms.length > 0 && (
                <ChipRow
                  label={t('english.antonyms')}
                  items={allAntonyms}
                  tone="rose"
                />
              )}
            </div>
          )}

          {/* Other meanings */}
          {entry && entry.meanings.length > 1 && (
            <div className="text-[11px] text-white/70 space-y-1">
              {entry.meanings.slice(1, 3).map((m, i) => (
                <div key={i}>
                  <span className="italic text-white/55">{m.partOfSpeech}.</span>{' '}
                  {m.definitions[0]?.definition}
                </div>
              ))}
            </div>
          )}

          {/* Translation toggle */}
          <button
            type="button"
            onClick={showTransClick}
            className="inline-flex items-center gap-1.5 text-[11px] text-sky-200 hover:text-sky-100"
          >
            <Languages className="h-3 w-3" />
            {showTranslation ? t('english.hideTranslation') : t('english.showTranslation')}
            <span className="text-white/45">{langInfo?.flag}</span>
          </button>
          {showTranslation && (
            <div className="rounded-md bg-sky-500/10 border border-sky-400/25 px-2.5 py-1.5 text-xs text-sky-50">
              {loadingTr ? '…' : translation || t('english.noTranslation')}
            </div>
          )}
        </div>
      )}
      {/* keep locale variable referenced */}
      <span className="hidden">{locale}</span>
    </div>
  )
}

function ChipRow({
  label,
  items,
  tone,
}: {
  label: string
  items: string[]
  tone: 'emerald' | 'rose'
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-white/45 mb-1">{label}</div>
      <div className="flex flex-wrap gap-1">
        {items.map((s) => (
          <span
            key={s}
            className={cn(
              'inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-medium',
              tone === 'emerald'
                ? 'bg-emerald-500/20 text-emerald-100 border border-emerald-400/30'
                : 'bg-rose-500/20 text-rose-100 border border-rose-400/30',
            )}
          >
            {s}
          </span>
        ))}
      </div>
    </div>
  )
}
