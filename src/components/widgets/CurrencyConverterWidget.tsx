import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowRightLeft, ArrowUpDown, RefreshCw, AlertCircle } from 'lucide-react'
import { GlassCard } from '@/components/layout/GlassCard'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useT } from '@/i18n/useT'
import { CURRENCIES, fetchRates, getCurrency } from '@/lib/currency'

const QUICK_PRESETS = ['vnd', 'usd', 'eur', 'jpy', 'cny', 'krw']

export function CurrencyConverterWidget() {
  const { t } = useT()
  const [from, setFrom] = useState('usd')
  const [to, setTo] = useState('vnd')
  const [amount, setAmount] = useState('1')
  const [rate, setRate] = useState<number | null>(null)
  const [date, setDate] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(
    async (force = false) => {
      setLoading(true)
      setError(null)
      try {
        const { rates, date } = await fetchRates(from, force)
        const r = rates[to]
        if (r === undefined) throw new Error(`No rate for ${to}`)
        setRate(r)
        setDate(date)
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      } finally {
        setLoading(false)
      }
    },
    [from, to],
  )

  useEffect(() => {
    refresh()
  }, [refresh])

  const numAmount = parseFloat(amount) || 0
  const converted = rate !== null ? numAmount * rate : null
  const reverseRate = rate !== null && rate !== 0 ? 1 / rate : null

  const swap = () => {
    setFrom(to)
    setTo(from)
  }

  const fromInfo = getCurrency(from)
  const toInfo = getCurrency(to)

  const formatTo = useMemo(() => {
    if (converted === null) return ''
    const isCrypto = ['btc', 'eth'].includes(to)
    const fractionDigits = isCrypto
      ? Math.abs(converted) < 1
        ? 8
        : 4
      : toInfo.noFraction
      ? 0
      : 2
    return converted.toLocaleString(undefined, {
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    })
  }, [converted, to, toInfo.noFraction])

  return (
    <GlassCard className="flex flex-col gap-3 min-h-0">
      <header className="flex items-center justify-between gap-2 pr-10 shrink-0">
        <div className="flex items-center gap-2">
          <ArrowRightLeft className="h-4 w-4 text-emerald-200" />
          <h2 className="text-sm font-semibold tracking-wide uppercase text-white/90 text-soft-shadow">
            {t('fx.title')}
          </h2>
        </div>
        <Button
          size="icon"
          variant="ghost"
          onClick={() => refresh(true)}
          disabled={loading}
          aria-label={t('fx.refresh')}
          className="h-7 w-7"
        >
          <RefreshCw className={loading ? 'h-3.5 w-3.5 animate-spin' : 'h-3.5 w-3.5'} />
        </Button>
      </header>

      <div className="flex-1 min-h-0 overflow-auto pr-1 space-y-2">
        {/* From */}
        <Row
          label={t('fx.from')}
          amount={amount}
          editable
          onAmountChange={setAmount}
          currency={from}
          onCurrencyChange={setFrom}
        />

        {/* Swap */}
        <div className="flex justify-center -my-1">
          <Button
            size="icon"
            variant="secondary"
            onClick={swap}
            aria-label={t('fx.swap')}
            className="h-8 w-8 rounded-full"
          >
            <ArrowUpDown className="h-4 w-4" />
          </Button>
        </div>

        {/* To */}
        <Row
          label={t('fx.to')}
          amount={formatTo}
          editable={false}
          onAmountChange={() => {}}
          currency={to}
          onCurrencyChange={setTo}
        />

        {/* Rate display */}
        {rate !== null && reverseRate !== null && !error && (
          <div className="rounded-xl border border-white/10 bg-black/25 p-3 text-xs space-y-1 tabular-nums">
            <div className="flex items-center justify-between">
              <span className="text-white/65">
                1 {fromInfo.code.toUpperCase()} =
              </span>
              <span className="font-semibold text-emerald-200">
                {rate.toLocaleString(undefined, {
                  maximumFractionDigits: rate < 1 ? 6 : 4,
                })}{' '}
                {toInfo.code.toUpperCase()}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-white/65">
                1 {toInfo.code.toUpperCase()} =
              </span>
              <span className="font-medium text-white/85">
                {reverseRate.toLocaleString(undefined, {
                  maximumFractionDigits: reverseRate < 1 ? 6 : 4,
                })}{' '}
                {fromInfo.code.toUpperCase()}
              </span>
            </div>
            {date && (
              <div className="text-[10px] text-white/45 pt-0.5">
                {t('fx.updated')} {date}
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="flex items-start gap-1.5 text-[10px] text-amber-300/80">
            <AlertCircle className="h-3 w-3 shrink-0 mt-0.5" />
            <span>{rate !== null ? t('fx.stale') : error}</span>
          </div>
        )}

        {/* Quick presets */}
        <div>
          <div className="text-[10px] uppercase tracking-widest text-white/55 mb-1.5">
            {t('fx.quickTo')}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {QUICK_PRESETS.filter((c) => c !== to).map((c) => {
              const info = getCurrency(c)
              return (
                <button
                  key={c}
                  onClick={() => setTo(c)}
                  className="inline-flex items-center gap-1 h-7 px-2 rounded-md bg-white/10 hover:bg-white/20 border border-white/15 text-xs"
                >
                  <span>{info.flag}</span>
                  <span>{info.code.toUpperCase()}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </GlassCard>
  )
}

interface RowProps {
  label: string
  amount: string
  editable: boolean
  onAmountChange: (v: string) => void
  currency: string
  onCurrencyChange: (v: string) => void
}

function Row({ label, amount, editable, onAmountChange, currency, onCurrencyChange }: RowProps) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-2.5">
      <div className="text-[9px] uppercase tracking-widest text-white/55 mb-1">{label}</div>
      <div className="flex items-stretch gap-2">
        <input
          type={editable ? 'number' : 'text'}
          inputMode="decimal"
          value={amount}
          readOnly={!editable}
          onChange={(e) => onAmountChange(e.target.value)}
          className="flex-1 min-w-0 bg-transparent text-2xl font-bold tabular-nums text-white focus:outline-none placeholder:text-white/30"
          placeholder="0"
        />
        <Select value={currency} onValueChange={onCurrencyChange}>
          <SelectTrigger className="h-10 w-32 shrink-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CURRENCIES.map((c) => (
              <SelectItem key={c.code} value={c.code}>
                <span className="mr-1.5">{c.flag}</span>
                {c.code.toUpperCase()}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
