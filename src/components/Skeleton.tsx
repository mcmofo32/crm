function cx(...classes: (string | false | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

export function SkeletonBlock({ className }: { className?: string }) {
  return (
    <div className={cx("animate-pulse rounded-md bg-slate-200", className)} />
  );
}

export function SkeletonHeader({
  titleClassName = "h-9 w-64",
  subtitleClassName = "h-5 w-96",
}: {
  titleClassName?: string;
  subtitleClassName?: string;
}) {
  return (
    <div>
      <SkeletonBlock className={titleClassName} />
      <SkeletonBlock className={cx("mt-2 bg-slate-100", subtitleClassName)} />
    </div>
  );
}

export function SkeletonTable({ rows = 6 }: { rows?: number }) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="h-11 animate-pulse bg-slate-50" />
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="h-14 animate-pulse border-t border-slate-100 bg-slate-100/60"
        />
      ))}
    </div>
  );
}

export function SkeletonCardGrid({
  cards = 6,
  columns = "sm:grid-cols-2 xl:grid-cols-3",
  cardClassName = "h-40",
}: {
  cards?: number;
  columns?: string;
  cardClassName?: string;
}) {
  return (
    <div className={cx("grid grid-cols-1 gap-6", columns)}>
      {Array.from({ length: cards }).map((_, i) => (
        <SkeletonBlock
          key={i}
          className={cx("rounded-xl border border-slate-200", cardClassName)}
        />
      ))}
    </div>
  );
}

export function SkeletonForm({ fields = 5 }: { fields?: number }) {
  return (
    <div className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-6">
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i} className="flex flex-col gap-1.5">
          <SkeletonBlock className="h-4 w-32 bg-slate-100" />
          <SkeletonBlock className="h-10 w-full" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonPage({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="flex flex-col gap-6">{children}</div>;
}
