import { SkeletonForm, SkeletonHeader, SkeletonPage } from "@/components/Skeleton";

export default function NewIncentiveLoading() {
  return (
    <SkeletonPage>
      <SkeletonHeader />
      <SkeletonForm fields={6} />
    </SkeletonPage>
  );
}
