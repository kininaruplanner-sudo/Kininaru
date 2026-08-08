import { Skeleton } from '@/components/ui/skeleton-card'

export default function JournalLoading() {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card">
        <Skeleton className="h-6 w-28" />
        <Skeleton className="h-8 w-8 rounded-full" />
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-2xl mx-auto space-y-4">
          <div className="flex gap-2 justify-center">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="size-9 rounded-full" />
            ))}
          </div>
          <Skeleton className="h-48 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
        </div>
      </div>
    </div>
  )
}
