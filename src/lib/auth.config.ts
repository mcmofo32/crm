import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe deel van de NextAuth config: geen providers die Prisma/bcrypt
 * (Node.js-only) importeren, zodat dit bestand veilig in de proxy/middleware
 * (Edge runtime) gebruikt kan worden. De volledige config met de Credentials
 * provider zit in `auth.ts`.
 */
export const authConfig = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
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
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
