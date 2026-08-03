import { SkeletonCardGrid, SkeletonHeader, SkeletonPage } from "@/components/Skeleton";

export default function DashboardLoading() {
  return (
    <SkeletonPage>
      <SkeletonHeader />
      <SkeletonCardGrid cards={5} columns="sm:grid-cols-2 xl:grid-cols-5" cardClassName="h-32" />
      <div>
        <div className="mb-4 h-6 w-48 animate-pulse rounded bg-slate-200" />
        <SkeletonCardGrid cards={4} columns="sm:grid-cols-2 xl:grid-cols-4" cardClassName="h-32" />
      </div>
    </SkeletonPage>
  );
}
