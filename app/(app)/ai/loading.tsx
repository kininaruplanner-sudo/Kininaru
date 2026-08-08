import { Skeleton } from '@/components/ui/skeleton-card'

export default function AiLoading() {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-8 w-8 rounded-full" />
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-4">
        <div className="max-w-2xl mx-auto space-y-4">
          <Skeleton className="h-16 w-2/3 rounded-2xl" />
          <Skeleton className="h-10 w-1/2 rounded-2xl ml-auto" />
          <Skeleton className="h-20 w-3/4 rounded-2xl" />
        </div>
      </div>

      <div className="p-4 border-t border-border">
        <Skeleton className="h-11 max-w-2xl mx-auto rounded-xl" />
      </div>
    </div>
  )
}
