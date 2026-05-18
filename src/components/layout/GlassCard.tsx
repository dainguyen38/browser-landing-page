import * as React from 'react'
import { cn } from '@/lib/utils'

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'soft' | 'strong' | 'sheer'
}

const VARIANT_CLASS: Record<NonNullable<GlassCardProps['variant']>, string> = {
  soft: 'glass',
  strong: 'glass-strong',
  sheer:
    'backdrop-blur-md bg-white/[0.04] border border-white/10 rounded-2xl text-white shadow-[0_4px_24px_rgba(0,0,0,0.18)]',
}

export const GlassCard = React.forwardRef<HTMLDivElement, GlassCardProps>(
  ({ className, variant = 'soft', ...props }, ref) => (
    <div
      ref={ref}
      className={cn(VARIANT_CLASS[variant], 'p-5 h-full w-full animate-fade-in', className)}
      {...props}
    />
  ),
)
GlassCard.displayName = 'GlassCard'
