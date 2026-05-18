import { ArrowDownAZ } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useTodosStore, type TodoSort } from '@/store/todos'
import { useT } from '@/i18n/useT'

export function TodoSortSelect() {
  const { t } = useT()
  const sort = useTodosStore((s) => s.sort)
  const setSort = useTodosStore((s) => s.setSort)
  return (
    <Select value={sort} onValueChange={(v) => setSort(v as TodoSort)}>
      <SelectTrigger className="h-8 w-auto gap-1 px-2 text-xs">
        <ArrowDownAZ className="h-3.5 w-3.5" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="createdAt">{t('todo.sortCreated')}</SelectItem>
        <SelectItem value="dueDate">{t('todo.sortDue')}</SelectItem>
        <SelectItem value="priority">{t('todo.sortPriority')}</SelectItem>
      </SelectContent>
    </Select>
  )
}
