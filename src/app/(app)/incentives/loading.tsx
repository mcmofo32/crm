import { SkeletonCardGrid, SkeletonHeader, SkeletonPage } from "@/components/Skeleton";

export default function IncentivesLoading() {
  return (
    <SkeletonPage>
      <SkeletonHeader />
      <SkeletonCardGrid cards={6} cardClassName="h-56" />
    </SkeletonPage>
  );
}
