import { SkeletonHeader, SkeletonPage, SkeletonTable } from "@/components/Skeleton";

export default function BulkLeadLoading() {
  return (
    <SkeletonPage>
      <SkeletonHeader />
      <SkeletonTable rows={8} />
    </SkeletonPage>
  );
}
