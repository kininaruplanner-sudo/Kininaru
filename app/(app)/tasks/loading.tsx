import { Skeleton } from '@/components/ui/skeleton-card'

export default function TasksLoading() {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card">
        <div className="space-y-1.5">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-3 w-32" />
        </div>
        <Skeleton className="h-8 w-28 rounded-xl" />
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-3xl mx-auto space-y-3">
          <div className="flex gap-2 mb-4">
            <Skeleton className="h-8 w-20 rounded-lg" />
            <Skeleton className="h-8 w-20 rounded-lg" />
            <Skeleton className="h-8 w-20 rounded-lg" />
          </div>
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-2xl" />
          ))}
        </div>
      </div>
    </div>
  )
}
