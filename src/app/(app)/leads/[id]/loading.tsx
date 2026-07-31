export default function LeadDetailLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 animate-pulse rounded-full bg-slate-200" />
        <div>
          <div className="h-7 w-56 animate-pulse rounded-md bg-slate-200" />
          <div className="mt-2 h-5 w-32 animate-pulse rounded-full bg-slate-100" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          <div className="h-48 animate-pulse rounded-lg border border-slate-200 bg-slate-100" />
          <div className="h-72 animate-pulse rounded-lg border border-slate-200 bg-slate-100" />
        </div>
        <div className="flex flex-col gap-4">
          <div className="h-40 animate-pulse rounded-lg border border-slate-200 bg-slate-100" />
          <div className="h-40 animate-pulse rounded-lg border border-slate-200 bg-slate-100" />
        </div>
      </div>
    </div>
  );
}
