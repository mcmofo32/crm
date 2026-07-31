import { SkeletonForm, SkeletonHeader, SkeletonPage } from "@/components/Skeleton";

export default function NewGebruikerLoading() {
  return (
    <SkeletonPage>
      <SkeletonHeader />
      <SkeletonForm fields={5} />
    </SkeletonPage>
  );
}
