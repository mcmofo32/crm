import { SkeletonHeader, SkeletonPage, SkeletonTable } from "@/components/Skeleton";

export default function ProductieLoading() {
  return (
    <SkeletonPage>
      <SkeletonHeader />
      <SkeletonTable rows={10} />
    </SkeletonPage>
  );
}
