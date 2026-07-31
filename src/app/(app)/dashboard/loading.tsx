export default function DashboardLoading() {
  return (
    <div className="flex flex-col gap-10">
      <div>
        <div className="h-9 w-64 animate-pulse rounded-md bg-slate-200" />
        <div className="mt-2 h-5 w-96 animate-pulse rounded-md bg-slate-100" />
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-32 animate-pulse rounded-xl border border-slate-200 bg-slate-100"
          />
        ))}
      </div>

      <div>
        <div className="mb-4 h-6 w-48 animate-pulse rounded bg-slate-200" />
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-16 animate-pulse border-b border-slate-100 bg-slate-50 last:border-0"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
