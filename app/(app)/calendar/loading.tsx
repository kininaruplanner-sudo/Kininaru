import { Skeleton } from '@/components/ui/skeleton-card'

export default function CalendarLoading() {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-8 w-32 rounded-xl" />
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-7 gap-2 mb-3">
            {Array.from({ length: 7 }).map((_, i) => (
              <Skeleton key={i} className="h-4 rounded" />
            ))}
          </div>
          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: 35 }).map((_, i) => (
              <Skeleton key={i} className="aspect-square rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
