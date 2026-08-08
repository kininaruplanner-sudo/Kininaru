import { Skeleton } from '@/components/ui/skeleton-card'

export default function HabitsLoading() {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card">
        <div className="space-y-1.5">
          <Skeleton className="h-6 w-28" />
          <Skeleton className="h-3 w-40" />
        </div>
        <Skeleton className="h-8 w-28 rounded-xl" />
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-2xl" />
          ))}
        </div>
      </div>
    </div>
  )
}
