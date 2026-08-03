import { SkeletonBlock, SkeletonHeader, SkeletonPage } from "@/components/Skeleton";

export default function UserDoelenLoading() {
  return (
    <SkeletonPage>
      <SkeletonHeader />
      <SkeletonBlock className="h-64 rounded-lg border border-slate-200" />
      <SkeletonBlock className="h-56 rounded-lg border border-slate-200" />
    </SkeletonPage>
  );
}
