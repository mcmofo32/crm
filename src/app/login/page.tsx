import { LoginForm } from "./LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const { callbackUrl } = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="mb-1 text-xl font-semibold text-slate-900">CRM</h1>
        <p className="mb-6 text-sm text-slate-500">
          Meld je aan om leads op te volgen.
        </p>
        <LoginForm callbackUrl={callbackUrl ?? "/dashboard"} />
      </div>
    </div>
  );
}
