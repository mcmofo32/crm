import { SkeletonHeader, SkeletonPage, SkeletonTable } from "@/components/Skeleton";

export default function EvenementenLoading() {
  return (
    <SkeletonPage>
      <SkeletonHeader />
      <SkeletonTable rows={5} />
    </SkeletonPage>
  );
}
