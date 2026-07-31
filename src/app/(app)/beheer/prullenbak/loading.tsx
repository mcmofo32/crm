import { SkeletonHeader, SkeletonPage, SkeletonTable } from "@/components/Skeleton";

export default function PrullenbakLoading() {
  return (
    <SkeletonPage>
      <SkeletonHeader />
      <SkeletonTable rows={6} />
    </SkeletonPage>
  );
}
