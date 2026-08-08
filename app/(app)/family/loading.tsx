import { Skeleton } from '@/components/ui/skeleton-card'

export default function FamilyLoading() {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card">
        <div className="space-y-1.5">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-3 w-40" />
        </div>
        <Skeleton className="h-8 w-8 rounded-full" />
      </div>

      <div className="flex gap-4 px-6 py-3 border-b border-border bg-card">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-4 w-16" />
        ))}
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-4xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-2xl" />
          ))}
        </div>
      </div>
    </div>
  )
}
