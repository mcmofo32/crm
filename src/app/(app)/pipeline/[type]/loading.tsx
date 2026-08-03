import { SkeletonCardGrid, SkeletonHeader, SkeletonPage, SkeletonTable } from "@/components/Skeleton";

export default function PipelineLoading() {
  return (
    <SkeletonPage>
      <SkeletonHeader />
      <SkeletonCardGrid cards={3} columns="sm:grid-cols-3" cardClassName="h-28" />
      <SkeletonTable rows={8} />
    </SkeletonPage>
  );
}
