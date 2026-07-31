export default function KlantenLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="h-9 w-56 animate-pulse rounded-md bg-slate-200" />
      </div>
      <div className="h-14 w-full animate-pulse rounded-lg bg-slate-100" />
      <div className="flex items-center justify-between gap-3">
        <div className="h-8 w-52 animate-pulse rounded-full bg-slate-200" />
        <div className="h-10 w-72 animate-pulse rounded-md bg-slate-200" />
      </div>
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="h-14 w-full animate-pulse border-b border-slate-100 bg-slate-50 last:border-b-0"
          />
        ))}
      </div>
    </div>
  );
}
