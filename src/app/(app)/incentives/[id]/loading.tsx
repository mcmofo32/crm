import { SkeletonBlock, SkeletonHeader, SkeletonPage, SkeletonTable } from "@/components/Skeleton";

export default function IncentiveDetailLoading() {
  return (
    <SkeletonPage>
      <SkeletonHeader />
      <SkeletonBlock className="h-56 rounded-lg border border-slate-200" />
      <SkeletonTable rows={5} />
    </SkeletonPage>
  );
}
