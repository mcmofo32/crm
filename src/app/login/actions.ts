"use server";

import { AuthError } from "next-auth";
import { signIn } from "@/lib/auth";

export type LoginState = { error?: string } | undefined;

export async function loginAction(
  _prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const callbackUrl = String(formData.get("callbackUrl") ?? "/dashboard");

  try {
    await signIn("credentials", {
      email,
      password,
      redirectTo: callbackUrl || "/dashboard",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Ongeldig e-mailadres of wachtwoord." };
    }
    throw error;
  }
}
