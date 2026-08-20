import { SkeletonHeader, SkeletonPage, SkeletonTable } from "@/components/Skeleton";

export default function LoginSessiesLoading() {
  return (
    <SkeletonPage>
      <SkeletonHeader />
      <SkeletonTable rows={10} />
    </SkeletonPage>
  );
}
