import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Priority, Todo } from '@/store/todos'
import { useT } from '@/i18n/useT'

type Submit = (data: {
  text: string
  priority: Priority
  dueDate?: string
  category?: string
}) => void

interface Props {
  open: boolean
  initial?: Todo | null
  onOpenChange: (open: boolean) => void
  onSubmit: Submit
}

export function TodoDialog({ open, initial, onOpenChange, onSubmit }: Props) {
  const { t } = useT()
  const [text, setText] = useState('')
  const [priority, setPriority] = useState<Priority>('medium')
  const [dueDate, setDueDate] = useState('')
  const [category, setCategory] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setText(initial?.text ?? '')
    setPriority(initial?.priority ?? 'medium')
    setDueDate(initial?.dueDate ? initial.dueDate.slice(0, 10) : '')
    setCategory(initial?.category ?? '')
    setError(null)
  }, [open, initial])

  const submit = () => {
    const value = text.trim()
    if (!value) {
      setError(t('todo.placeholder'))
      return
    }
    onSubmit({
      text: value,
      priority,
      dueDate: dueDate || undefined,
      category: category.trim() || undefined,
    })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initial ? t('common.edit') : t('todo.add')}</DialogTitle>
          <DialogDescription>{t('todo.placeholder')}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-1.5">
            <Label htmlFor="todo-text">{t('todo.placeholder')}</Label>
            <Input
              id="todo-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={t('todo.placeholder')}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') submit()
              }}
            />
            {error && <div className="text-xs text-rose-300">{error}</div>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>{t('todo.priority')}</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">{t('todo.priorityLow')}</SelectItem>
                  <SelectItem value="medium">{t('todo.priorityMed')}</SelectItem>
                  <SelectItem value="high">{t('todo.priorityHigh')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="todo-due">{t('todo.dueDate')}</Label>
              <input
                id="todo-due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="h-9 rounded-md border border-white/20 bg-white/10 px-3 text-sm text-white [color-scheme:dark]"
              />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="todo-category">
              {t('todo.category')}{' '}
              <span className="text-white/50 text-xs">({t('common.optional')})</span>
            </Label>
            <Input
              id="todo-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder={t('todo.categoryPh')}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button onClick={submit}>{t('common.save')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
