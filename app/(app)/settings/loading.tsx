import { Skeleton } from '@/components/ui/skeleton-card'

export default function SettingsLoading() {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card">
        <Skeleton className="h-6 w-28" />
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-2xl mx-auto space-y-4">
          <Skeleton className="h-40 rounded-2xl" />
          <Skeleton className="h-32 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
        </div>
      </div>
    </div>
  )
}
