export default function FunnelLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="h-9 w-64 animate-pulse rounded-md bg-slate-200" />
        <div className="h-10 w-36 animate-pulse rounded-md bg-slate-200" />
      </div>
      <div className="h-14 w-full animate-pulse rounded-lg bg-slate-100" />
      <div className="flex gap-4 overflow-x-auto pb-2">
        {Array.from({ length: 6 }).map((_, col) => (
          <div
            key={col}
            className="flex w-72 shrink-0 flex-col gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3"
          >
            <div className="h-5 w-32 animate-pulse rounded bg-slate-200" />
            {Array.from({ length: 3 }).map((_, card) => (
              <div
                key={card}
                className="h-24 animate-pulse rounded-md bg-white shadow-sm ring-1 ring-slate-200"
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
