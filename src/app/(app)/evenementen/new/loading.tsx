import { SkeletonForm, SkeletonHeader, SkeletonPage } from "@/components/Skeleton";

export default function NewEventLoading() {
  return (
    <SkeletonPage>
      <SkeletonHeader />
      <SkeletonForm fields={5} />
    </SkeletonPage>
  );
}
