"use server";

import { cookies } from "next/headers";

export type Theme = "light" | "dark";

const THEME_COOKIE = "theme";
const THEME_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60 * 24 * 365,
};

/** Gelezen server-side in de root layout, vóór de eerste render — zo geen flits van het verkeerde thema bij het laden. */
export async function getTheme(): Promise<Theme> {
  const cookieStore = await cookies();
  return cookieStore.get(THEME_COOKIE)?.value === "dark" ? "dark" : "light";
}

export async function setThemeAction(theme: Theme) {
  const cookieStore = await cookies();
  cookieStore.set(THEME_COOKIE, theme, THEME_COOKIE_OPTIONS);
}
