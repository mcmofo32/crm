import { SkeletonHeader, SkeletonPage, SkeletonTable } from "@/components/Skeleton";

export default function GebruikersLoading() {
  return (
    <SkeletonPage>
      <SkeletonHeader />
      <SkeletonTable rows={8} />
    </SkeletonPage>
  );
}
