import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/lib/auth.config";

const { auth } = NextAuth(authConfig);

const PUBLIC_PATHS = ["/login"];

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // Doorgegeven als request-header zodat server components (bv. het
  // (app)-layout) het huidige pad kennen zonder client-only hooks als
  // usePathname — nodig om de verplichte-wachtwoordwijziging-redirect
  // zichzelf niet in een lus te laten lopen op zijn eigen pagina.
  const headers = new Headers(req.headers);
  headers.set("x-pathname", pathname);
  const withPathname = () => NextResponse.next({ request: { headers } });

  const isPublic =
    PUBLIC_PATHS.some((p) => pathname.startsWith(p)) ||
    pathname.startsWith("/api/auth");

  if (isPublic) return withPathname();

  if (!req.auth) {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const realRole = req.auth.user.role;
  const viewAsRole = req.cookies.get("view-as-role")?.value;
  const effectiveRole =
    realRole === "BEHEERDER" &&
    (viewAsRole === "ADMIN" || viewAsRole === "COACH" || viewAsRole === "USER")
      ? viewAsRole
      : realRole;

  if (
    pathname.startsWith("/beheer") &&
    effectiveRole !== "BEHEERDER" &&
    effectiveRole !== "ADMIN"
  ) {
    return NextResponse.redirect(new URL("/dashboard", req.nextUrl.origin));
  }

  return withPathname();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
