import { SkeletonForm, SkeletonHeader, SkeletonPage } from "@/components/Skeleton";

export default function NewLeadLoading() {
  return (
    <SkeletonPage>
      <SkeletonHeader />
      <SkeletonForm fields={7} />
    </SkeletonPage>
  );
}
