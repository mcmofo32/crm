import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/lib/auth.config";

const { auth } = NextAuth(authConfig);

const PUBLIC_PATHS = ["/login", "/privacy"];

export default auth((req) => {
  const { pathname } = req.nextUrl;

  const isPublic =
    PUBLIC_PATHS.some((p) => pathname.startsWith(p)) ||
    pathname.startsWith("/api/auth");

  if (isPublic) return NextResponse.next();

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

  // Een Coach mag de Doelen-pagina (eigen medewerkers' doelen) gebruiken,
  // maar niet de productiemaand-kalender daaronder (bedrijfsbrede instelling)
  // of de rest van Beheerderstools.
  const isCoachDoelenPath =
    effectiveRole === "COACH" &&
    (pathname === "/beheer/doelen" ||
      (pathname.startsWith("/beheer/doelen/") &&
        !pathname.startsWith("/beheer/doelen/productie")));

  // Weekoverzicht is voor iedereen (ook een gewone medewerker, niet enkel
  // Coach/Beheerder/Admin) — de pagina zelf lost het team van de kijker al
  // correct op via zijn teamlidmaatschap, dus geen rolbeperking hier nodig.
  const isWeekoverzichtPath = pathname.startsWith("/beheer/weekoverzicht");

  if (
    pathname.startsWith("/beheer") &&
    effectiveRole !== "BEHEERDER" &&
    effectiveRole !== "ADMIN" &&
    !isCoachDoelenPath &&
    !isWeekoverzichtPath
  ) {
    return NextResponse.redirect(new URL("/dashboard", req.nextUrl.origin));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
