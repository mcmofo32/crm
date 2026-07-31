import { SkeletonHeader, SkeletonPage, SkeletonTable } from "@/components/Skeleton";

export default function AuditlogLoading() {
  return (
    <SkeletonPage>
      <SkeletonHeader />
      <SkeletonTable rows={10} />
    </SkeletonPage>
  );
}
