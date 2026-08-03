import { SkeletonHeader, SkeletonPage, SkeletonTable } from "@/components/Skeleton";

export default function ProductieDoelenLoading() {
  return (
    <SkeletonPage>
      <SkeletonHeader />
      <SkeletonTable rows={8} />
    </SkeletonPage>
  );
}
