import { useCallback, useEffect, useState } from 'react'
import { Calculator as CalcIcon, Delete } from 'lucide-react'
import { GlassCard } from '@/components/layout/GlassCard'
import { useT } from '@/i18n/useT'
import { cn } from '@/lib/utils'

type Op = '+' | '-' | '×' | '÷'

interface State {
  display: string // current number being entered/shown
  previous: number | null
  operator: Op | null
  justEvaluated: boolean
  expression: string // history line shown above display
}

const INITIAL: State = {
  display: '0',
  previous: null,
  operator: null,
  justEvaluated: false,
  expression: '',
}

function format(n: number): string {
  if (!isFinite(n)) return 'Error'
  // up to 12 significant digits, strip trailing zeros
  if (Math.abs(n) >= 1e12 || (n !== 0 && Math.abs(n) < 1e-7)) {
    return n.toExponential(6).replace(/\.?0+e/, 'e')
  }
  const s = parseFloat(n.toPrecision(12)).toString()
  return s
}

function compute(a: number, op: Op, b: number): number {
  switch (op) {
    case '+': return a + b
    case '-': return a - b
    case '×': return a * b
    case '÷': return b === 0 ? NaN : a / b
  }
}

export function CalculatorWidget() {
  const { t } = useT()
  const [state, setState] = useState<State>(INITIAL)

  const inputDigit = useCallback((d: string) => {
    setState((s) => {
      if (s.display === 'Error') return { ...INITIAL, display: d }
      if (s.justEvaluated) return { ...INITIAL, display: d }
      if (s.display === '0') return { ...s, display: d }
      if (s.display.replace(/[^\d]/g, '').length >= 15) return s
      return { ...s, display: s.display + d }
    })
  }, [])

  const inputDecimal = useCallback(() => {
    setState((s) => {
      if (s.display === 'Error') return { ...INITIAL, display: '0.' }
      if (s.justEvaluated) return { ...INITIAL, display: '0.' }
      if (s.display.includes('.')) return s
      return { ...s, display: s.display + '.' }
    })
  }, [])

  const setOp = useCallback((op: Op) => {
    setState((s) => {
      if (s.display === 'Error') return INITIAL
      const cur = parseFloat(s.display)
      // chain: if there's a pending op + previous, compute first
      if (s.operator && s.previous !== null && !s.justEvaluated) {
        const result = compute(s.previous, s.operator, cur)
        const formatted = format(result)
        return {
          display: formatted,
          previous: result,
          operator: op,
          justEvaluated: false,
          expression: `${formatted} ${op}`,
        }
      }
      return {
        display: s.display,
        previous: cur,
        operator: op,
        justEvaluated: false,
        expression: `${format(cur)} ${op}`,
      }
    })
  }, [])

  const evaluate = useCallback(() => {
    setState((s) => {
      if (s.display === 'Error') return INITIAL
      if (s.operator === null || s.previous === null) return s
      const cur = parseFloat(s.display)
      const result = compute(s.previous, s.operator, cur)
      const formatted = format(result)
      return {
        display: formatted,
        previous: null,
        operator: null,
        justEvaluated: true,
        expression: `${format(s.previous)} ${s.operator} ${format(cur)} =`,
      }
    })
  }, [])

  const clearAll = useCallback(() => setState(INITIAL), [])

  const backspace = useCallback(() => {
    setState((s) => {
      if (s.display === 'Error') return INITIAL
      if (s.justEvaluated) return INITIAL
      if (s.display.length <= 1 || (s.display.startsWith('-') && s.display.length <= 2)) {
        return { ...s, display: '0' }
      }
      return { ...s, display: s.display.slice(0, -1) }
    })
  }, [])

  const negate = useCallback(() => {
    setState((s) => {
      if (s.display === 'Error') return s
      if (s.display === '0') return s
      const next = s.display.startsWith('-') ? s.display.slice(1) : '-' + s.display
      return { ...s, display: next }
    })
  }, [])

  const percent = useCallback(() => {
    setState((s) => {
      if (s.display === 'Error') return s
      const cur = parseFloat(s.display)
      const next = format(cur / 100)
      return { ...s, display: next }
    })
  }, [])

  // keyboard
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const active = document.activeElement
      if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) return
      if (e.key >= '0' && e.key <= '9') {
        inputDigit(e.key)
        e.preventDefault()
      } else if (e.key === '.' || e.key === ',') {
        inputDecimal()
        e.preventDefault()
      } else if (e.key === '+') {
        setOp('+')
        e.preventDefault()
      } else if (e.key === '-') {
        setOp('-')
        e.preventDefault()
      } else if (e.key === '*' || e.key === 'x' || e.key === 'X') {
        setOp('×')
        e.preventDefault()
      } else if (e.key === '/') {
        setOp('÷')
        e.preventDefault()
      } else if (e.key === '=' || e.key === 'Enter') {
        evaluate()
        e.preventDefault()
      } else if (e.key === 'Backspace') {
        backspace()
        e.preventDefault()
      } else if (e.key === 'Escape') {
        clearAll()
        e.preventDefault()
      } else if (e.key === '%') {
        percent()
        e.preventDefault()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [inputDigit, inputDecimal, setOp, evaluate, backspace, clearAll, percent])

  return (
    <GlassCard className="flex flex-col gap-3 min-h-0">
      <header className="flex items-center justify-between gap-2 pr-10 shrink-0">
        <div className="flex items-center gap-2">
          <CalcIcon className="h-4 w-4 text-white/80" />
          <h2 className="text-sm font-semibold tracking-wide uppercase text-white/90 text-soft-shadow">
            {t('calculator.title')}
          </h2>
        </div>
      </header>

      {/* Display */}
      <div className="rounded-xl bg-black/50 border border-white/15 px-3 py-2 shadow-inner flex flex-col items-end justify-end min-h-[64px] shrink-0">
        <div className="text-[11px] text-white/55 tabular-nums truncate w-full text-right min-h-4">
          {state.expression || ' '}
        </div>
        <div
          className={cn(
            'font-bold tabular-nums truncate w-full text-right text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]',
            state.display.length > 12 ? 'text-2xl' : state.display.length > 8 ? 'text-3xl' : 'text-4xl',
          )}
          title={state.display}
        >
          {state.display}
        </div>
      </div>

      {/* Buttons */}
      <div className="grid grid-cols-4 gap-2 flex-1 min-h-0">
        <CalcButton variant="action" onClick={clearAll} className="row-span-1">
          AC
        </CalcButton>
        <CalcButton variant="action" onClick={negate}>±</CalcButton>
        <CalcButton variant="action" onClick={percent}>%</CalcButton>
        <CalcButton variant="op" active={state.operator === '÷'} onClick={() => setOp('÷')}>÷</CalcButton>

        <CalcButton onClick={() => inputDigit('7')}>7</CalcButton>
        <CalcButton onClick={() => inputDigit('8')}>8</CalcButton>
        <CalcButton onClick={() => inputDigit('9')}>9</CalcButton>
        <CalcButton variant="op" active={state.operator === '×'} onClick={() => setOp('×')}>×</CalcButton>

        <CalcButton onClick={() => inputDigit('4')}>4</CalcButton>
        <CalcButton onClick={() => inputDigit('5')}>5</CalcButton>
        <CalcButton onClick={() => inputDigit('6')}>6</CalcButton>
        <CalcButton variant="op" active={state.operator === '-'} onClick={() => setOp('-')}>−</CalcButton>

        <CalcButton onClick={() => inputDigit('1')}>1</CalcButton>
        <CalcButton onClick={() => inputDigit('2')}>2</CalcButton>
        <CalcButton onClick={() => inputDigit('3')}>3</CalcButton>
        <CalcButton variant="op" active={state.operator === '+'} onClick={() => setOp('+')}>+</CalcButton>

        <CalcButton onClick={() => inputDigit('0')} className="col-span-1">0</CalcButton>
        <CalcButton onClick={backspace} aria-label="Backspace">
          <Delete className="h-4 w-4" />
        </CalcButton>
        <CalcButton onClick={inputDecimal}>.</CalcButton>
        <CalcButton variant="equals" onClick={evaluate}>=</CalcButton>
      </div>
    </GlassCard>
  )
}

interface CalcButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'number' | 'action' | 'op' | 'equals'
  active?: boolean
}

function CalcButton({
  variant = 'number',
  active = false,
  className,
  children,
  ...props
}: CalcButtonProps) {
  return (
    <button
      {...props}
      className={cn(
        'rounded-xl border border-white/10 font-semibold transition-all active:scale-95',
        'text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.15),0_2px_6px_rgba(0,0,0,0.25)]',
        'flex items-center justify-center select-none min-h-[40px]',
        variant === 'number' &&
          'bg-white/10 hover:bg-white/20 text-lg',
        variant === 'action' &&
          'bg-white/[0.18] hover:bg-white/30 text-white/90 text-base',
        variant === 'op' &&
          'bg-orange-500/80 hover:bg-orange-500 text-white text-xl',
        variant === 'op' &&
          active &&
          'bg-white text-orange-500 hover:bg-white',
        variant === 'equals' &&
          'bg-orange-500/90 hover:bg-orange-500 text-white text-xl',
        className,
      )}
    >
      {children}
    </button>
  )
}
