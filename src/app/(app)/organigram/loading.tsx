import { SkeletonBlock, SkeletonHeader, SkeletonPage } from "@/components/Skeleton";

export default function OrganigramLoading() {
  return (
    <SkeletonPage>
      <SkeletonHeader />
      <SkeletonBlock className="h-96 rounded-lg border border-slate-200" />
    </SkeletonPage>
  );
}
