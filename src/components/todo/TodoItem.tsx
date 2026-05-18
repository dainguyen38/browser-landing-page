import { format, isPast, isToday, parseISO } from 'date-fns'
import { Pencil, Trash2 } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { Todo } from '@/store/todos'
import { useTodosStore } from '@/store/todos'
import { useT } from '@/i18n/useT'
import { cn } from '@/lib/utils'

interface Props {
  todo: Todo
  onEdit: (todo: Todo) => void
}

const PRIORITY_VARIANT: Record<Todo['priority'], 'secondary' | 'warning' | 'destructive'> = {
  low: 'secondary',
  medium: 'warning',
  high: 'destructive',
}

export const TODO_GRID = 'grid-cols-[24px_minmax(160px,1fr)_84px_104px_minmax(80px,140px)_64px]'

export function TodoItem({ todo, onEdit }: Props) {
  const { t, dateLocale } = useT()
  const toggle = useTodosStore((s) => s.toggle)
  const remove = useTodosStore((s) => s.remove)

  const due = todo.dueDate ? parseISO(todo.dueDate) : null
  const overdue = !!due && !todo.completed && isPast(due) && !isToday(due)
  const priorityLabel = t(
    todo.priority === 'low'
      ? 'todo.priorityLow'
      : todo.priority === 'medium'
      ? 'todo.priorityMed'
      : 'todo.priorityHigh',
  )

  return (
    <div
      className={cn(
        'grid items-center gap-3 px-3 py-2 border-b border-white/5 transition-colors group/row',
        TODO_GRID,
        overdue ? 'bg-rose-500/10 hover:bg-rose-500/15' : 'hover:bg-white/5',
      )}
    >
      <div className="flex items-center justify-center">
        <Checkbox checked={todo.completed} onCheckedChange={() => toggle(todo.id)} />
      </div>

      <button
        type="button"
        onClick={() => onEdit(todo)}
        className={cn(
          'text-left text-sm leading-snug text-white text-soft-shadow truncate hover:underline underline-offset-2',
          todo.completed && 'line-through text-white/50',
        )}
        title={todo.text}
      >
        {todo.text}
      </button>

      <div className="flex justify-start">
        <Badge variant={PRIORITY_VARIANT[todo.priority]}>{priorityLabel}</Badge>
      </div>

      <div className="text-xs tabular-nums">
        {due ? (
          <span className={cn(overdue ? 'text-rose-300 font-medium' : 'text-white/80')}>
            {format(due, 'd MMM yyyy', { locale: dateLocale })}
            {overdue && <span className="ml-1 text-[10px]">· {t('todo.overdue')}</span>}
          </span>
        ) : (
          <span className="text-white/30">—</span>
        )}
      </div>

      <div className="text-xs text-white/80 truncate">
        {todo.category ? todo.category : <span className="text-white/30">—</span>}
      </div>

      <div className="flex items-center justify-end opacity-0 group-hover/row:opacity-100 transition-opacity">
        <Button
          size="icon"
          variant="ghost"
          onClick={() => onEdit(todo)}
          aria-label={t('common.edit')}
          className="h-7 w-7"
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          onClick={() => remove(todo.id)}
          aria-label={t('common.delete')}
          className="h-7 w-7 text-rose-300 hover:text-rose-200"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}

export function TodoHeader() {
  const { t } = useT()
  return (
    <div
      className={cn(
        'grid items-center gap-3 px-3 py-2 text-[10px] uppercase tracking-wider text-white/50 border-b border-white/10',
        TODO_GRID,
      )}
    >
      <div></div>
      <div>{t('todo.title')}</div>
      <div>{t('todo.priority')}</div>
      <div>{t('todo.dueDate')}</div>
      <div>{t('todo.category')}</div>
      <div className="text-right">·</div>
    </div>
  )
}
