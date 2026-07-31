import { SkeletonCardGrid, SkeletonHeader, SkeletonPage, SkeletonTable } from "@/components/Skeleton";

export default function AnalyseLoading() {
  return (
    <SkeletonPage>
      <SkeletonHeader />
      <SkeletonCardGrid cards={2} columns="lg:grid-cols-2" cardClassName="h-40" />
      <SkeletonTable rows={6} />
    </SkeletonPage>
  );
}
