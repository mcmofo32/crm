import { SkeletonHeader, SkeletonPage, SkeletonTable } from "@/components/Skeleton";

export default function DuplicatenLoading() {
  return (
    <SkeletonPage>
      <SkeletonHeader />
      <SkeletonTable rows={6} />
    </SkeletonPage>
  );
}
