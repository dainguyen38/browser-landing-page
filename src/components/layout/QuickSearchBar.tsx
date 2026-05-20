import { useEffect, useMemo, useRef, useState } from 'react'
import { Search, X, ChevronDown, ExternalLink, Check } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useSettingsStore } from '@/store/settings'
import { useT } from '@/i18n/useT'
import {
  ENGINES,
  fetchSuggestions,
  getEngine,
  looksLikeUrl,
  normalizeUrl,
  type SearchEngineId,
} from '@/lib/search'
import { cn } from '@/lib/utils'

function isTypingTarget(el: Element | null): boolean {
  if (!el) return false
  if (
    el instanceof HTMLInputElement ||
    el instanceof HTMLTextAreaElement ||
    el instanceof HTMLSelectElement
  ) {
    return true
  }
  if ((el as HTMLElement).isContentEditable) return true
  return false
}

export function QuickSearchBar() {
  const { t } = useT()
  const engineId = useSettingsStore((s) => s.searchEngine)
  const setEngine = useSettingsStore((s) => s.setSearchEngine)
  const engine = getEngine(engineId)

  const [value, setValue] = useState('')
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [highlight, setHighlight] = useState(-1)
  const [showSugg, setShowSugg] = useState(false)
  const [enginePickerOpen, setEnginePickerOpen] = useState(false)

  const inputRef = useRef<HTMLInputElement>(null)
  const wrapRef = useRef<HTMLFormElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  // Global "type to focus" listener
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as Element | null
      if (isTypingTarget(target)) return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key.length === 1) {
        e.preventDefault()
        setValue((prev) => prev + e.key)
        setShowSugg(true)
        inputRef.current?.focus()
        return
      }
      if (e.key === '/') {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Caret to end on programmatic value growth
  useEffect(() => {
    const el = inputRef.current
    if (!el || document.activeElement !== el) return
    const len = el.value.length
    try {
      el.setSelectionRange(len, len)
    } catch {
      /* ignore */
    }
  }, [value])

  // Click outside → close suggestions
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) {
        setShowSugg(false)
      }
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  // Debounced suggestion fetch
  useEffect(() => {
    const q = value.trim()
    if (!q || looksLikeUrl(q)) {
      setSuggestions([])
      setHighlight(-1)
      return
    }
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    const id = window.setTimeout(async () => {
      const list = await fetchSuggestions(engineId, q, ctrl.signal)
      if (!ctrl.signal.aborted) {
        setSuggestions(list)
        setHighlight(-1)
      }
    }, 180)
    return () => {
      window.clearTimeout(id)
      ctrl.abort()
    }
  }, [value, engineId])

  const submit = (text: string) => {
    const q = text.trim()
    if (!q) return
    let url: string
    if (looksLikeUrl(q)) {
      url = normalizeUrl(q)
    } else {
      url = engine.searchUrl(q)
    }
    window.location.href = url
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (suggestions.length === 0) return
      setShowSugg(true)
      setHighlight((h) => (h + 1) % suggestions.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (suggestions.length === 0) return
      setShowSugg(true)
      setHighlight((h) => (h <= 0 ? suggestions.length - 1 : h - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (highlight >= 0 && suggestions[highlight]) submit(suggestions[highlight])
      else submit(value)
    } else if (e.key === 'Escape') {
      if (showSugg && suggestions.length > 0) {
        setShowSugg(false)
        setHighlight(-1)
      } else {
        setValue('')
        inputRef.current?.blur()
      }
    } else if (e.key === 'Tab' && highlight >= 0 && suggestions[highlight]) {
      e.preventDefault()
      setValue(suggestions[highlight])
      setHighlight(-1)
    }
  }

  const visibleSuggestions = useMemo(
    () => (showSugg && value.trim().length > 0 ? suggestions : []),
    [showSugg, suggestions, value],
  )

  return (
    <form
      ref={wrapRef}
      onSubmit={(e) => {
        e.preventDefault()
        submit(value)
      }}
      className="flex-1 max-w-2xl mx-auto relative"
    >
      <div className="relative flex items-stretch gap-1">
        {/* Engine picker */}
        <Popover open={enginePickerOpen} onOpenChange={setEnginePickerOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={t('quickSearch.engine')}
              title={engine.name}
              className="inline-flex items-center gap-1 h-10 pl-2 pr-1.5 rounded-l-full bg-white/10 hover:bg-white/20 backdrop-blur-xl border border-white/15 border-r-0 text-white text-xs font-semibold transition-colors"
            >
              <EngineLogo engineId={engine.id} size={20} />
              <ChevronDown className="h-3 w-3 opacity-70" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-60 p-1">
            <div className="px-2 py-1.5 text-[10px] uppercase tracking-widest text-white/55">
              {t('quickSearch.engine')}
            </div>
            <div className="space-y-0.5">
              {ENGINES.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => {
                    setEngine(e.id as SearchEngineId)
                    setEnginePickerOpen(false)
                    inputRef.current?.focus()
                  }}
                  className={cn(
                    'w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors',
                    engineId === e.id ? 'bg-white/15 text-white' : 'text-white/85 hover:bg-white/10',
                  )}
                >
                  <EngineLogo engineId={e.id} size={20} />
                  <span className="flex-1 text-left">
                    {e.name}
                    {e.alias && (
                      <span className="ml-1 text-[10px] text-white/45">· {e.alias}</span>
                    )}
                  </span>
                  {engineId === e.id && <Check className="h-3.5 w-3.5 text-emerald-300" />}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        {/* Input */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/55 pointer-events-none" />
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => {
              setValue(e.target.value)
              setShowSugg(true)
              setHighlight(-1)
            }}
            onFocus={() => setShowSugg(true)}
            onKeyDown={onKeyDown}
            placeholder={t('quickSearch.placeholder')}
            spellCheck={false}
            autoComplete="off"
            className="w-full h-10 pl-10 pr-10 rounded-r-full bg-white/10 hover:bg-white/15 focus:bg-white/15 backdrop-blur-xl border border-white/15 focus:border-white/35 text-white placeholder:text-white/45 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition-colors"
          />
          {value && (
            <button
              type="button"
              onClick={() => {
                setValue('')
                setSuggestions([])
                inputRef.current?.focus()
              }}
              aria-label={t('quickSearch.clear')}
              className="absolute right-3 top-1/2 -translate-y-1/2 inline-flex h-6 w-6 items-center justify-center rounded-full text-white/55 hover:text-white hover:bg-white/15"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Suggestions panel */}
      {visibleSuggestions.length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-30 rounded-2xl border border-white/15 bg-zinc-900/85 backdrop-blur-2xl shadow-[0_12px_40px_rgba(0,0,0,0.45)] overflow-hidden">
          {visibleSuggestions.map((s, i) => (
            <button
              key={`${s}-${i}`}
              type="button"
              onMouseEnter={() => setHighlight(i)}
              onMouseDown={(e) => {
                // mouseDown to fire before blur clears focus
                e.preventDefault()
                submit(s)
              }}
              className={cn(
                'w-full flex items-center gap-3 px-4 py-2 text-sm text-left transition-colors',
                highlight === i ? 'bg-white/15 text-white' : 'text-white/90 hover:bg-white/10',
              )}
            >
              <Search className="h-3.5 w-3.5 text-white/45 shrink-0" />
              <span className="flex-1 truncate">
                {highlightMatch(s, value)}
              </span>
              <ExternalLink className="h-3 w-3 text-white/35 shrink-0" />
            </button>
          ))}
          <div className="px-4 py-1.5 text-[10px] text-white/45 border-t border-white/10 flex items-center justify-between">
            <span>
              {t('quickSearch.via')} {engine.name}
            </span>
            <span>↑↓ {t('quickSearch.navigate')} · ↵ {t('quickSearch.open')} · Esc</span>
          </div>
        </div>
      )}
    </form>
  )
}

function EngineLogo({ engineId, size = 18 }: { engineId: string; size?: number }) {
  const engine = getEngine(engineId)
  return (
    <span
      aria-hidden
      className="inline-flex items-center justify-center rounded-full text-white font-bold shrink-0"
      style={{
        width: size,
        height: size,
        background: engine.color,
        fontSize: size * 0.55,
        lineHeight: 1,
      }}
    >
      {engine.letter}
    </span>
  )
}

function highlightMatch(text: string, query: string): React.ReactNode {
  const q = query.trim()
  if (!q) return text
  const idx = text.toLowerCase().indexOf(q.toLowerCase())
  if (idx < 0) return text
  return (
    <>
      {text.slice(0, idx)}
      <span className="font-semibold text-white">{text.slice(idx, idx + q.length)}</span>
      {text.slice(idx + q.length)}
    </>
  )
}
