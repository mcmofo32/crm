import { SkeletonCardGrid, SkeletonHeader, SkeletonPage } from "@/components/Skeleton";

export default function TeamsLoading() {
  return (
    <SkeletonPage>
      <SkeletonHeader />
      <SkeletonCardGrid cards={4} columns="lg:grid-cols-2" cardClassName="h-48" />
    </SkeletonPage>
  );
}
