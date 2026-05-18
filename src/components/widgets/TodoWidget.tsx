import { useMemo, useState } from 'react'
import { CheckSquare, Plus } from 'lucide-react'
import { parseISO } from 'date-fns'
import { GlassCard } from '@/components/layout/GlassCard'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { TodoItem, TodoHeader } from '@/components/todo/TodoItem'
import { TodoSortSelect } from '@/components/todo/TodoFilters'
import { TodoDialog } from '@/components/todo/TodoDialog'
import { useTodosStore, type Todo, type TodoFilter } from '@/store/todos'
import { useT } from '@/i18n/useT'

const PRIORITY_RANK: Record<Todo['priority'], number> = { high: 0, medium: 1, low: 2 }

function sortTodos(todos: Todo[], sort: 'createdAt' | 'dueDate' | 'priority'): Todo[] {
  const arr = [...todos]
  if (sort === 'createdAt') {
    arr.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  } else if (sort === 'dueDate') {
    arr.sort((a, b) => {
      if (!a.dueDate && !b.dueDate) return b.createdAt.localeCompare(a.createdAt)
      if (!a.dueDate) return 1
      if (!b.dueDate) return -1
      return parseISO(a.dueDate).getTime() - parseISO(b.dueDate).getTime()
    })
  } else if (sort === 'priority') {
    arr.sort((a, b) => {
      const diff = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]
      return diff !== 0 ? diff : b.createdAt.localeCompare(a.createdAt)
    })
  }
  return arr
}

function applyFilter(todos: Todo[], filter: TodoFilter): Todo[] {
  if (filter === 'active') return todos.filter((t) => !t.completed)
  if (filter === 'completed') return todos.filter((t) => t.completed)
  return todos
}

export function TodoWidget() {
  const { t } = useT()
  const todos = useTodosStore((s) => s.todos)
  const filter = useTodosStore((s) => s.filter)
  const sort = useTodosStore((s) => s.sort)
  const setFilter = useTodosStore((s) => s.setFilter)
  const clearCompleted = useTodosStore((s) => s.clearCompleted)
  const addTodo = useTodosStore((s) => s.add)
  const updateTodo = useTodosStore((s) => s.update)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Todo | null>(null)

  const visible = useMemo(() => sortTodos(applyFilter(todos, filter), sort), [todos, filter, sort])
  const hasCompleted = todos.some((todo) => todo.completed)

  const openAdd = () => {
    setEditing(null)
    setDialogOpen(true)
  }
  const openEdit = (todo: Todo) => {
    setEditing(todo)
    setDialogOpen(true)
  }
  const handleSubmit = (data: {
    text: string
    priority: Todo['priority']
    dueDate?: string
    category?: string
  }) => {
    if (editing) {
      updateTodo(editing.id, data)
    } else {
      addTodo(data)
    }
  }

  return (
    <GlassCard className="flex flex-col gap-3 min-h-0">
      <header className="flex items-center justify-between gap-2 pr-10 shrink-0">
        <div className="flex items-center gap-2">
          <CheckSquare className="h-4 w-4 text-white/80" />
          <h2 className="text-sm font-semibold tracking-wide uppercase text-white/90 text-soft-shadow">
            {t('todo.title')}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <TodoSortSelect />
          <Button size="sm" variant="secondary" onClick={openAdd}>
            <Plus className="h-3.5 w-3.5" />
            {t('todo.add')}
          </Button>
        </div>
      </header>

      <Tabs value={filter} onValueChange={(v) => setFilter(v as TodoFilter)} className="shrink-0">
        <TabsList className="w-full">
          <TabsTrigger value="all" className="flex-1">
            {t('todo.tabAll')}
          </TabsTrigger>
          <TabsTrigger value="active" className="flex-1">
            {t('todo.tabActive')}
          </TabsTrigger>
          <TabsTrigger value="completed" className="flex-1">
            {t('todo.tabDone')}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="flex-1 min-h-0 overflow-auto rounded-lg border border-white/10 bg-white/[0.03]">
        {visible.length === 0 ? (
          <div className="p-6 text-center text-sm text-white/70">{t('todo.empty')}</div>
        ) : (
          <>
            <TodoHeader />
            {visible.map((todo) => (
              <TodoItem key={todo.id} todo={todo} onEdit={openEdit} />
            ))}
          </>
        )}
      </div>

      {hasCompleted && (
        <div className="flex justify-end shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={clearCompleted}
            className="text-white/70 hover:text-white"
          >
            {t('todo.clearCompleted')}
          </Button>
        </div>
      )}

      <TodoDialog
        open={dialogOpen}
        initial={editing}
        onOpenChange={setDialogOpen}
        onSubmit={handleSubmit}
      />
    </GlassCard>
  )
}
