import { SkeletonHeader, SkeletonPage, SkeletonTable } from "@/components/Skeleton";

export default function ProductieDoelenLoading() {
  return (
    <SkeletonPage>
      <SkeletonHeader />
      <SkeletonTable rows={12} />
    </SkeletonPage>
  );
}
