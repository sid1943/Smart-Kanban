interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse bg-dark-700 rounded ${className}`}
      aria-hidden="true"
    />
  );
}

export function TaskSkeleton() {
  return (
    <div className="p-4 bg-dark-800 rounded-xl border border-dark-700">
      <div className="flex items-start gap-3">
        <Skeleton className="w-5 h-5 rounded-full flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
        <Skeleton className="w-6 h-6 rounded" />
      </div>
    </div>
  );
}

export function TaskListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-3" role="status" aria-label="Loading tasks">
      {Array.from({ length: count }).map((_, i) => (
        <TaskSkeleton key={i} />
      ))}
      <span className="sr-only">Loading tasks...</span>
    </div>
  );
}

export function MessageSkeleton({ isUser = false }: { isUser?: boolean }) {
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] p-4 rounded-2xl ${
          isUser
            ? 'bg-accent/20 rounded-br-md'
            : 'bg-dark-800 rounded-bl-md border border-dark-700'
        }`}
      >
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </div>
    </div>
  );
}

export function ChatSkeleton() {
  return (
    <div className="space-y-4 p-4" role="status" aria-label="Loading messages">
      <MessageSkeleton />
      <MessageSkeleton isUser />
      <MessageSkeleton />
      <span className="sr-only">Loading conversation...</span>
    </div>
  );
}

export function IdeaCardSkeleton() {
  return (
    <div className="bg-[#22272b] rounded-xl border border-[#3d444d] overflow-hidden">
      <div className="p-4 border-b border-[#3d444d]">
        <div className="flex items-center gap-3">
          <Skeleton className="w-8 h-8 rounded-lg" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-32" />
          </div>
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>
      </div>
      <div className="p-4 space-y-3">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
        <div className="flex gap-2 pt-2">
          <Skeleton className="h-6 w-16 rounded-full" />
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
      </div>
    </div>
  );
}

export function IdeasGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div
      className="grid grid-cols-1 lg:grid-cols-2 gap-4"
      role="status"
      aria-label="Loading ideas"
    >
      {Array.from({ length: count }).map((_, i) => (
        <IdeaCardSkeleton key={i} />
      ))}
      <span className="sr-only">Loading ideas...</span>
    </div>
  );
}

export function SidebarSkeleton() {
  return (
    <aside className="w-72 h-screen bg-dark-900 border-r border-dark-800 p-4">
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Skeleton className="w-10 h-10 rounded-xl" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
        <Skeleton className="h-10 w-full rounded-xl" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-20" />
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full rounded-xl" />
          ))}
        </div>
      </div>
    </aside>
  );
}

export function StatCardSkeleton() {
  return (
    <div className="bg-[#22272b] rounded-xl p-4 border border-[#3d444d]">
      <div className="flex items-center gap-3">
        <Skeleton className="w-10 h-10 rounded-lg" />
        <div className="space-y-2">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-6 w-8" />
        </div>
      </div>
    </div>
  );
}
