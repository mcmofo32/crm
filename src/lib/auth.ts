import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { prisma } from "@/lib/prisma";
import { authConfig } from "@/lib/auth.config";

/** E-mail case-insensitief opzoeken: Google geeft niet altijd exact dezelfde schrijfwijze terug als hoe het adres in Gebruikers werd ingevoerd. */
function findUserByEmail(email: string) {
  return prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
  });
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      // Zonder dit gebruikt Google gewoon het account waarmee de browser
      // toevallig al ingelogd is, zonder te vragen — vervelend voor wie
      // meerdere Google-accounts heeft (bv. werk + privé) en expliciet wil
      // kiezen welke bij het inloggen op het CRM gebruikt wordt.
      authorization: {
        params: { prompt: "select_account" },
      },
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
      const dbUser = await findUserByEmail(user.email);
      return !!dbUser && dbUser.active;
    },
    // Overschrijft de edge-safe jwt-callback (die enkel de reeds aanwezige
    // token doorgeeft) met een versie die op het moment van inloggen ons
    // eigen interne account (id/rol) opzoekt — de Google-profielvelden
    // (sub/naam/foto) zijn niet wat de rest van de app als identiteit
    // gebruikt.
    jwt: async ({ token, user }) => {
      if (user?.email) {
        const dbUser = await findUserByEmail(user.email);
        if (dbUser) {
          token.id = dbUser.id;
          token.role = dbUser.role;
          token.loginAt = Date.now();
        }
      }
      return token;
    },
  },
});
