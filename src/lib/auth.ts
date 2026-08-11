import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { prisma } from "@/lib/prisma";
import { authConfig } from "@/lib/auth.config";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    // Enkel Google-accounts waarvan het e-mailadres al bestaat als actieve
    // gebruiker in het CRM mogen inloggen — "goedkeuren" gebeurt dus door
    // een account aan te maken bij Gebruikers, ongeacht domein. Een
    // gedeactiveerd account (of een e-mailadres dat hier nooit is
    // aangemaakt) wordt hier geweigerd, ook al is het een geldig
    // Google-account.
    signIn: async ({ user }) => {
      if (!user.email) return false;
      const dbUser = await prisma.user.findUnique({
        where: { email: user.email },
      });
      return !!dbUser && dbUser.active;
    },
    // Overschrijft de edge-safe jwt-callback (die enkel de reeds aanwezige
    // token doorgeeft) met een versie die op het moment van inloggen ons
    // eigen interne account (id/rol) opzoekt — de Google-profielvelden
    // (sub/naam/foto) zijn niet wat de rest van de app als identiteit
    // gebruikt.
    jwt: async ({ token, user }) => {
      if (user?.email) {
        const dbUser = await prisma.user.findUnique({
          where: { email: user.email },
        });
        if (dbUser) {
          token.id = dbUser.id;
          token.role = dbUser.role;
        }
      }
      return token;
    },
  },
});
