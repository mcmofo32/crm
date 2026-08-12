import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe deel van de NextAuth config: geen providers/callbacks die
 * Prisma (Node.js-only) importeren, zodat dit bestand veilig in de proxy/
 * middleware (Edge runtime) gebruikt kan worden. De volledige config met de
 * Google-provider en de Prisma-afhankelijke signIn/jwt-callbacks zit in
 * `auth.ts`.
 */
export const authConfig = {
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  // Zonder expliciete `error`-pagina toont NextAuth zijn eigen kale
  // "Access Denied"-scherm bij een geweigerde login (bv. een Google-account
  // dat niet aan een actieve CRM-gebruiker gekoppeld is) — met deze
  // instelling komt diezelfde fout op /login terecht, waar de duidelijke
  // Nederlandstalige foutmelding staat.
  pages: { signIn: "/login", error: "/login" },
  // Nodig op Vercel: het platform draait achter een proxy met een dynamische
  // host (bv. per preview-deployment), dus NextAuth moet die host vertrouwen
  // in plaats van een vaste NEXTAUTH_URL te vereisen.
  trustHost: true,
  providers: [],
  callbacks: {
    jwt: async ({ token, user }) => {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },
    session: async ({ session, token }) => {
      if (session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
        session.user.loginAt = token.loginAt;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
