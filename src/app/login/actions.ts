"use server";

import { signIn } from "@/lib/auth";

export async function loginWithGoogleAction(formData: FormData) {
  const callbackUrl = String(formData.get("callbackUrl") ?? "/dashboard");
  await signIn("google", { redirectTo: callbackUrl || "/dashboard" });
}
