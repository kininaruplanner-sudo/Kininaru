import { Skeleton } from '@/components/ui/skeleton-card'

export default function AchievementsLoading() {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card">
        <Skeleton className="h-6 w-36" />
        <Skeleton className="h-8 w-24 rounded-xl" />
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-4xl mx-auto grid grid-cols-2 sm:grid-cols-3 gap-4">
          {Array.from({ length: 9 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-2xl" />
          ))}
        </div>
      </div>
    </div>
  )
}
