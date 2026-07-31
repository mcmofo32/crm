export default function LeadsLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="h-9 w-40 animate-pulse rounded-md bg-slate-200" />
        <div className="flex gap-2">
          <div className="h-11 w-32 animate-pulse rounded-md bg-slate-200" />
          <div className="h-11 w-40 animate-pulse rounded-md bg-slate-200" />
          <div className="h-11 w-36 animate-pulse rounded-md bg-slate-200" />
        </div>
      </div>
      <div className="h-14 w-full animate-pulse rounded-lg bg-slate-100" />
      <div className="flex items-center justify-between gap-3">
        <div className="h-8 w-52 animate-pulse rounded-full bg-slate-200" />
        <div className="h-10 w-72 animate-pulse rounded-md bg-slate-200" />
      </div>
      <div className="flex flex-col gap-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="h-16 w-full animate-pulse rounded-lg border border-slate-200 bg-slate-100"
          />
        ))}
      </div>
    </div>
  );
}
