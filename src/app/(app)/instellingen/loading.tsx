import { SkeletonBlock, SkeletonHeader, SkeletonPage } from "@/components/Skeleton";

export default function InstellingenLoading() {
  return (
    <SkeletonPage>
      <SkeletonHeader />
      <SkeletonBlock className="h-40 rounded-lg border border-slate-200" />
      <SkeletonBlock className="h-24 rounded-lg border border-slate-200" />
    </SkeletonPage>
  );
}
