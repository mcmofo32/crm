export default function TakenLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="h-9 w-56 animate-pulse rounded-md bg-slate-200" />
      <div className="h-8 w-72 animate-pulse rounded-full bg-slate-200" />
      <div className="flex flex-col gap-8">
        {Array.from({ length: 2 }).map((_, group) => (
          <div key={group} className="flex flex-col gap-2">
            <div className="h-6 w-40 animate-pulse rounded bg-slate-200" />
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-16 w-full animate-pulse rounded-lg border border-slate-200 bg-slate-100"
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
