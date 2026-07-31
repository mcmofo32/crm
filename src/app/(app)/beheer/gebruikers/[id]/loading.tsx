import { SkeletonForm, SkeletonHeader, SkeletonPage } from "@/components/Skeleton";

export default function GebruikerDetailLoading() {
  return (
    <SkeletonPage>
      <SkeletonHeader />
      <SkeletonForm fields={5} />
    </SkeletonPage>
  );
}
